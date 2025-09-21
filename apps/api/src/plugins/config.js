export function registerConfig(app) {
  const {
    NODE_ENV = "development",
    PORT = "3000",
    DATABASE_URL,
    CORS_ORIGINS = "*",
    RATE_LIMIT_MAX = "100",
    RATE_LIMIT_TIME_WINDOW = "1 minute",
    JWT_SECRET,
    JWT_EXPIRES_IN = "1d",
  } = process.env;

  if (NODE_ENV !== "test" && !DATABASE_URL) {
    app.log.error("Missing DATABASE_URL");
    throw new Error("DATABASE_URL is required");
  }
  if (NODE_ENV === "production" && !JWT_SECRET) {
    app.log.error("Missing JWT_SECRET");
    throw new Error("JWT_SECRET is required in production");
  }

  app.decorate("config", Object.freeze({
    nodeEnv: NODE_ENV,
    port: Number(PORT),
    databaseUrl: DATABASE_URL,
    corsOrigins: CORS_ORIGINS.split(",").map(s => s.trim()).filter(Boolean),
    rateLimitMax: Number(RATE_LIMIT_MAX),
    rateLimitWindow: RATE_LIMIT_TIME_WINDOW,
    jwtSecret: JWT_SECRET || "dev-only-secret",
    jwtExpiresIn: JWT_EXPIRES_IN,
  }));
}