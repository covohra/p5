import client from "prom-client";

export function registerMetrics(app) {
  const register = client.register;
  client.collectDefaultMetrics({ prefix: "p5_", labels: { app: "api" } });

  const httpRequests = new client.Counter({
    name: "p5_http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status"],
  });

  app.addHook("onResponse", async (req, reply) => {
    const route = req.routeOptions?.url || req.url;
    httpRequests.labels(req.method, route, String(reply.statusCode)).inc();
  });

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });
}