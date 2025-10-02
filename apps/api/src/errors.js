export function registerErrorHandler(app) {
  app.setErrorHandler((err, req, reply) => {
    const isValidation = err.validation || err.code === 'FST_ERR_VALIDATION'
    const status = isValidation ? 400 : (err.statusCode || 500)

    if (status >= 500) req.log.error({ err }, 'unhandled error')

    reply.code(status).send({
      error: {
        code: err.code || (isValidation ? 'VALIDATION' : 'INTERNAL'),
        message: err.message || 'Internal Server Error',
        details: isValidation ? err.validation : undefined,
      },
    })
  })
}
