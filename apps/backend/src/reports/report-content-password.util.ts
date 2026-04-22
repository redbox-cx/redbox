import { InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { requireEnv } from 'src/common/config/env';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function getReportPasswordSecret() {
  try {
    return createHash('sha256').update(requireEnv('REPORT_CONTENT_SECRET')).digest();
  } catch {
    throw new InternalServerErrorException('Report password secret is not configured');
  }
}

export function encryptReportedContentPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getReportPasswordSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptReportedContentPassword(payload: string | null | undefined) {
  if (!payload) {
    return null;
  }

  const [ivPart, authTagPart, encryptedPart] = payload.split('.');
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new InternalServerErrorException('Stored report password is invalid');
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getReportPasswordSecret(),
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
