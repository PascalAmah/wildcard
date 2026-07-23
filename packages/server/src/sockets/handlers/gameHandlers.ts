import type { Server as SocketIOServer, Socket } from "socket.io";
import type { RoomManager } from "../../rooms/RoomManager.js";
import type { CardColor, ErrorPayload } from "@wildcard/shared";
import { emitToPlayer, type SocketData } from "../socketServer.js";
import { logger } from "../../utils/logger.js";

export function registerGameHandlers(
  io: SocketIOServer,
  socket: Socket,
  roomManager: RoomManager,
): void {
  socket.on("game:playCard", (payload, ack) => {
    const data = socket.data as SocketData;
    if (!data?.roomId) {
      ack?.({ success: false, code: "NOT_IN_ROOM", error: "Not in a room" });
      return;
    }

    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      ack?.({ success: false, code: "ROOM_NOT_FOUND" });
      return;
    }

    try {
      const result = room.playCard(
        data.playerId,
        payload.cardId,
        payload.chosenColor as CardColor | undefined,
      );

      // Emit game:event for toasts — include chosen color for wilds
      const colorName = payload.chosenColor
        ? ` and chose ${payload.chosenColor}`
        : "";
      emitGameEvent(io, room.roomId, {
        type: "PLAY_CARD",
        actorId: data.playerId,
        cardId: payload.cardId,
        message: `${data.playerName} played a card${colorName}`,
      });

      if (result) {
        // Round over — already broadcast by Room.playCard()
        logger.info(
          `Round over in room ${room.roomId}: winner=${result.winnerId}`,
        );
      }

      ack?.({ success: true });
    } catch (err) {
      const msg = (err as Error).message;
      const code = mapErrorCode(msg);
      const errorPayload: ErrorPayload = {
        code,
        message: msg,
      };
      emitToPlayer(io, room.roomId, data.playerId, "error", errorPayload);
      ack?.({ success: false, code, error: msg });
    }
  });

  socket.on("game:drawCard", (payload, ack) => {
    const data = socket.data as SocketData;
    if (!data?.roomId) {
      ack?.({ success: false, code: "NOT_IN_ROOM" });
      return;
    }

    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      ack?.({ success: false, code: "ROOM_NOT_FOUND" });
      return;
    }

    try {
      room.drawCard(data.playerId);

      emitGameEvent(io, room.roomId, {
        type: "DRAW_CARD",
        actorId: data.playerId,
        message: `${data.playerName} drew a card`,
      });

      ack?.({ success: true });
    } catch (err) {
      const msg = (err as Error).message;
      const code = mapErrorCode(msg);
      emitToPlayer(io, room.roomId, data.playerId, "error", { code, message: msg });
      ack?.({ success: false, code, error: msg });
    }
  });

  socket.on("game:passTurn", (payload, ack) => {
    const data = socket.data as SocketData;
    if (!data?.roomId) {
      ack?.({ success: false, code: "NOT_IN_ROOM" });
      return;
    }

    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      ack?.({ success: false, code: "ROOM_NOT_FOUND" });
      return;
    }

    try {
      room.passTurn(data.playerId);

      emitGameEvent(io, room.roomId, {
        type: "PASS_TURN",
        actorId: data.playerId,
        message: `${data.playerName} passed`,
      });

      ack?.({ success: true });
    } catch (err) {
      const msg = (err as Error).message;
      const code = mapErrorCode(msg);
      emitToPlayer(io, room.roomId, data.playerId, "error", { code, message: msg });
      ack?.({ success: false, code, error: msg });
    }
  });

  socket.on("game:playWithout", (payload, ack) => {
    const data = socket.data as SocketData;
    if (!data?.roomId) {
      ack?.({ success: false, code: "NOT_IN_ROOM" });
      return;
    }

    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      ack?.({ success: false, code: "ROOM_NOT_FOUND" });
      return;
    }

    try {
      room.playWithout(payload.playerId);

      emitGameEvent(io, room.roomId, {
        type: "PLAY_WITHOUT",
        actorId: data.playerId,
        message: `A player was removed from the game`,
      });

      // Notify the room that the disconnected player was removed
      io.to(room.roomId).emit("player:reconnected", { playerId: payload.playerId });

      ack?.({ success: true });
    } catch (err) {
      const msg = (err as Error).message;
      emitToPlayer(io, room.roomId, data.playerId, "error", { code: "ERROR", message: msg });
      ack?.({ success: false, error: msg });
    }
  });
}

function emitGameEvent(
  io: SocketIOServer,
  roomId: string,
  event: { type: string; actorId: string; cardId?: string; message: string },
): void {
  io.to(roomId).emit("game:event", event);
}

function mapErrorCode(msg: string): ErrorPayload["code"] {
  if (msg === "NOT_YOUR_TURN") return "NOT_YOUR_TURN";
  if (msg === "ILLEGAL_MOVE") return "ILLEGAL_MOVE";
  return "ILLEGAL_MOVE";
}
