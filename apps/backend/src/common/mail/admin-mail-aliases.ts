import { optionalEnv } from '../config/env';

const ADMIN_FORWARD_USERNAME_ENV = 'MAIL_ADMIN_FORWARD_USERNAME';
const ADMIN_FORWARD_ALIASES_ENV = 'MAIL_ADMIN_FORWARD_ALIASES';
const USERNAME_PATTERN = /^[a-z0-9_-]{3,50}$/;

export function extractMailAddress(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  const emailCandidate = angleMatch?.[1] ?? trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? trimmed;

  return emailCandidate.toLowerCase().trim();
}

export function getAdminForwardAliases() {
  const rawAliases = optionalEnv(ADMIN_FORWARD_ALIASES_ENV) ?? '';

  return new Set(
    rawAliases
      .split(/[,\s;]+/)
      .map((alias) => extractMailAddress(alias))
      .filter(Boolean),
  );
}

export function getAdminForwardUsername() {
  const username = optionalEnv(ADMIN_FORWARD_USERNAME_ENV);
  if (!username) {
    return undefined;
  }

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      `${ADMIN_FORWARD_USERNAME_ENV} must be a lowercase username with 3-50 letters, numbers, underscores or hyphens`,
    );
  }

  return username;
}

function isFullEmailAddress(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

export function resolveIncomingRecipientAddress(...rawRecipients: unknown[]) {
  const recipients = rawRecipients
    .map((recipient) => extractMailAddress(recipient))
    .filter(Boolean);

  if (recipients.length === 0) {
    return 'unknown';
  }

  const adminAliases = getAdminForwardAliases();
  const adminForwardUsername = getAdminForwardUsername();
  const primaryAdminAddress = adminForwardUsername
    ? `${adminForwardUsername}@redbox.cx`
    : undefined;
  const forwardedAdminAlias = recipients.find(
    (recipient) => recipient !== primaryAdminAddress && adminAliases.has(recipient),
  );

  return (
    forwardedAdminAlias ??
    recipients.find((recipient) => adminAliases.has(recipient)) ??
    recipients.find(isFullEmailAddress) ??
    recipients[0]
  );
}

export function resolveIncomingMailboxUsername(rawRecipient: unknown) {
  const cleanEmail = extractMailAddress(rawRecipient);
  if (!cleanEmail) {
    return 'unknown';
  }

  const adminForwardUsername = getAdminForwardUsername();
  if (adminForwardUsername && getAdminForwardAliases().has(cleanEmail)) {
    return adminForwardUsername;
  }

  return cleanEmail.split('@')[0]?.trim() || 'unknown';
}
