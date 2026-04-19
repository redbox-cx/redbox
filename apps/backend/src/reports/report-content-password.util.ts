import { InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function getReportPasswordSecret() {
  const secret =
    process.env.REPORT_CONTENT_SECRET ??
    process.env.ADMIN_JWT_ACCESS_SECRET ??
    process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new InternalServerErrorException('Report password secret is not configured');
  }

  return createHash('sha256').update(secret).digest();
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
