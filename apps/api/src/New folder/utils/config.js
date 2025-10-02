// Centralized env & validation (no extra deps)
export function loadConfig() {
  const env = process.env;

  const cfg = {
    NODE_ENV: env.NODE_ENV ?? 'development',
    PORT: Number(env.PORT ?? 3000),

    // REQUIRED:
    DATABASE_URL: env.DATABASE_URL,
    JWT_SECRET: env.JWT_SECRET,

    RATE_LIMIT_MAX: Number(env.RATE_LIMIT_MAX ?? 100),
    RATE_LIMIT_TIME_WINDOW: env.RATE_LIMIT_TIME_WINDOW ?? '1 minute',

    // Comma-separated allowlist, e.g. "https://your.com,https://staging.your.com"
    CORS_ORIGINS: (env.CORS_ORIGINS ?? '*')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),

    // Optional build metadata (set by CI)
    GIT_SHA: env.GIT_SHA ?? null,
    STARTED_AT: env._STARTED_AT ?? null,
  };

  const missing = [];
  if (!cfg.DATABASE_URL) missing.push('DATABASE_URL');
  if (!cfg.JWT_SECRET) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(Missing required env: ${missing.join(', ')});
  }

  return cfg;
}