import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp();

app.listen({ port: config.port, host: config.host })
  .then(() => app.log.info(`✅ API on http://${config.host}:${config.port} (${config.env})`))
  .catch(err => {
    app.log.error(err, 'Failed to start');
    process.exit(1);
  });

// graceful shutdown for Fly/Docker
const close = async (signal) => {
  app.log.info({ signal }, 'Shutting down');
  try {
    await app.close();
    process.exit(0);
  } catch (e) {
    app.log.error(e, 'Error during shutdown');
    process.exit(1);
  }
};
process.on('SIGTERM', () => close('SIGTERM'));
process.on('SIGINT',  () => close('SIGINT'));