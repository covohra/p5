import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import pkg from '@prisma/client'
import prodCore from './plugins/prod-core.js'   // <-- our single plugin (auth/errors/metrics)
import { getVersionInfo } from './version.js'   // you already have this

const { PrismaClient } = pkg

export async function buildApp() {
  const app = Fastify({ logger: true })

  // CORS — allowlist via env CORS_ORIGINS (comma-separated) or '*'
  const corsOrigins = (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map(s => s.trim())
  const allowAll = corsOrigins.includes('*')

  await app.register(cors, {
    origin(origin, cb) {
      // allow server-to-server / curl (no origin) and any in allowlist
      if (allowAll || !origin || corsOrigins.includes(origin)) return cb(null, true)
      cb(null, false)
    }
  })

  // Prisma
  const prisma = new PrismaClient()
  app.decorate('prisma', prisma)

  // Version + probes (no auth)
  app.get('/version', async () => getVersionInfo())
  app.get('/health', async () => ({ ok: true, time: new Date().toISOString() }))
  app.get('/ready', async (_req, reply) => {
    try { await prisma.$queryRaw`SELECT 1`; return { ready: true } }
    catch { return reply.code(503).send({ ready: false }) }
  })

  // Prod-ready glue (JWT, optional auth gate, error contract, /metrics)
  await app.register(prodCore)

  // Protected API
  await app.register(async (api) => {
    await api.register(rateLimit, {
      max: Number(process.env.RATE_LIMIT_MAX ?? 100),
      timeWindow: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute'
    })

    // If AUTH_REQUIRED=true (via env/secret), prodCore’s preHandler will enforce JWT.
    // Otherwise, it is open during dev/CI.

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
            name: { type: 'string', minLength: 1, maxLength: 120, nullable: true }
          }
        }
      },
      handler: async (req, reply) => {
        const { email, name } = req.body ?? {}
        const user = await prisma.user.create({ data: { email, name } })
        return reply.code(201).send(user)
      }
    })

    // Delete user by id
    api.delete('/users/:id', {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } }
        }
      },
      handler: async (req, reply) => {
        const { id } = req.params
        try {
          await prisma.user.delete({ where: { id } })
          return reply.code(204).send()
        } catch (err) {
          if (err?.code === 'P2025') {
            return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } })
          }
          req.log.error({ err }, 'delete /users/:id failed')
          return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Internal Server Error' } })
        }
      }
    })
  }, { prefix: '/api' })

  app.addHook('onClose', async () => { await prisma.$disconnect() })
  return app
}