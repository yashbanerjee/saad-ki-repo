import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { readFile, unlink, writeFile, mkdir } from 'fs/promises';
import { dirname, join, normalize, resolve } from 'path';
import { Readable } from 'stream';

export type StorageUploadResult = {
  key: string;
  /** Public or absolute URL when available (may be undefined for private local/S3). */
  url?: string;
  mode: 's3' | 'local';
};

/** Strip bucket suffix / trailing slash Cloudflare shows in the dashboard. */
export function normalizeS3Endpoint(raw: string): string {
  let endpoint = (raw || '').trim().replace(/\/+$/, '');
  if (!endpoint) return '';
  // https://ACCOUNT.r2.cloudflarestorage.com/bucket-name → drop trailing path
  try {
    const u = new URL(endpoint);
    if (u.hostname.endsWith('.r2.cloudflarestorage.com') && u.pathname && u.pathname !== '/') {
      u.pathname = '';
      endpoint = u.toString().replace(/\/+$/, '');
    }
  } catch {
    /* keep trimmed string */
  }
  return endpoint;
}

export function buildPublicObjectUrl(publicBase: string, key: string): string | undefined {
  const base = (publicBase || '').trim().replace(/\/+$/, '');
  if (!base || !key) return undefined;
  const cleanedKey = key.replace(/^\/+/, '');
  return `${base}/${cleanedKey}`;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly localRoot: string;
  private readonly useS3: boolean;

  constructor(private config: ConfigService) {
    this.bucket = (config.get<string>('S3_BUCKET') || 'taskflow-uploads').trim();
    this.publicUrl = (
      config.get<string>('S3_PUBLIC_URL') ||
      config.get<string>('STORAGE_PUBLIC_URL') ||
      ''
    ).trim();

    const accessKeyId = (config.get<string>('S3_ACCESS_KEY_ID') || '').trim();
    const secretAccessKey = (
      config.get<string>('S3_SECRET_ACCESS_KEY') || ''
    ).trim();
    const endpoint = normalizeS3Endpoint(config.get<string>('S3_ENDPOINT') || '');

    // Use object storage only when credentials look real (not placeholders).
    this.useS3 = Boolean(
      accessKeyId &&
        secretAccessKey &&
        accessKeyId !== 'your-access-key' &&
        secretAccessKey !== 'your-secret-key',
    );

    this.localRoot = resolve(
      config.get<string>('UPLOAD_DIR') || join(process.cwd(), 'uploads'),
    );

    if (this.useS3) {
      this.client = new S3Client({
        region: config.get<string>('S3_REGION', 'auto'),
        endpoint: endpoint || undefined,
        forcePathStyle: Boolean(endpoint),
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        // R2: disable optional checksum middleware required by newer AWS SDK defaults
        ...( {
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        } as Record<string, string>),
      });
      this.logger.log(
        `Storage: S3/R2 bucket="${this.bucket}" endpoint="${endpoint || 'default'}"`,
      );
    } else {
      this.client = null;
      if (!existsSync(this.localRoot)) {
        mkdirSync(this.localRoot, { recursive: true });
      }
      this.logger.warn(
        `Storage: local disk mode → ${this.localRoot} (set S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY for cloud storage)`,
      );
    }
  }

  isLocal(): boolean {
    return !this.useS3;
  }

  generateKey(folder: string, filename: string): string {
    const ext = filename.includes('.')
      ? filename.split('.').pop()!.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
      : 'bin';
    const safeFolder = folder
      .replace(/\\/g, '/')
      .replace(/\.\./g, '')
      .replace(/^\/+/, '');
    return `${safeFolder}/${randomUUID()}.${ext || 'bin'}`;
  }

  private localPath(key: string): string {
    const safe = normalize(key)
      .replace(/^(\.\.(\/|\\|$))+/, '')
      .replace(/\\/g, '/');
    const full = resolve(join(this.localRoot, safe));
    if (!full.startsWith(this.localRoot)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageUploadResult> {
    if (!buffer?.length) {
      throw new Error('Empty file buffer');
    }

    if (!this.useS3 || !this.client) {
      const full = this.localPath(key);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, buffer);
      return {
        key,
        url: undefined,
        mode: 'local',
      };
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType || 'application/octet-stream',
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`S3 upload failed for key=${key}: ${msg}`);
      throw new Error(
        `Cloud storage upload failed: ${msg}. Check S3/R2 credentials or clear them to use local storage.`,
      );
    }

    return {
      key,
      url: buildPublicObjectUrl(this.publicUrl, key),
      mode: 's3',
    };
  }

  async delete(key: string) {
    if (!key) return;
    // Portal "links" are pseudo-keys, not real objects
    if (key.startsWith('portal-link/')) return;

    if (!this.useS3 || !this.client) {
      try {
        await unlink(this.localPath(key));
      } catch {
        /* ignore missing file */
      }
      return;
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.warn(
        `S3 delete failed for ${key}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string | null> {
    if (!key || key.startsWith('portal-link/')) return null;

    if (!this.useS3 || !this.client) {
      return null;
    }

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    if (!key || key.startsWith('portal-link/')) {
      throw new NotFoundException('File not found');
    }

    if (!this.useS3 || !this.client) {
      try {
        return await readFile(this.localPath(key));
      } catch {
        throw new NotFoundException('File not found on disk');
      }
    }

    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const body = res.Body;
      if (!body) throw new NotFoundException('Empty file body');
      const stream = body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(
        `S3 get failed for ${key}: ${err instanceof Error ? err.message : err}`,
      );
      throw new NotFoundException('File not available in storage');
    }
  }

  createLocalReadStream(key: string) {
    return createReadStream(this.localPath(key));
  }
}
