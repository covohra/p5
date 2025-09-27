import crypto from 'node:crypto';

function required(name, val) {
  if (!val || String(val).trim() === '') {
    throw new Error([config] Missing required env: ${name});
  }
  return val;
}

export function readConfig() {
  // DATABASE_URL must exist (CI & Fly already set it)
  const databaseUrl = required('DATABASE_URL', process.env.DATABASE_URL);

  // JWT: safe fallback when unset (random in prod; 'test-secret' in CI)
  const jwtSecret =
    process.env.JWT_SECRET
      || (process.env.NODE_ENV === 'test'
            ? 'test-secret'
            : crypto.randomBytes(32).toString('hex'));

  const corsOrigins = (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return {
    jwtSecret,
    databaseUrl,
    corsOrigins,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
    rateLimitWindow: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute',
  };
}