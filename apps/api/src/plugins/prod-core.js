/* apps/api/src/plugins/prod-core.js */
export default async function prodCore(app) {
  // ---- Config validation (fail fast) ----
  const required = ["DATABASE_URL", "RATE_LIMIT_MAX", "RATE_LIMIT_TIME_WINDOW"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    app.log.error({ missing }, "Missing required env vars");
    throw new Error("Missing env: " + missing.join(","));
  }

  // Optional auth gate (default off so CI stays green)
  const AUTH_REQUIRED = String(process.env.AUTH_REQUIRED || "false").toLowerCase() === "true";
  const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";

  // ---- JWT ----
  const jwtMod = await import("@fastify/jwt");
  await app.register(jwtMod.default, { secret: JWT_SECRET });

  app.decorate("authVerify", async (req, reply) => {
    if (!AUTH_REQUIRED) return; // auth disabled
    // Public endpoints even when auth is on
    const url = req.raw.url || "";
    if (
      url === "/health" || url === "/ready" || url === "/version" ||
      url.startsWith("/auth/")
    ) return;

    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid or missing token" }});
    }
  });

  app.addHook("preHandler", app.authVerify);

  // ---- Error handler (uniform shape) ----
  app.setErrorHandler((err, req, reply) => {
    // Validation errors from Fastify have .validation / or Ajv text
    if (err.validation || err.validationContext) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: err.message, details: err.validation || null }
      });
    }
    const status = (err.statusCode && err.statusCode >= 400 && err.statusCode < 600) ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, "Unhandled error");
    return reply.code(status).send({
      error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message: status === 500 ? "Internal Server Error" : err.message }
    });
  });

  // ---- Metrics (/metrics) ----
  const prom = (await import("prom-client")).default || await import("prom-client");
  const register = prom.register;
  const counter = new prom.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status"]
  });
  const hist = new prom.Histogram({
    name: "http_request_duration_ms",
    help: "HTTP request duration (ms)",
    labelNames: ["method", "route", "status"],
    buckets: [50, 100, 200, 500, 1000, 2000, 5000]
  });

  app.addHook("onRequest", async (req) => { req._start = Date.now(); });
  app.addHook("onResponse", async (req, reply) => {
    const labels = {
      method: req.method,
      route: req.routerPath || req.url || "",
      status: String(reply.statusCode)
    };
    counter.inc(labels, 1);
    if (req._start) hist.observe(labels, Date.now() - req._start);
  });

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });

  // ---- /auth/login (demo) ----
  app.register(async (r) => {
    r.post("/login", {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email", maxLength: 254 }
          }
        }
      },
      handler: async (req) => {
        const { email } = req.body ?? {};
        // Minimal: identity == email; in real app, verify OTP/password etc.
        const token = app.jwt.sign({ sub: email });
        return { token };
      }
    });
  }, { prefix: "/auth" });
}
