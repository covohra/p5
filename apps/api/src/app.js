import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import pkg from '@prisma/client'
const { PrismaClient } = pkg

export function buildApp() {
  const app = Fastify({ logger: true })

  // CORS
  app.register(cors, { origin: true })

  // Prisma
  const prisma = new PrismaClient()
  app.decorate('prisma', prisma)

  // Probes (no rate limit)
  app.get('/health', async () => ({ ok: true, time: new Date().toISOString() }))
  app.get('/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { ready: true }
    } catch {
      return reply.code(503).send({ ready: false })
    }
  })

  // API with scoped rate limit
  app.register(async (api) => {
    // NOTE: On Fastify v5 + rate-limit v10, you don’t need/shouldn’t set { global:true } here.
    await api.register(rateLimit, {
      max: Number(process.env.RATE_LIMIT_MAX ?? 100),
      timeWindow: process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute'
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
            name: { type: 'string', minLength: 1, maxLength: 120, nullable: true }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: ['string', 'null'] },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' }
            }
          }
        }
      },
      handler: async (req, reply) => {
        const { email, name } = req.body ?? {}
        const user = await prisma.user.create({ data: { email, name } })
        return reply.code(201).send(user)
      }
    })

    // Delete user by id (for cleaning up smoke data)
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
          // Prisma P2025 = record not found
          if (err?.code === 'P2025') {
            return reply.code(404).send({ message: 'User not found' })
          }
          req.log.error({ err }, 'delete /users/:id failed')
          return reply.code(500).send({ message: 'Internal Server Error' })
        }
      }
    })
  }, { prefix: '/api' })

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  return app
}