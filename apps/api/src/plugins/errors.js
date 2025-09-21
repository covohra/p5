export function registerErrorHandler(app) {
  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode || err.status || 500
    const code = err.code || 'INTERNAL_ERROR'
    const message =
      status < 500
        ? (err.message || 'Bad Request')
        : 'Internal Server Error'

    // Log at error level if 5xx, warn otherwise
    app.log[status >= 500 ? 'error' : 'warn']({ err }, 'request failed')

    reply.code(status).send({
      error: { code, message }
    })
  })
}