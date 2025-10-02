// Loads .env in local/dev. (In Docker you already use -r dotenv/config)
import 'dotenv/config';

const toInt = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 3000),

  // Database
  databaseUrl: process.env.DATABASE_URL ?? null,

  // Auth (optional in dev, required in prod/staging)
  jwtSecret: process.env.JWT_SECRET ?? null,

  // Rate limit
  rateLimit: {
    max: toInt(process.env.RATE_LIMIT_MAX, 100),
    window: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute',
  },

  // CORS: "*" or CSV list
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // Metrics toggle (defaults ON)
  metricsEnabled: (process.env.METRICS_ENABLED ?? 'true').toLowerCase() !== 'false',
};

export function assertConfig() {
  const missing = [];
  const isProdLike = config.env === 'production' || config.env === 'staging';

  if (isProdLike && !config.databaseUrl) missing.push('DATABASE_URL');
  if (isProdLike && (!config.jwtSecret || config.jwtSecret.length < 8)) {
    missing.push('JWT_SECRET (min 8 chars)');
  }
  if (!config.rateLimit.window) missing.push('RATE_LIMIT_TIME_WINDOW');

  if (missing.length) {
    const list = missing.join(', ');
    console.error(`Config error: missing/invalid -> ${list}`);
    throw new Error(`Invalid configuration: ${list}`);
  }
}