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
    });

    // Simple ping/pong for client-side latency measurement
    socket.on("ping", () => {
      socket.emit("pong");
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
    // First try: find the socket in the target room by playerId
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      for (const socketId of room) {
        const sock = io.sockets.sockets.get(socketId);
        if (sock?.data?.playerId === playerId) {
          sock.emit(event, data);
          return;
        }
      }
    }

    // Fallback: the socket might not be in the room yet (e.g. rejoin in
    // progress). Search all connected sockets for the matching playerId.
    for (const [, sock] of io.sockets.sockets) {
      if (sock.data?.playerId === playerId) {
        sock.emit(event, data);
        return;
      }
    }
  } else {
    io.to(roomId).emit(event, data);
  }
}
