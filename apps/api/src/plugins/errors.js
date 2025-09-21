export function registerErrorHandling(app) {
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: { code: "NOT_FOUND", message: Route ${req.method} ${req.url} not found },
    });
  });

  app.setErrorHandler((err, req, reply) => {
    const isValidation = Array.isArray(err?.validation) || err?.code === "FST_ERR_VALIDATION";
    if (isValidation) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION",
          message: err.message || "Validation failed",
          details: err.validation,
        },
      });
    }
    if (err?.code === "P2025") {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Record not found" } });
    }
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, "unhandled error");
    reply.code(status).send({
      error: { code: status >= 500 ? "INTERNAL" : "BAD_REQUEST", message: err.message || "Unexpected error" },
    });
  });
}