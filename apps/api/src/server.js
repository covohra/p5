import { buildApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = '0.0.0.0';

const app = await buildApp();

const close = async () => {
  try { await app.close(); } catch {}
  process.exit(0);
};
process.on('SIGTERM', close);
process.on('SIGINT', close);

await app.listen({ port: PORT, host: HOST });
app.log.info(`API listening on http://${HOST}:${PORT}`);