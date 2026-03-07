import fp from 'fastify-plugin';

/**
 * Unified error responses + sane logging.
 * - 400 for validation errors (Fastify schema)
 * - Preserve provided 4xx/5xx when present, else 500
 * - Log only 5xx with full error object
 * - Stable shape: { error: { code, message, details? } }
 */
export default fp(async function errorPlugin(app) {
  app.setErrorHandler((err, req, reply) => {
    const isValidation =
      err?.validation ||
      err?.code === 'FST_ERR_VALIDATION' ||
      /validation/i.test(err?.message || '');

    const hinted = Number(err?.statusCode);
    const status =
      isValidation ? 400 :
      (Number.isInteger(hinted) && hinted >= 400 && hinted < 600 ? hinted : 500);

    if (status >= 500) {
      req.log.error({ err }, 'unhandled error');
    }

    reply.code(status).send({
      error: {
        code: err?.code || (isValidation ? 'VALIDATION_ERROR' : 'INTERNAL'),
        message: isValidation
          ? 'Validation failed'
          : (status === 500 ? 'Internal Server Error' : (err?.message || 'Error')),
        details: isValidation ? err.validation : undefined,
      },
    });
  });
});