import { S3Client } from '@aws-sdk/client-s3';
import { requireEnv } from '../config/env';

export function createRequiredS3Client() {
  return new S3Client({
    endpoint: requireEnv('S3_ENDPOINT'),
    region: requireEnv('S3_REGION'),
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY'),
      secretAccessKey: requireEnv('S3_SECRET_KEY'),
    },
    forcePathStyle: true,
  });
}

export function requireBucket(name: string) {
  return requireEnv(name);
}
