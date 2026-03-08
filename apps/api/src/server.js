import 'dotenv/config';
import { buildApp } from './app.js';
import { config, assertConfig } from './config.js';

// 1) Validate env/config early (fail fast with a clear message)
assertConfig();

// 2) Derive host/port once
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT ?? config.port ?? 3000);

// 3) Build Fastify app (app.js sets CORS, rate-limit, routes, /version, etc.)
const app = buildApp();

// 4) Optional: Prisma resolution probe (non-fatal)
(async () => {
  try {
    await import('@prisma/client');
    app.log.info({ ok: true }, 'Prisma client is resolvable');
  } catch (err) {
    // Not fatal; CI/dev images sometimes generate at runtime
    app.log.warn({ err }, 'Prisma client not resolvable at startup');
  }
})();

// 5) Extra safety nets: log and keep process healthy
process.on('unhandledRejection', (reason) => {
  app.log.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  app.log.error({ err }, 'Uncaught exception');
  // Optional: decide whether to exit(1) here; we let graceful shutdown handle it
});

// 6) Startup banner
app.log.info(
  {
    env: process.env.NODE_ENV || config.env || 'development',
    host: HOST,
    port: PORT,
    cors: process.env.CORS_ORIGINS || config.corsOrigins || '*',
    rateLimit: {
      max: Number(process.env.RATE_LIMIT_MAX ?? 100),
      window: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute',
    },
  },
  'Starting API…'
);

// 7) Start HTTP server
app
  .listen({ host: HOST, port: PORT })
  .then(() => {
    app.log.info(`API listening on http://${HOST}:${PORT}`);
  })
  .catch((err) => {
    app.log.error({ err }, '❌ Startup failed');
    process.exit(1);
  });

// 8) Graceful shutdown (SIGINT/SIGTERM)
const shutdown = async (sig) => {
  app.log.info({ sig }, 'Shutting down…');
  try {
    await app.close(); // triggers prisma.$disconnect() via onClose hook in app.js
    app.log.info('✅ Clean shutdown complete');
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'Shutdown error');
    process.exit(1);
  }
};

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => shutdown(sig));
}