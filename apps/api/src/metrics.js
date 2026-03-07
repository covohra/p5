import fp from 'fastify-plugin';
import client from 'prom-client';
import { config } from '../config.js';

function getRouteLabel(req, reply) {
  return (
    reply?.context?.config?.url ||
    reply?.request?.routeOptions?.url ||
    req?.routeOptions?.url ||
    req?.routerPath ||
    req?.url ||
    'unknown'
  );
}

/**
 * Prometheus metrics at /metrics.
 * - process metrics (CPU/mem/GC/event loop)
 * - Counter + Histogram with low-cardinality labels
 * - Optional auth: set METRICS_TOKEN to require Authorization: Bearer <token>
 */
export default fp(async function metricsPlugin(app) {
  if (!config.metricsEnabled) return;

  const register = new client.Registry();
  client.collectDefaultMetrics({ register }); // process_, nodejs_

  const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  });

  const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.6, 1, 2, 5],
    registers: [register],
  });

  app.addHook('onRequest', (req, _reply, done) => {
    req.__start = process.hrtime.bigint();
    done();
  });

  app.addHook('onResponse', (req, reply, done) => {
    const route = getRouteLabel(req, reply);
    const labels = {
      method: req.method,
      route,
      status_code: String(reply.statusCode || 0),
    };

    httpRequestsTotal.inc(labels, 1);
    if (req.__start) {
      const seconds = Number(process.hrtime.bigint() - req.__start) / 1e9;
      httpRequestDuration.observe(labels, seconds);
    }
    done();
  });

  async function metricsGuard(req, reply) {
    const expect = config.metricsToken;
    if (!expect) return; // public if not set
    const auth = req.headers.authorization || '';
    const got = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    if (got !== expect) return reply.code(401).send({ message: 'unauthorized' });
  }

  app.get('/metrics', { preHandler: metricsGuard }, async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
});