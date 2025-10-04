import { config, assertConfig } from './config.js'
import { buildApp } from './app.js'

assertConfig()

const app = buildApp()

app.log.info(
  { env: config.env, port: config.port, cors: config.corsOrigins, metrics: config.metricsEnabled },
  'Starting API'
)

app
  .listen({ host: '0.0.0.0', port: config.port })
  .then(() => app.log.info(`API listening on http://localhost:${config.port}`))
  .catch((err) => {
    app.log.error({ err }, 'Startup failed')
    process.exit(1)
  })

async function shutdown(sig) {
  app.log.info({ sig }, 'Shutting down')
  try {
    await app.close()
    process.exit(0)
  } catch (err) {
    app.log.error({ err }, 'Shutdown error')
    process.exit(1)
  }
}

process.on('SIGINT',  () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))