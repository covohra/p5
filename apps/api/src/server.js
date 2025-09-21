import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const app = buildApp();

app
  .listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`API listening on http://${HOST}:${PORT}`))
  .catch((err) => {
    app.log.error({ err }, "Failed to start server");
    process.exit(1);
  });

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    app.log.info({ sig }, "Shutting down...");
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  });
}