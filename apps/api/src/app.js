import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import jwtPlugin from '@fastify/jwt'
import pkg from '@prisma/client'
import { getVersionInfo } from './version.js'
import * as prom from 'prom-client'
import { getMailer, sendMail } from './email.js'
import errorPlugin from './errors.js'

const { PrismaClient } = pkg

const REQUIRE_AUTH = Number(process.env.REQUIRE_AUTH ?? 0) === 1
const METRICS_ENABLED = String(process.env.METRICS_ENABLED ?? 'false').toLowerCase() === 'true'
const METRICS_TOKEN = process.env.METRICS_TOKEN || ''
const JWT_SECRET = process.env.JWT_SECRET

export function buildApp() {
  const app = Fastify({ logger: true })

  // ---- CORS allowlist (comma list or *) ----
  const corsOrigins = (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      return cb(null, corsOrigins.includes('*') || corsOrigins.includes(origin))
    }
  })

  // ---- Prisma ----
  const prisma = new PrismaClient()
  app.decorate('prisma', prisma)

  // ---- Email (mailer) ----
  app.decorate('mailer', getMailer())
  app.decorate('sendMail', sendMail)

  // ---- Global error handler ----
  app.register(errorPlugin)

  // ---- JWT (only if configured) ----
  if (JWT_SECRET) {
    app.register(jwtPlugin, { secret: JWT_SECRET })
  }

  // ---- Metrics (Prometheus) ----
  if (METRICS_ENABLED) {
    const registry = new prom.Registry()
    prom.collectDefaultMetrics({ register: registry })

    const reqCounter = new prom.Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['route', 'method', 'status_code'],
      registers: [registry]
    })

    const reqDuration = new prom.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['route', 'method', 'status_code'],
      buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [registry]
    })

    app.addHook('onRequest', async (req) => {
      req.requestStartTime = process.hrtime.bigint()
    })

    app.addHook('onResponse', async (req, reply) => {
      const route = req.routeOptions?.url || req.url || 'unknown'
      const labels = {
        route,
        method: req.method,
        status_code: String(reply.statusCode)
      }

      reqCounter.inc(labels)

      if (req.requestStartTime) {
        const durationNs = process.hrtime.bigint() - req.requestStartTime
        const durationSeconds = Number(durationNs) / 1e9
        reqDuration.observe(labels, durationSeconds)
      }
    })

    app.get('/metrics', async (req, reply) => {
      if (METRICS_TOKEN) {
        const auth = req.headers['authorization'] || ''
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
        if (token !== METRICS_TOKEN) {
          return reply.code(401).send({
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' }
          })
        }
      }

      reply.header('Content-Type', registry.contentType)
      return registry.metrics()
    })
  }

  // ---- Probes (always open) ----
  app.get('/health', async () => ({
    ok: true,
    time: new Date().toISOString()
  }))

  app.get('/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { ready: true }
    } catch (err) {
      app.log.error({ err }, 'Readiness check failed')
      return reply.code(503).send({ ready: false })
    }
  })

  app.get('/version', async () => getVersionInfo())

  // ---- Simple env-backed login (optional) ----
  app.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        additionalProperties: false,
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', minLength: 1, maxLength: 200 }
        }
      }
    }
  }, async (req, reply) => {
    if (!JWT_SECRET) {
      return reply.code(501).send({
        error: { code: 'NO_JWT', message: 'JWT not configured' }
      })
    }

    const { email, password } = req.body ?? {}
    const envEmail = process.env.AUTH_EMAIL || ''
    const envPass = process.env.AUTH_PASSWORD || ''

    if (!envEmail || !envPass) {
      return reply.code(501).send({
        error: { code: 'NO_CREDS', message: 'Login disabled (no AUTH_EMAIL/PASSWORD)' }
      })
    }

    if (email !== envEmail || password !== envPass) {
      return reply.code(401).send({
        error: { code: 'BAD_CREDENTIALS', message: 'Invalid credentials' }
      })
    }

    const token = app.jwt.sign({ sub: email }, { expiresIn: '2h' })
    return reply.send({ token })
  })

  // ---- Auth guard (only when REQUIRE_AUTH=1) ----
  const openPaths = new Set(['/health', '/ready', '/version', '/metrics', '/auth/login'])

  app.addHook('preHandler', async (req, reply) => {
    if (!REQUIRE_AUTH) return

    const routePath = req.routeOptions?.url || req.url || ''
    if (openPaths.has(routePath)) return

    if (!JWT_SECRET) {
      return reply.code(501).send({
        error: { code: 'NO_JWT', message: 'JWT not configured' }
      })
    }

    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Bearer token required' }
      })
    }
  })

  // ---- API routes plugin ----
  async function apiRoutes(api) {
    await api.register(rateLimit, {
      max: Number(process.env.RATE_LIMIT_MAX ?? 100),
      timeWindow: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute'
    })

    // List users
    api.get('/users', async () => api.prisma.user.findMany())

    // Create user
    api.post('/users', {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', format: 'email', maxLength: 254 },
            name: { type: 'string', minLength: 1, maxLength: 120, nullable: true }
          }
        }
      }
    }, async (req, reply) => {
      const { email, name } = req.body ?? {}

      const user = await api.prisma.user.create({
        data: { email, name }
      })

      return reply.code(201).send(user)
    })

    // Delete user
    api.delete('/users/:id', {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 }
          }
        }
      }
    }, async (req, reply) => {
      const { id } = req.params

      try {
        await api.prisma.user.delete({ where: { id } })
        return reply.code(204).send()
      } catch (err) {
        if (err?.code === 'P2025') {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'User not found' }
          })
        }

        req.log.error({ err }, 'delete /users/:id failed')

        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' }
        })
      }
    })

    // Dev email test
    api.post('/dev/send-test-email', {
      schema: {
        body: {
          type: 'object',
          properties: {
            to: { type: 'string', format: 'email' }
          },
          additionalProperties: false
        }
      }
    }, async (req, reply) => {
      const to = req.body?.to || 'test@example.com'

      await api.sendMail({
        to,
        subject: 'P5 Mail Test',
        text: 'Hello from P5 API',
        html: '<p>Hello from <strong>P5 API</strong></p>'
      })

      return reply.code(202).send({ sent: true, to })
    })
  }

  // ---- API (rate-limited) ----
  app.register(apiRoutes, { prefix: '/api' })

  // ---- Graceful shutdown ----
  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  return app
}