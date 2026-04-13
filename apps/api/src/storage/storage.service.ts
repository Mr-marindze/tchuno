import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type PresignResult = {
  url: string;
  key: string;
  expiresAt: string;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private bucket: string | undefined;

  private getClient(): S3Client | null {
    if (this.client) return this.client;

    const accessKey = process.env.S3_ACCESS_KEY_ID;
    const secretKey = process.env.S3_SECRET_ACCESS_KEY;
    const region = process.env.S3_REGION;
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;

    if (!accessKey || !secretKey || !region || !bucket) {
      this.logger.warn('S3 not configured (missing env vars)');
      return null;
    }

    this.bucket = bucket;

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    return this.client;
  }

  async createPresignedPut(
    key: string,
    contentType: string,
    expiresSeconds = 300,
  ): Promise<PresignResult> {
    const client = this.getClient();
    if (!client || !this.bucket) {
      throw new Error('Storage not configured');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ACL: 'private',
    });

    const url = await getSignedUrl(client, command, { expiresIn: expiresSeconds });
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();

    return { url, key, expiresAt };
  }
}

export type { PresignResult };
