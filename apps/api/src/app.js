import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { PrismaClient } from '@prisma/client'

export function buildApp() {
  const app = Fastify({ logger: true })
  app.register(cors, { origin: true })

  const prisma = new PrismaClient()
  app.decorate('prisma', prisma)

  // Probes (no rate limit)
  app.get('/health', async () => ({ ok: true, time: new Date().toISOString() }))
  app.get('/ready', async (req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { ready: true }
    } catch {
      return reply.code(503).send({ ready: false })
    }
  })

  // API (rate limited)
  app.register(async (api) => {
    await api.register(rateLimit, {
      global: true,
      max: Number(process.env.RATE_LIMIT_MAX ?? 100),
      timeWindow: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute'
    })

    api.get('/users', async () => prisma.user.findMany())

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
  }, { prefix: '/api' })

  app.addHook('onClose', async () => { await prisma.$disconnect() })
  return app
}