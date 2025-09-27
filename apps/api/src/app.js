import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import pkg from '@prisma/client';

import { readConfig } from './config.js';
import { registerErrorHandler } from './errors.js';
import { registerMetrics } from './metrics.js';
import authPlugin from './auth.js';
import { getVersionInfo } from './version.js'; // you already have this

const { PrismaClient } = pkg;

export async function buildApp() {
  const cfg = readConfig();

  const app = Fastify({
    logger: true,
    ajv: { customOptions: { removeAdditional: true, coerceTypes: true } },
  });

  // ---------- CORS (allowlist via env) ----------
  const allowAll = cfg.corsOrigins.includes('*');
  await app.register(cors, {
    origin: (origin, cb) => {
      if (allowAll || !origin || cfg.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('CORS'), false);
    },
  });

  // ---------- Prisma ----------
  const prisma = new PrismaClient();
  app.decorate('prisma', prisma);

  // ---------- Auth (public /auth/login + guard decorator) ----------
  await app.register(authPlugin, { jwtSecret: cfg.jwtSecret });

  // ---------- Metrics ----------
  registerMetrics(app);

  // ---------- Public endpoints ----------
  app.get('/version', async () => getVersionInfo());
  app.get('/health', async () => ({ ok: true, time: new Date().toISOString() }));
  app.get('/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch {
      return reply.code(503).send({ ready: false });
    }
  });

  // ---------- Protected API (/api/*) ----------
  app.register(async (api) => {
    await api.register(rateLimit, {
      max: cfg.rateLimitMax,
      timeWindow: cfg.rateLimitWindow,
    });

    // Guard all API routes (requires Authorization: Bearer <token>)
    api.addHook('preHandler', app.auth);

    // List users
    api.get('/users', async () => prisma.user.findMany());

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
        const { email, name } = req.body ?? {};
        const user = await prisma.user.create({ data: { email, name } });
        return reply.code(201).send(user);
      },
    });
  }, { prefix: '/api' });

  // ---------- Errors + graceful close ----------
  registerErrorHandler(app);
  app.addHook('onClose', async () => { await prisma.$disconnect(); });

  return app;
}