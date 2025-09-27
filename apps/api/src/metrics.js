// Tiny Prometheus metrics without extra deps
export function registerMetrics(app) {
  let total = 0;
  let errors = 0;

  app.addHook('onResponse', (_req, reply, done) => {
    total++;
    if (reply.statusCode >= 500) errors++;
    done();
  });

  app.get('/metrics', async (_req, reply) => {
    const body = [
      '# HELP p5_up Always 1',
      '# TYPE p5_up gauge',
      'p5_up 1',
      '# HELP p5_http_requests_total Total HTTP responses',
      '# TYPE p5_http_requests_total counter',
      `p5_http_requests_total ${total}`,
      '# HELP p5_http_errors_total 5xx HTTP responses',
      '# TYPE p5_http_errors_total counter',
      `p5_http_errors_total ${errors}`,
      '',
    ].join('\n');
    reply.header('Content-Type', 'text/plain; version=0.0.4').send(body);
  });
}