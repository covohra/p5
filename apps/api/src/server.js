import 'dotenv/config'
import { buildApp } from './app.js'
import { config, assertConfig } from './config.js'

// Validate required env/config (throws with a clear message if missing)
assertConfig()

// Build the Fastify app (registers /health, /ready, /api/*, etc.)
const app = buildApp()

// Helpful diagnostics so we’re sure Prisma resolves in the container
try {
  // Where @prisma/client is being loaded from
  const prismaClientEntry = require.resolve('@prisma/client')
  // Where the generated client must exist at runtime
  const expectedGeneratedDir = '/app/node_modules/.prisma/client'
  app.log.info({ prismaClientEntry, expectedGeneratedDir }, 'Prisma resolution check')
} catch (e) {
  app.log.warn({ err: e }, 'Could not resolve @prisma/client at startup')
}

const HOST = '0.0.0.0'
const PORT = Number(config.port ?? process.env.PORT ?? 3000)

// Startup banner
app.log.info(
  {
    env: config.env,
    port: PORT,
    cors: config.corsOrigins,
    metrics: config.metricsEnabled,
  },
  'Starting API'
)

// Start HTTP server
app
  .listen({ host: HOST, port: PORT })
  .then(() => app.log.info(`✅ API listening on http://${HOST}:${PORT}`))
  .catch((err) => {
    app.log.error({ err }, '❌ Startup failed')
    process.exit(1)
  })

// Graceful shutdown
async function shutdown(sig) {
  app.log.info({ sig }, 'Shutting down...')
  try {
    await app.close()
    process.exit(0)
  } catch (err) {
    app.log.error({ err }, 'Shutdown error')
    process.exit(1)
  }
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => shutdown(sig))
}