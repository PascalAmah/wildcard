import type { GameState } from "@wildcard/shared";
import { getRedisClient } from "./redisClient.js";
import type { Redis } from "ioredis";

export interface RoomData {
  roomId: string;
  status: "WAITING" | "IN_PROGRESS" | "ROUND_OVER";
  hostId: string;
  players: RoomPlayerData[];
  maxPlayers: number;
  theme: "midnight" | "neon" | "sunset" | "forest";
  gameState?: GameState; // present only when IN_PROGRESS / ROUND_OVER
}

export interface RoomPlayerData {
  id: string;
  name: string;
  isBot: boolean;
  isReady: boolean;
}

const ROOM_KEY_PREFIX = "room:";
const TTL_SECONDS = 2 * 60 * 60; // 2 hours — abandoned rooms clean themselves up

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

export class RoomStore {
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  async getRoom(roomId: string): Promise<RoomData | null> {
    const raw = await this.redis.get(roomKey(roomId));
    if (!raw) return null;
    return JSON.parse(raw) as RoomData;
  }

  async setRoom(data: RoomData): Promise<void> {
    const key = roomKey(data.roomId);
    await this.redis.setex(key, TTL_SECONDS, JSON.stringify(data));
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.redis.del(roomKey(roomId));
  }

  async roomExists(roomId: string): Promise<boolean> {
    const exists = await this.redis.exists(roomKey(roomId));
    return exists === 1;
  }

  /** Refresh the TTL on an active room (e.g. on each state mutation). */
  async refreshTTL(roomId: string): Promise<void> {
    await this.redis.expire(roomKey(roomId), TTL_SECONDS);
  }
}
