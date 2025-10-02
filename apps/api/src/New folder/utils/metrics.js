// Lightweight Prometheus metrics
import client from 'prom-client';

export function registerMetrics(app) {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Request duration (seconds)',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 3, 5],
  });

  register.registerMetric(httpRequests);
  register.registerMetric(httpDuration);

  app.addHook('onResponse', async (req, reply) => {
    const route = reply.context?.config?.url || req.routerPath || req.url || 'unknown';
    const labels = { method: req.method, route, status: String(reply.statusCode) };
    httpRequests.inc(labels, 1);
    const ms = typeof reply.getResponseTime === 'function' ? reply.getResponseTime() : 0;
    const sec = Number(ms) / 1000;
    if (!Number.isNaN(sec)) httpDuration.observe(labels, sec);
  });

  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}