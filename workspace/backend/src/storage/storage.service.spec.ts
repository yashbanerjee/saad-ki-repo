import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  StorageService,
  normalizeS3Endpoint,
  buildPublicObjectUrl,
} from './storage.service';

function mockConfig(map: Record<string, string | undefined>): ConfigService {
  return {
    get: <T = string>(key: string, defaultValue?: T) =>
      (map[key] !== undefined ? map[key] : defaultValue) as T,
  } as unknown as ConfigService;
}

describe('normalizeS3Endpoint', () => {
  it('strips trailing slash', () => {
    expect(
      normalizeS3Endpoint('https://abc.r2.cloudflarestorage.com/'),
    ).toBe('https://abc.r2.cloudflarestorage.com');
  });

  it('strips bucket path Cloudflare dashboard often includes', () => {
    expect(
      normalizeS3Endpoint(
        'https://80b9b1305de40ab126b03aa652844062.r2.cloudflarestorage.com/vedha-system',
      ),
    ).toBe(
      'https://80b9b1305de40ab126b03aa652844062.r2.cloudflarestorage.com',
    );
  });

  it('returns empty for blank input', () => {
    expect(normalizeS3Endpoint('')).toBe('');
    expect(normalizeS3Endpoint('   ')).toBe('');
  });
});

describe('buildPublicObjectUrl', () => {
  it('joins base and key without double slashes', () => {
    expect(
      buildPublicObjectUrl('https://pub-example.r2.dev/', 'companies/a/file.pdf'),
    ).toBe('https://pub-example.r2.dev/companies/a/file.pdf');
  });

  it('returns undefined when base missing', () => {
    expect(buildPublicObjectUrl('', 'k')).toBeUndefined();
  });
});

describe('StorageService local mode', () => {
  let uploadDir: string;
  let service: StorageService;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'taskflow-storage-'));
    service = new StorageService(
      mockConfig({
        S3_ACCESS_KEY_ID: '',
        S3_SECRET_ACCESS_KEY: '',
        UPLOAD_DIR: uploadDir,
      }),
    );
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('isLocal when credentials are empty', () => {
    expect(service.isLocal()).toBe(true);
  });

  it('generates a safe unique key under folder', () => {
    const key = service.generateKey('companies/abc', 'Report.PDF');
    expect(key).toMatch(/^companies\/abc\/[a-f0-9-]+\.PDF$/i);
  });

  it('uploads and reads back a file from disk', async () => {
    const key = service.generateKey('tests', 'hello.txt');
    const body = Buffer.from('hello-storage');
    const result = await service.upload(key, body, 'text/plain');
    expect(result.mode).toBe('local');
    expect(result.key).toBe(key);
    expect(result.url).toBeUndefined();

    const read = await service.getObjectBuffer(key);
    expect(read.toString()).toBe('hello-storage');

    await service.delete(key);
    await expect(service.getObjectBuffer(key)).rejects.toBeTruthy();
  });

  it('rejects empty buffers', async () => {
    await expect(
      service.upload('x/empty.bin', Buffer.alloc(0), 'application/octet-stream'),
    ).rejects.toThrow(/Empty file buffer/);
  });

  it('skips delete for portal-link pseudo keys', async () => {
    await expect(service.delete('portal-link/proj/abc')).resolves.toBeUndefined();
  });

  it('returns null signed url in local mode', async () => {
    expect(await service.getSignedUrl('any/key.txt')).toBeNull();
  });
});

describe('StorageService s3 mode flags', () => {
  it('does not use S3 for placeholder credentials', () => {
    const service = new StorageService(
      mockConfig({
        S3_ACCESS_KEY_ID: 'your-access-key',
        S3_SECRET_ACCESS_KEY: 'your-secret-key',
        S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      }),
    );
    expect(service.isLocal()).toBe(true);
  });

  it('uses S3 when real-looking credentials are set', () => {
    const service = new StorageService(
      mockConfig({
        S3_ACCESS_KEY_ID: 'test-access-key-not-placeholder',
        S3_SECRET_ACCESS_KEY: 'test-secret-key-not-placeholder',
        S3_ENDPOINT:
          'https://example.r2.cloudflarestorage.com/vedha-system',
        S3_BUCKET: 'vedha-system',
        S3_PUBLIC_URL: 'https://pub-example.r2.dev',
        S3_REGION: 'auto',
      }),
    );
    expect(service.isLocal()).toBe(false);
  });
});

describe('StorageService R2 integration', () => {
  const hasRealR2 =
    process.env.RUN_R2_LIVE_TESTS === '1' ||
    Boolean(
      process.env.S3_ACCESS_KEY_ID &&
        process.env.S3_SECRET_ACCESS_KEY &&
        process.env.S3_ENDPOINT &&
        process.env.S3_BUCKET,
    );

  const maybeIt = hasRealR2 ? it : it.skip;

  maybeIt(
    'uploads, reads, and deletes a real object on R2',
    async () => {
      const service = new StorageService(
        mockConfig({
          S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
          S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
          S3_ENDPOINT: process.env.S3_ENDPOINT,
          S3_BUCKET: process.env.S3_BUCKET,
          S3_PUBLIC_URL: process.env.S3_PUBLIC_URL,
          S3_REGION: process.env.S3_REGION || 'auto',
        }),
      );

      expect(service.isLocal()).toBe(false);

      const key = service.generateKey('taskflow-tests', 'r2-check.txt');
      const payload = Buffer.from(`r2-live-${Date.now()}`);

      const up = await service.upload(key, payload, 'text/plain');
      expect(up.mode).toBe('s3');
      expect(up.key).toBe(key);
      if (process.env.S3_PUBLIC_URL) {
        expect(up.url).toContain(key);
      }

      const signed = await service.getSignedUrl(key, 120);
      expect(signed).toBeTruthy();
      expect(String(signed)).toMatch(/^https?:\/\//);

      const down = await service.getObjectBuffer(key);
      expect(down.equals(payload)).toBe(true);

      await service.delete(key);
    },
    60000,
  );
});
