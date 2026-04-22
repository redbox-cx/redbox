import { isIP } from 'net';
import type { Request } from 'express';

type TrustedNetwork = {
  family: 4 | 6;
  base: bigint;
  mask: bigint;
};

function normalizeIp(value: string | undefined | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withoutBrackets = trimmed.startsWith('[')
    ? trimmed.slice(1, trimmed.indexOf(']'))
    : trimmed;
  const withoutPort =
    withoutBrackets.includes('.') && withoutBrackets.includes(':')
      ? withoutBrackets.replace(/:\d+$/, '')
      : withoutBrackets;
  const withoutIpv4MappedPrefix = withoutPort.replace(/^::ffff:/i, '');

  return isIP(withoutIpv4MappedPrefix) ? withoutIpv4MappedPrefix : null;
}

function ipv4ToBigInt(ip: string) {
  return ip
    .split('.')
    .reduce((acc, part) => (acc << 8n) + BigInt(Number(part)), 0n);
}

function ipv6ToBigInt(ip: string) {
  const [head, tail = ''] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missingParts = 8 - headParts.length - tailParts.length;
  const parts = [
    ...headParts,
    ...Array(Math.max(missingParts, 0)).fill('0'),
    ...tailParts,
  ];

  return parts.reduce((acc, part) => {
    const value = part ? parseInt(part, 16) : 0;
    return (acc << 16n) + BigInt(value);
  }, 0n);
}

function ipToBigInt(ip: string) {
  const normalized = normalizeIp(ip);
  if (!normalized) return null;

  const family = isIP(normalized);
  if (family === 4) return { family: 4 as const, value: ipv4ToBigInt(normalized) };
  if (family === 6) return { family: 6 as const, value: ipv6ToBigInt(normalized) };

  return null;
}

function parseCidr(entry: string): TrustedNetwork | null {
  const [rawIp, rawPrefix] = entry.trim().split('/');
  const ip = normalizeIp(rawIp);
  if (!ip) return null;

  const family = isIP(ip);
  const maxBits = family === 4 ? 32 : 128;
  const prefix = rawPrefix === undefined ? maxBits : Number(rawPrefix);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxBits) return null;

  const parsedIp = ipToBigInt(ip);
  if (!parsedIp) return null;

  const allBits = (1n << BigInt(maxBits)) - 1n;
  const hostBits = maxBits - prefix;
  const mask = hostBits === maxBits ? 0n : (allBits << BigInt(hostBits)) & allBits;

  return {
    family: parsedIp.family,
    base: parsedIp.value & mask,
    mask,
  };
}

function getTrustedProxyNetworks() {
  const raw = process.env.TRUSTED_PROXY_CIDRS ?? process.env.TRUSTED_PROXY_IPS ?? '';

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseCidr)
    .filter((entry): entry is TrustedNetwork => Boolean(entry));
}

function isTrustedProxy(remoteIp: string | null, networks: TrustedNetwork[]) {
  if (!remoteIp || networks.length === 0) return false;

  const parsed = ipToBigInt(remoteIp);
  if (!parsed) return false;

  return networks.some(
    (network) =>
      network.family === parsed.family &&
      (parsed.value & network.mask) === network.base,
  );
}

function firstForwardedIp(value: string | undefined) {
  return normalizeIp(value?.split(',')[0]);
}

export function getClientIp(request: Request) {
  const remoteAddress =
    normalizeIp(request.socket.remoteAddress) ??
    normalizeIp(request.ip) ??
    'unknown';
  const trustedNetworks = getTrustedProxyNetworks();

  if (!isTrustedProxy(remoteAddress, trustedNetworks)) {
    return remoteAddress;
  }

  return (
    normalizeIp(request.get('cf-connecting-ip')) ??
    normalizeIp(request.get('true-client-ip')) ??
    firstForwardedIp(request.get('x-forwarded-for')) ??
    remoteAddress
  );
}

export function getClientIpAuditContext(request: Request) {
  const remoteAddress =
    normalizeIp(request.socket.remoteAddress) ??
    normalizeIp(request.ip) ??
    null;
  const trustedNetworks = getTrustedProxyNetworks();
  const proxyTrusted = isTrustedProxy(remoteAddress, trustedNetworks);

  const cfConnectingIp = proxyTrusted ? normalizeIp(request.get('cf-connecting-ip')) : null;
  const trueClientIp = proxyTrusted ? normalizeIp(request.get('true-client-ip')) : null;
  const forwardedClientIp = proxyTrusted ? firstForwardedIp(request.get('x-forwarded-for')) : null;
  const ipAddress = cfConnectingIp ?? trueClientIp ?? forwardedClientIp ?? remoteAddress;

  return {
    ipAddress,
    ipSource: cfConnectingIp
      ? 'cf-connecting-ip'
      : trueClientIp
        ? 'true-client-ip'
        : forwardedClientIp
          ? 'x-forwarded-for'
          : remoteAddress
            ? 'remote-address'
            : null,
    proxyTrusted,
    remoteAddress,
  };
}
