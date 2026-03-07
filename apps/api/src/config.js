// Loads .env in local/dev. (Fly/CI often use: node -r dotenv/config …)
import 'dotenv/config';

const toInt = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export const config = {
  // --- environment / ports ---
  env: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',

  // --- database ---
  databaseUrl: process.env.DATABASE_URL ?? null,

  // --- auth ---
  // If JWT_SECRET is missing, auth plugin goes into “disabled” mode (returns 501, /api open).
  jwtSecret: process.env.JWT_SECRET ?? null,
  // Optional bootstrap creds for /auth/login when you don’t have passwordHash in DB yet
  authEmail: process.env.AUTH_EMAIL || null,
  authPassword: process.env.AUTH_PASSWORD || null,

  // --- rate limit ---
  rateLimit: {
    max: toInt(process.env.RATE_LIMIT_MAX, 100),
    window: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute',
  },

  // --- CORS ---
  // Accepts "*" or CSV: "https://a.com,https://b.com"
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // --- metrics (/metrics) ---
  metricsEnabled:
    (process.env.METRICS_ENABLED ?? 'true').toLowerCase() !== 'false',
  metricsToken: process.env.METRICS_TOKEN || null,
};

export function assertConfig(app) {
  const missing = [];
  const isProdLike = config.env === 'production' || config.env === 'staging';

  if (!config.rateLimit.window) missing.push('RATE_LIMIT_TIME_WINDOW');
  if (isProdLike && !config.databaseUrl) missing.push('DATABASE_URL');
  if (isProdLike && (!config.jwtSecret || config.jwtSecret.length < 8)) {
    missing.push('JWT_SECRET (min 8 chars)');
  }
  if (isProdLike && config.metricsEnabled && !config.metricsToken) {
    missing.push('METRICS_TOKEN (to protect /metrics)');
  }

  if (missing.length) {
    app?.log?.error?.({ missing }, 'Invalid configuration');
    throw new Error(`Invalid configuration: ${missing.join(', ')}`);
  }
}