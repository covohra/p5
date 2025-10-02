import client from 'prom-client'

const register = new client.Registry()
client.collectDefaultMetrics({ register })

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.6, 1, 2, 5]
})
register.registerMetric(httpRequestDuration)

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code']
})
register.registerMetric(httpRequestsTotal)

/**
 * Usage:
 *   app.register(metricsPlugin, { authPreHandler: app.verifyAuth })
 * If you don't pass authPreHandler, it falls back to METRICS_TOKEN (optional).
 */
export function metricsPlugin (app, opts = {}) {
  const authPreHandler =
    opts.authPreHandler ||
    (async (req, reply) => {
      // Fallback: simple bearer token just for /metrics
      const hdr = req.headers.authorization || ''
      const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : hdr
      if (!process.env.METRICS_TOKEN || token !== process.env.METRICS_TOKEN) {
        return reply.code(401).send({ message: 'unauthorized' })
      }
    })

  app.addHook('onRequest', (req, _reply, done) => {
    req.__start = process.hrtime.bigint()
    done()
  })

  app.addHook('onResponse', async (req, reply) => {
    // Fastify v5-safe route detection
    const route =
      reply?.request?.routeOptions?.url ||
      req?.routeOptions?.url ||
      req?.routerPath ||
      req?.url ||
      'unknown'

    const labels = {
      method: req.method,
      route,
      status_code: String(reply.statusCode)
    }

    httpRequestsTotal.inc(labels, 1)

    if (req.__start) {
      const seconds = Number(process.hrtime.bigint() - req.__start) / 1e9
      httpRequestDuration.observe(labels, seconds)
    }
  })

  app.get('/metrics', { preHandler: authPreHandler }, async (_req, reply) => {
    reply.header('Content-Type', register.contentType)
    return register.metrics()
  })
}