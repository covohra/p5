import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import pkg from '@prisma/client'
import client from 'prom-client'
import { getVersionInfo } from './version.js'

const { PrismaClient } = pkg

// ---------- metrics setup (registry + default metrics) ----------
const registry = new client.Registry()
client.collectDefaultMetrics({ register: registry })

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
})
registry.registerMetric(httpRequestsTotal)

const httpRequestDurationMs = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
})
registry.registerMetric(httpRequestDurationMs)

export function buildApp() {
  // ---------- fail fast on missing critical env ----------
  for (const k of ['DATABASE_URL']) {
    if (!process.env[k]) throw new Error(`Missing required env: ${k}`)
  }

  const app = Fastify({ logger: true })

  // ---------- CORS (env-driven allowlist) ----------
  // CORS_ORIGINS="*" or "https://a.com,https://b.com"
  const corsOrigins = (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  app.register(cors, {
    origin(origin, cb) {
      // allow server-to-server / curl (no Origin header)
      if (!origin) return cb(null, true)
      if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        return cb(null, true)
      }
      return cb(null, false)
    },
    credentials: true,
  })

  // ---------- Prisma ----------
  const prisma = new PrismaClient()
  app.decorate('prisma', prisma)

  // ---------- request timing for metrics ----------
  app.addHook('onRequest', (req, _reply, done) => {
    req._start = process.hrtime.bigint()
    done()
  })

  app.addHook('onResponse', async (req, reply) => {
    const route =
      req.routeOptions?.url ??
      reply.context?.config?.url ??
      req.url ??
      'unknown'

    const labels = {
      method: req.method,
      route,
      status_code: String(reply.statusCode),
    }

    try {
      httpRequestsTotal.inc(labels)
      if (req._start) {
        const ms = Number(process.hrtime.bigint() - req._start) / 1e6
        httpRequestDurationMs.observe(labels, ms)
      }
    } catch {
      // never crash on metrics
    }
  })

  // ---------- Version / Probes ----------
  app.get('/version', async () => getVersionInfo())
  app.get('/health', async () => ({ ok: true, time: new Date().toISOString() }))
  app.get('/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { ready: true }
    } catch {
      return reply.code(503).send({ ready: false })
    }
  })

  // ---------- /metrics (optionally protected) ----------
  const metricsPreHandler = (req, reply, done) => {
    const required = process.env.METRICS_TOKEN
    if (!required) return done() // open if no token configured
    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (tok === required) return done()
    reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Metrics token required' } })
  }
  app.get('/metrics', { preHandler: metricsPreHandler }, async (_req, reply) => {
    const body = await registry.metrics()
    reply.header('Content-Type', registry.contentType).send(body)
  })

  // ---------- API (scoped rate limit) ----------
  app.register(
    async (api) => {
      await api.register(rateLimit, {
        max: Number(process.env.RATE_LIMIT_MAX ?? 100),
        timeWindow: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute',
      })

      // 🔐 Minimal auth (env-toggled). Require Bearer token only if AUTH_REQUIRED === "true"
      api.addHook('onRequest', (req, reply, done) => {
        if (process.env.AUTH_REQUIRED === 'true') {
          const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
          const expected = String(process.env.AUTH_TOKEN || '')
          if (!tok || tok !== expected) {
            reply.code(401).send({
              error: { code: 'UNAUTHENTICATED', message: 'Missing/invalid token' },
            })
            return
          }
        }
        done()
      })

      // List users
      api.get('/users', async () => prisma.user.findMany())

      // Create user
      api.post('/users', {
        schema: {
          body: {
            type: 'object',
            required: ['email'],
            additionalProperties: false,
            properties: {
              email: { type: 'string', format: 'email', maxLength: 254 },
              name: { type: 'string', minLength: 1, maxLength: 120, nullable: true },
            },
          },
          response: {
            201: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
        handler: async (req, reply) => {
          const { email, name } = req.body ?? {}
          const user = await prisma.user.create({ data: { email, name } })
          return reply.code(201).send(user)
        },
      })

      // Delete user (for smoke-test cleanup)
      api.delete('/users/:id', {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string', minLength: 1 } },
          },
        },
        handler: async (req, reply) => {
          const { id } = req.params
          try {
            await prisma.user.delete({ where: { id } })
            return reply.code(204).send()
          } catch (err) {
            if (err?.code === 'P2025') {
              return reply.code(404).send({ error: { code: 'P2025', message: 'User not found' } })
            }
            req.log.error({ err }, 'delete /users/:id failed')
            return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } })
          }
        },
      })
    },
    { prefix: '/api' }
  )

  // ---------- 404 JSON ----------
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` },
    })
  })

  // ---------- Global error handler (consistent JSON + Prisma mapping) ----------
  app.setErrorHandler((err, _req, reply) => {
    const isValidation = err.validation || err.code === 'FST_ERR_VALIDATION'
    let status = isValidation ? 400 : err.statusCode || 500
    let code = err.code || 'INTERNAL_ERROR'
    let message = isValidation ? 'Validation error' : err.message || 'Internal Server Error'
    const details = isValidation ? err.validation : undefined

    if (typeof code === 'string' && code.startsWith('P')) {
      if (code === 'P2002') status = 409
      else if (code === 'P2025') status = 404
      else status = 400
    }

    reply.code(status).send({ error: { code, message, details } })
  })

  // ---------- Graceful shutdown ----------
  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  return app
}