/**
 * Fastify error + 404 handlers (ESM)
 */
export default async function errorPlugin(app) {
  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode ?? 500
    const body = {
      error: {
        code: err.code ?? (status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'),
        message: err.validation ? 'Invalid request' : (err.message ?? 'Unexpected error'),
        details: err.validation ?? undefined
      }
    }
    if (status >= 500) app.log.error({ err }, 'unhandled error')
    reply.code(status).send(body)
  })

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: Route ${req.method} ${req.url} not found }
    })
  })
}