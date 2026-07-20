import Fastify from "fastify";
import cors from "@fastify/cors";
import { createSocketServer, emitToPlayer } from "./sockets/socketServer.js";
import { RoomManager } from "./rooms/RoomManager.js";
import { BotScheduler } from "./bots/BotScheduler.js";
import { registerHealthRoute } from "./http/healthRoute.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  // ---- Fastify HTTP server ----
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  registerHealthRoute(app);

  // ---- Bot scheduler ----
  const botScheduler = new BotScheduler();

  // ---- Room manager ----
  // The broadcast function takes (roomId, event, data, playerIds?) and is
  // passed to each Room via RoomManager. The io instance is set after we
  // start listening.
  let io: ReturnType<typeof createSocketServer>;

  const roomManager = new RoomManager(
    (roomId: string, event: string, data: unknown, playerIds?: string[]) => {
      if (!io) return;

      if (Array.isArray(playerIds)) {
        for (const pid of playerIds) {
          emitToPlayer(io, roomId, pid, event, data);
        }
      } else {
        // Broadcast to entire room (lobby state, game events)
        io.to(roomId).emit(event, data);
      }
    },
  );

  // ---- Start HTTP server ----
  await app.listen({ port: config.port, host: "0.0.0.0" });
  logger.info(`HTTP server listening on port ${config.port}`);

  // ---- Attach Socket.IO ----
  io = createSocketServer(app.server, roomManager, botScheduler);

  // ---- Graceful shutdown ----
  const shutdown = async () => {
    logger.info("Shutting down...");
    botScheduler.cancelAll();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
