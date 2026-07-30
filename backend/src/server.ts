import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "Backend shutting down");

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Backend shutdown failed");
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
} catch (error) {
  app.log.error(error, "Backend failed to start");
  process.exit(1);
}