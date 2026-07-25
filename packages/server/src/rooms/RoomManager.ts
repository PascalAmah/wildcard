import type { ArenaTheme, ErrorCode } from "@wildcard/shared";
import { Room, type BroadcastFn } from "./Room.js";
import { RoomStore } from "../store/roomStore.js";
import { generateRoomCode } from "../utils/roomCode.js";
import { logger } from "../utils/logger.js";
import type { BotScheduler } from "../bots/BotScheduler.js";

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
  private botScheduler: BotScheduler | null;

  constructor(broadcast: RoomBroadcastFn, botScheduler?: BotScheduler) {
    this.store = new RoomStore();
    this.broadcast = broadcast;
    this.botScheduler = botScheduler ?? null;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Look up a room by code, falling back to Redis rehydration if the room
   * was evicted from the in-memory map (e.g. server restart).
   */
  async getOrRestoreRoom(roomId: string): Promise<Room | undefined> {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    const data = await this.store.getRoom(roomId);
    if (!data) return undefined;

    const room = Room.fromData(data, this.store, this.makeRoomBroadcast(roomId));
    this.rooms.set(roomId, room);
    room.onEmpty = () => this.removeEmptyRoom(roomId);
    return room;
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
    room.onEmpty = () => this.removeEmptyRoom(roomId);

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
    const room = await this.getOrRestoreRoom(roomId);
    if (!room) {
      throw makeError("ROOM_NOT_FOUND", "Room not found");
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
    // If the room is now empty, onEmpty → removeEmptyRoom handles
    // cleanup (map removal, bot detach, store deletion).
  }

  /** Delete an empty room. Safe to call on non-empty rooms (no-op). */
  removeEmptyRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.players.length > 0) return;
    this.rooms.delete(roomId);
    this.botScheduler?.detach(roomId);
    this.store.deleteRoom(roomId).catch(() => {});
    logger.info(`Room ${roomId} dissolved (empty)`);
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    this.botScheduler?.detach(roomId);
    await this.store.deleteRoom(roomId);
  }
}

function makeError(code: ErrorCode, message: string): Error & { code: ErrorCode } {
  const err = new Error(message) as Error & { code: ErrorCode };
  err.code = code;
  return err;
}
