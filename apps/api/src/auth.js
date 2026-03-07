import fastifyJwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';
import pkg from '@prisma/client';
import { config } from '../config.js';

const { PrismaClient } = pkg;

/**
 * Auth plugin
 * - If JWT_SECRET missing → auth disabled, /auth/* returns 501, /api/* stays open.
 * - If JWT_SECRET set:
 *   - /auth/login works with env creds (AUTH_EMAIL/AUTH_PASSWORD) OR DB passwordHash.
 *   - /auth/register works only if User.passwordHash exists.
 * Exposes app.authenticate preHandler to guard /api/*.
 */
export default async function authPlugin(app) {
  const prisma = app.prisma ?? new PrismaClient();
  const JWT_SECRET = config.jwtSecret;

  // public paths (ungated)
  const PUBLIC = new Set([
    '/health',
    '/ready',
    '/version',
    '/metrics',
    '/auth/login',
    '/auth/register',
  ]);

  // probe for User.passwordHash column (tolerate failures)
  let hasPasswordHash = false;
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name ILIKE 'user' AND column_name = 'passwordhash' LIMIT 1
    `);
    hasPasswordHash = Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    app.log.warn({ err }, 'could not probe information_schema; assuming no passwordHash');
  }

  // no JWT_SECRET → expose stubs, do NOT protect /api
  if (!JWT_SECRET) {
    app.log.warn('JWT disabled: missing JWT_SECRET. /api/* is OPEN; /auth/* returns 501.');
    app.all('/auth/login', async (_req, reply) =>
      reply.code(501).send({ error: { code: 'AUTH_DISABLED', message: 'JWT not configured' } })
    );
    app.all('/auth/register', async (_req, reply) =>
      reply.code(501).send({ error: { code: 'AUTH_DISABLED', message: 'JWT not configured' } })
    );
    app.decorate('authenticate', async (_req, _reply) => {});
    return;
  }

  await app.register(fastifyJwt, { secret: JWT_SECRET });

  const EXPECT_EMAIL = config.authEmail;
  const EXPECT_PASS = config.authPassword;

  // --- /auth/register (only if DB has passwordHash) ---
  app.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        additionalProperties: false,
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 1, maxLength: 120, nullable: true },
          password: { type: 'string', minLength: 6, maxLength: 200 },
        },
      },
    },
  }, async (req, reply) => {
    if (!hasPasswordHash) {
      return reply.code(501).send({
        error: { code: 'REGISTER_UNAVAILABLE', message: 'Add User.passwordHash to enable registration.' },
      });
    }
    const { email, name, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, name, passwordHash } });
    const token = await app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '8h' });
    return reply.code(201).send({ token, token_type: 'Bearer', expires_in: 8 * 60 * 60 });
  });

  // --- /auth/login (env creds or DB path) ---
  app.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        additionalProperties: false,
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }, // needed if EXPECT_PASS or DB path
        },
      },
    },
  }, async (req, reply) => {
    const { email, password } = req.body ?? {};

    // env creds path (bootstrap)
    if (EXPECT_EMAIL || EXPECT_PASS) {
      if (EXPECT_EMAIL && email !== EXPECT_EMAIL) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      }
      if (EXPECT_PASS && password !== EXPECT_PASS) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      }
      const token = await app.jwt.sign({ sub: email, email }, { expiresIn: '8h' });
      return { token, token_type: 'Bearer', expires_in: 8 * 60 * 60 };
    }

    // DB path
    if (hasPasswordHash) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      }
      const ok = await bcrypt.compare(password ?? '', user.passwordHash);
      if (!ok) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      const token = await app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '8h' });
      return { token, token_type: 'Bearer', expires_in: 8 * 60 * 60 };
    }

    return reply.code(501).send({
      error: { code: 'AUTH_NOT_CONFIGURED', message: 'Set AUTH_EMAIL/AUTH_PASSWORD or add User.passwordHash.' },
    });
  });

  // expose a guard for /api/*
  app.decorate('authenticate', async (req, reply) => {
    const path = req.routerPath || req.raw?.url || req.url || '';
    if (PUBLIC.has(path)) return;
    if (path.startsWith('/api')) {
      try { await req.jwtVerify(); }
      catch { return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } }); }
    }
  });
}