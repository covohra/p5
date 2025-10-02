export function registerErrorHandler(app) {
  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode || err.status || 500;
    const code =
      status === 400 ? 'BAD_REQUEST' :
      status === 401 ? 'UNAUTHORIZED' :
      status === 404 ? 'NOT_FOUND' : 'INTERNAL';

    const message = status < 500
      ? (err.message || 'Bad Request')
      : 'Internal Server Error';

    app.log[status >= 500 ? 'error' : 'warn']({ err }, 'request failed');
    reply.code(status).send({ error: { code, message } });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
}