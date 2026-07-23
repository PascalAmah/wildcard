import Fastify from "fastify";
import cors from "@fastify/cors";
import { createSocketServer, emitToPlayer } from "./sockets/socketServer.js";
import { RoomManager } from "./rooms/RoomManager.js";
import { BotScheduler } from "./bots/BotScheduler.js";
import { registerHealthRoute } from "./http/healthRoute.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import type { Server as SocketIOServer } from "socket.io";

async function main(): Promise<void> {
  // ---- Fastify HTTP server ----
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  registerHealthRoute(app);

  // ---- Bot scheduler ----
  const botScheduler = new BotScheduler();

  // ---- Break the circular dependency between RoomManager and Socket.IO ----
  // RoomManager needs a broadcast callback, but the Socket.IO instance
  // doesn't exist yet. A mutable ref bridges the gap cleanly.
  const ioRef: { current: SocketIOServer | null } = { current: null };

  const broadcast = (
    roomId: string,
    event: string,
    data: unknown,
    playerIds?: string[],
  ) => {
    if (!ioRef.current) return;

    if (Array.isArray(playerIds)) {
      for (const pid of playerIds) {
        emitToPlayer(ioRef.current, roomId, pid, event, data);
      }
    } else {
      ioRef.current.to(roomId).emit(event, data);
    }
  };

  const roomManager = new RoomManager(broadcast);

  // ---- Attach Socket.IO ----
  ioRef.current = createSocketServer(app.server, roomManager, botScheduler);

  // ---- Start HTTP server ----
  await app.listen({ port: config.port, host: "0.0.0.0" });
  logger.info(`HTTP server listening on port ${config.port}`);

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
