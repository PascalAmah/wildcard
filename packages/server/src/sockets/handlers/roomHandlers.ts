import type { Server as SocketIOServer, Socket } from "socket.io";
import type { RoomManager } from "../../rooms/RoomManager.js";
import type { BotScheduler } from "../../bots/BotScheduler.js";
import { type SocketData } from "../socketServer.js";
import { logger } from "../../utils/logger.js";

export function registerRoomHandlers(
  io: SocketIOServer,
  socket: Socket,
  roomManager: RoomManager,
  botScheduler: BotScheduler,
): void {
  socket.on("room:create", async (payload, ack) => {
    try {
      const { hostName, maxPlayers, theme } = payload;
      const hostId = socket.id;
      socket.data = { roomId: "", playerId: hostId, playerName: hostName } as SocketData;

      const room = await roomManager.createRoom({
        hostId,
        hostName,
        maxPlayers: Math.max(2, Math.min(10, maxPlayers ?? 4)),
        theme: theme ?? "midnight",
      });

      socket.data.roomId = room.roomId;
      await socket.join(room.roomId);
      botScheduler.attach(room);

      logger.info(`Room created: ${room.roomId} by ${hostName}`);

      ack?.({
        success: true,
        roomId: room.roomId,
        players: room.players,
      });

      broadcastLobbyState(io, room.roomId, room);
    } catch (err) {
      ack?.({ success: false, error: (err as Error).message });
    }
  });

  socket.on("room:join", async (payload, ack) => {
    try {
      const { roomCode, playerName } = payload;
      const playerId = socket.id;

      const room = await roomManager.joinRoom(roomCode, playerId, playerName);

      socket.data = {
        roomId: room.roomId,
        playerId,
        playerName,
      } as SocketData;

      await socket.join(room.roomId);

      logger.info(`Player ${playerName} joined room ${room.roomId}`);

      ack?.({
        success: true,
        roomId: room.roomId,
        players: room.players,
        theme: room.theme,
      });

      broadcastLobbyState(io, room.roomId, room);
    } catch (err) {
      const code = (err as Error & { code?: string }).code ?? "ERROR";
      ack?.({ success: false, code, error: (err as Error).message });
    }
  });

  socket.on("room:rejoin", async (payload, ack) => {
    try {
      const { roomCode, playerId } = payload;
      // Rejoin an existing game: look up the room (with Redis fallback),
      // verify the player is still in it.
      const room = await roomManager.getOrRestoreRoom(roomCode);
      if (!room) {
        ack?.({ success: false, code: "ROOM_NOT_FOUND", error: "Room not found" });
        return;
      }
      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        ack?.({ success: false, code: "NOT_IN_ROOM", error: "Player not in room" });
        return;
      }

      socket.data = {
        roomId: room.roomId,
        playerId,
        playerName: player.name,
      } as SocketData;

      await socket.join(room.roomId);

      // Cancel any auto-removal grace period timer for this player
      room.clearDisconnectTimer(playerId);

      logger.info(`Player ${player.name} rejoined room ${room.roomId}`);

      ack?.({ success: true, roomId: room.roomId, status: room.status });

      // Always send lobby state so the rejoined player knows the host ID
      // and player roster. This is critical for the scoreboard page where
      // the rematch button depends on knowing who the host is.
      broadcastLobbyState(io, room.roomId, room);

      if (room.status !== "WAITING") {
        // Emit game state directly on this socket. Using emitToPlayer here
        // risks missing the socket if it hasn't fully joined the room yet.
        const view = room.getClientView(playerId);
        if (view) {
          socket.emit("game:state", view);
        }
      }

      // Notify other players that this player reconnected
      io.to(room.roomId).emit("player:reconnected", { playerId, playerName: player.name });
    } catch (err) {
      ack?.({ success: false, error: (err as Error).message });
    }
  });

  socket.on("player:ready", (payload) => {
    const data = socket.data as SocketData;
    const room = roomManager.getRoom(data.roomId);
    if (!room) return;

    room.setReady(data.playerId, payload.ready ?? true);
    broadcastLobbyState(io, room.roomId, room);
  });

  socket.on("room:addBot", (payload, ack) => {
    const data = socket.data as SocketData;
    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      ack?.({ success: false, error: "Room not found" });
      return;
    }

    // Host-only check
    if (data.playerId !== room.hostId) {
      ack?.({ success: false, error: "Only the host can add bots" });
      return;
    }

    try {
      const botId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const botName = payload.name ?? `Bot ${room.players.filter((p) => p.isBot).length + 1}`;
      room.addBot(botId, botName);

      ack?.({ success: true, botId, botName });
      broadcastLobbyState(io, room.roomId, room);
    } catch (err) {
      ack?.({ success: false, error: (err as Error).message });
    }
  });

  socket.on("room:removeBot", (payload, ack) => {
    const data = socket.data as SocketData;
    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      ack?.({ success: false, error: "Room not found" });
      return;
    }

    if (data.playerId !== room.hostId) {
      ack?.({ success: false, error: "Only the host can remove bots" });
      return;
    }

    try {
      room.removeBot(payload.botId);
      ack?.({ success: true });
      broadcastLobbyState(io, room.roomId, room);
    } catch (err) {
      ack?.({ success: false, error: (err as Error).message });
    }
  });

  socket.on("room:setTheme", (payload) => {
    const data = socket.data as SocketData;
    const room = roomManager.getRoom(data.roomId);
    if (!room) return;

    if (data.playerId !== room.hostId) return;

    room.setTheme(payload.theme);
    broadcastLobbyState(io, room.roomId, room);
  });

  socket.on("room:rematch", (payload, ack) => {
    const data = socket.data as SocketData;
    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      ack?.({ success: false, error: "Room not found" });
      return;
    }

    if (data.playerId !== room.hostId) {
      ack?.({ success: false, error: "Only the host can start a rematch" });
      return;
    }

    try {
      room.rematch();
      logger.info(`Rematch started in room ${room.roomId}`);
      ack?.({ success: true });
    } catch (err) {
      logger.error(`Failed to start rematch in room ${room.roomId}:`, (err as Error).message);
      ack?.({ success: false, error: (err as Error).message });
    }
  });

  socket.on("room:start", (_, ack) => {
    const data = socket.data as SocketData;
    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      ack?.({ success: false, error: "Room not found" });
      return;
    }

    if (data.playerId !== room.hostId) {
      ack?.({ success: false, error: "Only the host can start the game" });
      return;
    }

    try {
      room.startGame();
      logger.info(`Game started in room ${room.roomId}`);
      ack?.({ success: true });
      // Game state is broadcast inside startGame()
    } catch (err) {
      logger.error(`Failed to start game in room ${room.roomId}:`, (err as Error).message);
      ack?.({ success: false, error: (err as Error).message });
    }
  });

  socket.on("disconnect", () => {
    const data = socket.data as SocketData;
    if (!data?.roomId) return;

    const room = roomManager.getRoom(data.roomId);
    if (!room) return;

    const player = room.players.find((p) => p.id === data.playerId);
    if (!player) return;

    // Notify the room with a 30s grace-period countdown
    io.to(data.roomId).emit("player:disconnected", {
      playerId: data.playerId,
      playerName: player.name,
      countdown: 30,
    });

    // Start the server-side auto-removal timer
    room.startDisconnectTimer(data.playerId);

    logger.info(`Player ${player.name} disconnected from room ${data.roomId} — 30s grace period started`);
  });

  socket.on("room:leave", () => {
    const data = socket.data as SocketData;
    if (!data?.roomId) return;

    const room = roomManager.getRoom(data.roomId);
    if (!room) return;

    const playerId = data.playerId;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;

    logger.info(`Player ${player.name} voluntarily left room ${data.roomId}`);

    // Remove the player immediately based on room status
    if (room.status === "IN_PROGRESS") {
      room.playWithout(playerId);
    } else {
      room.removePlayer(playerId);
    }

    // If the room is empty, clean it up
    if (room.players.length === 0) {
      roomManager.removeEmptyRoom(room.roomId);
    } else {
      // Broadcast updated lobby state
      broadcastLobbyState(io, room.roomId, room);

      io.to(data.roomId).emit("player:reconnected", {
        playerId,
        playerName: player.name,
        removed: true,
      });
    }

    // Clear disconnect timer if any (they left intentionally)
    room.clearDisconnectTimer(playerId);
  });

  socket.on("room:requestState", () => {
    const data = socket.data as SocketData;
    if (!data?.roomId) return;
    const room = roomManager.getRoom(data.roomId);
    if (!room) return;
    // Send the appropriate state based on room status
    if (room.status === "WAITING") {
      broadcastLobbyState(io, room.roomId, room);
    } else {
      // Game is in progress or round is over — send both game state
      // (for the table view) and lobby state (for host/player info)
      room.sendGameStateToPlayer(data.playerId);
      broadcastLobbyState(io, room.roomId, room);
    }
  });
}

function broadcastLobbyState(
  io: SocketIOServer,
  roomId: string,
  room: { players: unknown[]; hostId: string; maxPlayers: number; theme: string; status: string },
): void {
  io.to(roomId).emit("room:state", {
    players: room.players,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    theme: room.theme,
    status: room.status,
  });
}
