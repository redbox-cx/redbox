export const backendEnvFilePaths = ['apps/backend/.env', '.env'];

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function envOriginList(name: string, fallback: string[]) {
  const origins = process.env[name]
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins?.length ? origins : fallback;
}
