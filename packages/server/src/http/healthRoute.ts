import type { FastifyInstance } from "fastify";

export function registerHealthRoute(app: FastifyInstance): void {
  app.get("/health", async (_request, reply) => {
    reply.status(200).send({ status: "ok", timestamp: Date.now() });
  });
}
