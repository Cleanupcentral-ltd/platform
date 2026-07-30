import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (
  app,
) => {
  app.get("/health", async () => {
    return {
      ok: true,
      service: "cleanup-central-backend",
      version: "0.1.0",
    };
  });
};