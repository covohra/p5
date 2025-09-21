import jwt from "jsonwebtoken";

export function registerAuth(app) {
  const { jwtSecret, jwtExpiresIn } = app.config;

  // Guard
  app.decorate("authGuard", async (req, reply) => {
    if (!jwtSecret) return reply.code(501).send({ error: { code: "AUTH_DISABLED", message: "JWT not configured" } });
    const hdr = req.headers.authorization || "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (!m) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Missing Bearer token" } });
    try {
      req.user = jwt.verify(m[1], jwtSecret);
    } catch {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
    }
  });

  // Login
  app.post("/auth/login", {
    schema: {
      body: {
        type: "object",
        required: ["email"],
        additionalProperties: false,
        properties: {
          email: { type: "string", format: "email", maxLength: 254 },
          name: { type: "string", nullable: true },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            token: { type: "string" },
            token_type: { type: "string" },
            expires_in: { type: "number" },
          },
        },
      },
    },
  }, async (req) => {
    if (!jwtSecret) return { error: { code: "AUTH_DISABLED", message: "JWT not configured" } };
    const { email, name } = req.body;
    const token = jwt.sign({ sub: email, email, name }, jwtSecret, { expiresIn: jwtExpiresIn });
    return { token, token_type: "Bearer", expires_in: 60 * 60 }; // 1h simple default
  });
}