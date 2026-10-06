import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const R2_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'] as const;

// Served by main.ts when R2 is not configured (local dev only).
export const LOCAL_UPLOADS_PREFIX = '/api/uploads';
export function localUploadsDir(config: ConfigService): string {
  return resolve(config.get<string>('UPLOADS_DIR') ?? 'uploads');
}

interface R2Target {
  client: S3Client;
  bucket: string;
  publicUrl: string;
}

// Public file storage for user uploads: Cloudflare R2 when R2_* env is set, else local disk.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly r2: R2Target | null;
  private readonly localDir: string;

  constructor(config: ConfigService) {
    this.localDir = localUploadsDir(config);
    if (config.get('R2_BUCKET')) {
      this.r2 = {
        client: new S3Client({
          region: 'auto',
          endpoint: `https://${config.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: config.get('R2_ACCESS_KEY_ID')!,
            secretAccessKey: config.get('R2_SECRET_ACCESS_KEY')!,
          },
        }),
        bucket: config.get('R2_BUCKET')!,
        publicUrl: config.get<string>('R2_PUBLIC_URL')!.replace(/\/+$/, ''),
      };
    } else {
      this.r2 = null;
      this.logger.warn(`R2 not configured; storing uploads on disk at ${this.localDir}`);
    }
  }

  get isLocal(): boolean {
    return this.r2 === null;
  }

  // Stores the file under `key` and returns its public URL.
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.r2) {
      await this.r2.client.send(
        new PutObjectCommand({
          Bucket: this.r2.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // keys are unique per upload, so the content never changes
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return `${this.r2.publicUrl}/${key}`;
    }
    const path = join(this.localDir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return `${LOCAL_UPLOADS_PREFIX}/${key}`;
  }

  // Inverse of put(): the key behind a URL it returned, or null for anything else.
  keyFromUrl(url: string): string | null {
    const prefix = (this.r2 ? this.r2.publicUrl : LOCAL_UPLOADS_PREFIX) + '/';
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  // Best effort: an orphaned file is harmless, so failures are only logged.
  async delete(key: string): Promise<void> {
    try {
      if (this.r2) await this.r2.client.send(new DeleteObjectCommand({ Bucket: this.r2.bucket, Key: key }));
      else await rm(join(this.localDir, key), { force: true });
    } catch (err) {
      this.logger.warn(`Failed to delete ${key}: ${(err as Error).message}`);
    }
  }
}
