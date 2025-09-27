export function registerErrorHandler(app) {
  // Validation & generic errors
  app.setErrorHandler((err, req, reply) => {
    if (err?.validation) {
      return reply.code(400).send({
        error: { code: 'BAD_REQUEST', message: err.message, details: err.validation }
      });
    }

    const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    const code =
      status === 400 ? 'BAD_REQUEST' :
      status === 401 ? 'UNAUTHORIZED' :
      status === 404 ? 'NOT_FOUND'   :
      'INTERNAL';

    const message =
      status >= 500 ? 'Internal Server Error' : (err.message || 'Request failed');

    req.log[status >= 500 ? 'error' : 'warn']({ err }, 'request failed');
    reply.code(status).send({ error: { code, message } });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
}