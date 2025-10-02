export function registerErrors(app) {
  app.setErrorHandler((err, _req, reply) => {
    if (err?.code === 'P2025') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
    }
    if (err.validation) {
      return reply.code(400).send({
        error: { code: 'BAD_REQUEST', message: 'Validation failed', details: err.validation },
      });
    }
    app.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } });
  });

  app.setNotFoundHandler((req, reply) => {
    return reply.code(404).send({
      error: { code: 'NOT_FOUND', message: Route ${req.method} ${req.url} not found },
    });
  });
}