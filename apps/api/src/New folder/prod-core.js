/* apps/api/src/plugins/prod-core.js */
import fp from "fastify-plugin"
import jwtPlugin from "@fastify/jwt"
import client from "prom-client"

export default fp(async (app) => {
  // ---------- 1) Config validation ----------
  const required = ["RATE_LIMIT_MAX","RATE_LIMIT_TIME_WINDOW"]
  if (process.env.AUTH_REQUIRED === "true") required.push("JWT_SECRET")
  for (const k of required) {
    if (!process.env[k] || String(process.env[k]).trim() === "") {
      app.log.error({ key: k }, "Missing required env")
      throw new Error(Missing required env: ${k})
    }
  }

  // ---------- 2) Metrics ----------
  const r = client.register
  const httpReqs = new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["route","method","status"]
  })
  const httpDur = new client.Histogram({
    name: "http_request_duration_ms",
    help: "HTTP request duration in ms",
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000],
    labelNames: ["route","method","status"]
  })
  app.addHook("onResponse", async (req, res) => {
    const labels = {
      route: req.routerPath || req.url || "unmatched",
      method: req.method,
      status: String(res.statusCode)
    }
    httpReqs.inc(labels)
    const started = req.headers["x-start-time"]
    if (started) {
      const ms = Date.now() - Number(started)
      httpDur.observe(labels, ms)
    }
  })
  app.addHook("onRequest", async (req) => {
    req.headers["x-start-time"] = Date.now().toString()
  })
  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", r.contentType)
    return r.metrics()
  })

  // ---------- 3) JWT auth (guard /api/* when AUTH_REQUIRED=true) ----------
  const authRequired = process.env.AUTH_REQUIRED === "true"
  if (authRequired) {
    await app.register(jwtPlugin, { secret: process.env.JWT_SECRET })
  }

  // public login route (minimal)
  app.post("/auth/login", {
    schema: {
      body: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } }
      },
      response: { 200: { type: "object", properties: { token: { type: "string" } } } }
    }
  }, async (req) => {
    const { email } = req.body
    // In real life, look up/create a user; here we mint a simple token
    const token = await app.jwt.sign({ sub: email }, { expiresIn: "2h" })
    return { token }
  })

  // Protect /api/* if required
  if (authRequired) {
    app.addHook("onRoute", (route) => {
      if (route.path?.startsWith("/api/")) {
        const ensure = async (req, reply) => {
          try {
            await req.jwtVerify()
          } catch {
            return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Missing or invalid token" } })
          }
        }
        // Prepend guard
        route.preHandler = Array.isArray(route.preHandler)
          ? [ensure, ...route.preHandler]
          : route.preHandler
            ? [ensure, route.preHandler]
            : [ensure]
      }
    })
  }

  // ---------- 4) Error contract ----------
  app.setErrorHandler((err, _req, reply) => {
    const isValidation = err.validation || err.code === "FST_ERR_VALIDATION"
    const status = isValidation ? 400 : (err.statusCode && err.statusCode >= 400 ? err.statusCode : 500)
    if (status >= 500) app.log.error({ err }, "Unhandled error")
    const payload = {
      error: {
        code: isValidation ? "VALIDATION_ERROR" : (err.code || "INTERNAL"),
        message: err.message || "Internal Server Error",
        details: err.validation || undefined
      }
    }
    reply.code(status).send(payload)
  })

  // ---------- 5) Graceful shutdown ----------
  const close = async () => {
    try { await app.close() } catch {}
    // prisma disconnect is handled by your onClose hook in app.js
    process.exit(0)
  }
  process.on("SIGTERM", close)
  process.on("SIGINT", close)
})