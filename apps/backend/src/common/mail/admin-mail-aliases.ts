import { optionalEnv } from '../config/env';

const ADMIN_FORWARD_ALIASES_ENV = 'MAIL_ADMIN_FORWARD_ALIASES';

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
  const forwardedAdminAlias = recipients.find(
    (recipient) => recipient !== 'admin@redbox.cx' && adminAliases.has(recipient),
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

  if (getAdminForwardAliases().has(cleanEmail)) {
    return 'admin';
  }

  return cleanEmail.split('@')[0]?.trim() || 'unknown';
}
