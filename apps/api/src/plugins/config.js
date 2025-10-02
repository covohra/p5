export function readConfig() {
  const missing = [];
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) missing.push('JWT_SECRET');
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) missing.push('DATABASE_URL');

  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }

  const corsOrigins = (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    jwtSecret: JWT_SECRET,
    databaseUrl: DATABASE_URL,
    corsOrigins,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
    rateLimitWindow: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute',
  };
}