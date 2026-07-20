import type { ArenaTheme, ErrorCode } from "@wildcard/shared";
import { Room, type BroadcastFn } from "./Room.js";
import { RoomStore } from "../store/roomStore.js";
import { generateRoomCode } from "../utils/roomCode.js";
import { logger } from "../utils/logger.js";

export type RoomBroadcastFn = (
  roomId: string,
  event: string,
  data: unknown,
  playerIds?: string[],
) => void;

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private store: RoomStore;
  private broadcast: RoomBroadcastFn;

  constructor(broadcast: RoomBroadcastFn) {
    this.store = new RoomStore();
    this.broadcast = broadcast;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /** Update the broadcast function after Socket.IO has been initialized. */
  setBroadcast(broadcast: RoomBroadcastFn): void {
    this.broadcast = broadcast;
  }

  private makeRoomBroadcast(roomId: string): BroadcastFn {
    return (event, data, playerIds) => {
      this.broadcast(roomId, event, data, playerIds);
    };
  }

  async createRoom(params: {
    hostId: string;
    hostName: string;
    maxPlayers: number;
    theme: ArenaTheme;
  }): Promise<Room> {
    const roomId = await generateRoomCode(
      (code) => this.store.roomExists(code),
    );

    const room = new Room(
      {
        roomId,
        status: "WAITING",
        hostId: params.hostId,
        players: [
          {
            id: params.hostId,
            name: params.hostName,
            isBot: false,
            isReady: false,
          },
        ],
        maxPlayers: params.maxPlayers,
        theme: params.theme,
      },
      this.store,
      this.makeRoomBroadcast(roomId),
    );

    this.rooms.set(roomId, room);
    await this.store.setRoom({
      roomId,
      status: "WAITING",
      hostId: params.hostId,
      players: [
        {
          id: params.hostId,
          name: params.hostName,
          isBot: false,
          isReady: false,
        },
      ],
      maxPlayers: params.maxPlayers,
      theme: params.theme,
    });

    logger.info(`Room ${roomId} created by ${params.hostName}`);
    return room;
  }

  async joinRoom(
    roomId: string,
    playerId: string,
    playerName: string,
  ): Promise<Room> {
    let room = this.rooms.get(roomId);
    if (!room) {
      const data = await this.store.getRoom(roomId);
      if (!data) {
        throw makeError("ROOM_NOT_FOUND", "Room not found");
      }
      room = Room.fromData(data, this.store, this.makeRoomBroadcast(roomId));
      this.rooms.set(roomId, room);
    }

    if (room.status !== "WAITING") {
      throw makeError("ROOM_IN_PROGRESS", "That table's game has already started");
    }

    if (room.players.length >= room.maxPlayers) {
      throw makeError("ROOM_FULL", "Room is full");
    }

    room.addPlayer(playerId, playerName);
    logger.info(`Player ${playerName} joined room ${roomId}`);

    return room;
  }

  removePlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.removePlayer(playerId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      this.store.deleteRoom(roomId).catch(() => {});
      logger.info(`Room ${roomId} deleted (empty)`);
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    await this.store.deleteRoom(roomId);
  }
}

function makeError(code: ErrorCode, message: string): Error & { code: ErrorCode } {
  const err = new Error(message) as Error & { code: ErrorCode };
  err.code = code;
  return err;
}
