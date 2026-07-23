import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET', 'taskflow-uploads');
    this.publicUrl = config.get<string>('S3_PUBLIC_URL', '');
    this.client = new S3Client({
      region: config.get<string>('S3_REGION', 'auto'),
      endpoint: config.get<string>('S3_ENDPOINT'),
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get<string>('S3_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  generateKey(folder: string, filename: string): string {
    const ext = filename.split('.').pop() ?? 'bin';
    return `${folder}/${randomUUID()}.${ext}`;
  }

  async upload(key: string, buffer: Buffer, mimeType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return {
      key,
      url: this.publicUrl ? `${this.publicUrl}/${key}` : undefined,
    };
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async getSignedUrl(key: string, expiresIn = 3600) {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
