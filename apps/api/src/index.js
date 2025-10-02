import Fastify from 'fastify'
import { registerErrorHandler } from './errors.js'

const app = Fastify({ logger: true })

// ... register routes, plugins, etc ...

registerErrorHandler(app)

const PORT = Number(process.env.PORT ?? 3000)
const HOST = '0.0.0.0'

app.listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`✅ API running on http://${HOST}:${PORT}`))
  .catch(err => {
    app.log.error(err, 'Failed to start')
    process.exit(1)
  })

// graceful shutdown for Fly/Docker
const close = async (signal) => {
  app.log.info({ signal }, 'Shutting down')
  try {
    await app.close()
    process.exit(0)
  } catch (e) {
    app.log.error(e, 'Error during shutdown')
    process.exit(1)
  }
}
process.on('SIGTERM', () => close('SIGTERM'))
process.on('SIGINT',  () => close('SIGINT'))