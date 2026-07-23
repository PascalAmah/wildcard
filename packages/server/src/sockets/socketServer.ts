import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import type { RoomManager } from "../rooms/RoomManager.js";
import type { BotScheduler } from "../bots/BotScheduler.js";
import { registerRoomHandlers } from "./handlers/roomHandlers.js";
import { registerGameHandlers } from "./handlers/gameHandlers.js";
import { logger } from "../utils/logger.js";

export interface SocketData {
  roomId: string;
  playerId: string;
  playerName: string;
}

export function createSocketServer(
  httpServer: HttpServer,
  roomManager: RoomManager,
  botScheduler: BotScheduler,
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Each socket is associated with a room + player via the first event they emit
    // (room:join or room:create). We store this on the socket's data object.

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
      // Reconnect grace period is handled by the client reconnecting
      // and re-emitting room:join with the same playerId.
      // For now, we don't immediately remove the player — the Room
      // keeps their seat. If they don't reconnect within the grace
      // period (60s per the design), the client won't rejoin.
      // The server doesn't auto-remove players on disconnect.
    });

    // Store room/player info on the socket data
    socket.data = {} as SocketData;

    registerRoomHandlers(io, socket, roomManager, botScheduler);
    registerGameHandlers(io, socket, roomManager);
  });

  return io;
}

/**
 * Helper: broadcast to a specific player in a room.
 * If playerId is provided, emit only to that player's socket.
 */
export function emitToPlayer(
  io: SocketIOServer,
  roomId: string,
  playerId: string | undefined,
  event: string,
  data: unknown,
): void {
  if (playerId) {
    // Find the socket for this player in this room
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    for (const socketId of room) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock?.data?.playerId === playerId) {
        sock.emit(event, data);
        return;
      }
    }
  } else {
    io.to(roomId).emit(event, data);
  }
}
