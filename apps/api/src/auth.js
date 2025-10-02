import fastifyJwt from '@fastify/jwt'

export async function authPlugin(app, cfg) {
  if (!cfg.jwtSecret) {
    app.log.info('JWT disabled (no JWT_SECRET). /auth/login returns 501.')
    app.get('/auth/login', async (_req, reply) =>
      reply.code(501).send({ error: { code: 'AUTH_DISABLED', message: 'JWT not configured' } })
    )
    return
  }

  await app.register(fastifyJwt, { secret: cfg.jwtSecret })

  // Minimal login: email-only; returns a JWT
  app.post(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          additionalProperties: false,
          properties: { email: { type: 'string', format: 'email' } },
        },
      },
    },
    async (req) => {
      const { email } = req.body
      const token = await app.jwt.sign({ sub: email, email }, { expiresIn: '8h' })
      return { token }
    },
  )

  // Guard /api/* (leave health/ready/version/metrics & /auth/login open)
  app.addHook('preHandler', async (req, reply) => {
    if (['/health', '/ready', '/version', '/metrics', '/auth/login'].includes(req.routerPath)) return
    if (req.routerPath?.startsWith('/api')) {
      try {
        await req.jwtVerify()
      } catch {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } })
      }
    }
  })
}
