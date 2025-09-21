import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import pkg from "@prisma/client";
import "dotenv/config";

import { getVersionInfo } from "./version.js";
import { registerConfig } from "./plugins/config.js";
import { registerErrorHandling } from "./plugins/error.js";
import { registerAuth } from "./plugins/auth.js";
import { registerMetrics } from "./metrics.js";

const { PrismaClient } = pkg;

export function buildApp() {
  const app = Fastify({ logger: true });

  // 1) Config (env validation)
  registerConfig(app);

  // 2) CORS allowlist
  const allow = app.config.corsOrigins;
  app.register(cors, {
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl/health
      const ok = allow.includes("*") || allow.includes(origin);
      cb(null, ok);
    },
  });

  // 3) Prisma
  const prisma = new PrismaClient();
  app.decorate("prisma", prisma);

  // 4) Metrics
  registerMetrics(app);

  // 5) Probes & version (no auth)
  app.get("/health", async () => ({ ok: true, time: new Date().toISOString() }));
  app.get("/ready", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch {
      return reply.code(503).send({ ready: false });
    }
  });
  app.get("/version", async () => getVersionInfo());

  // 6) Auth (adds POST /auth/login and app.authGuard)
  registerAuth(app);

  // 7) Protected API with rate limit
  app.register(async (api) => {
    await api.register(rateLimit, {
      max: Number(app.config.rateLimitMax),
      timeWindow: app.config.rateLimitWindow,
    });

    // All routes in this scope require JWT
    api.addHook("preHandler", app.authGuard);

    // List users
    api.get("/users", async () => prisma.user.findMany());

    // Create user
    api.post("/users", {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email", maxLength: 254 },
            name: { type: "string", minLength: 1, maxLength: 120, nullable: true },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              name: { type: ["string", "null"] },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
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

    // Delete user by id
    api.delete("/users/:id", {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 1 } },
        },
      },
      handler: async (req, reply) => {
        const { id } = req.params;
        try {
          await prisma.user.delete({ where: { id } });
          return reply.code(204).send();
        } catch (err) {
          if (err?.code === "P2025") {
            return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
          }
          req.log.error({ err }, "delete /users/:id failed");
          return reply.code(500).send({ error: { code: "INTERNAL", message: "Internal Server Error" } });
        }
      },
    });
  }, { prefix: "/api" });

  // 8) Global error shape
  registerErrorHandling(app);

  // 9) Graceful shutdown
  app.addHook("onClose", async () => { await prisma.$disconnect(); });

  return app;
}