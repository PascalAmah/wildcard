import { describe, it, expect, vi } from "vitest";
import { RoomManager } from "../src/rooms/RoomManager.js";
import type { RoomBroadcastFn } from "../src/rooms/RoomManager.js";

// Mock Redis by intercepting ioredis at module level.
// This prevents any actual Redis connections during tests.
vi.mock("ioredis", () => {
  const store = new Map<string, string>();
  const MockRedis = vi.fn(() => ({
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setex: vi.fn((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    exists: vi.fn((key: string) => Promise.resolve(store.has(key) ? 1 : 0)),
    expire: vi.fn(() => Promise.resolve(1)),
    quit: vi.fn(() => Promise.resolve("OK")),
    on: vi.fn(),
  }));
  return { default: MockRedis };
});

function makeBroadcast(): RoomBroadcastFn & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const fn = (roomId: string, event: string, data: unknown, playerIds?: string[]) => {
    calls.push([roomId, event, data, playerIds]);
  };
  (fn as unknown as { calls: unknown[][] }).calls = calls;
  return fn as RoomBroadcastFn & { calls: unknown[][] };
}

describe("RoomManager", () => {
  it("creates a room and assigns a 4-char code", async () => {
    const broadcast = makeBroadcast();
    const manager = new RoomManager(broadcast);

    const room = await manager.createRoom({
      hostId: "host1",
      hostName: "Alice",
      maxPlayers: 4,
      theme: "midnight",
    });

    expect(room.roomId).toHaveLength(4);
    expect(room.hostId).toBe("host1");
    expect(room.players).toHaveLength(1);
  });

  it("rejects joining with a bogus room code", async () => {
    const broadcast = makeBroadcast();
    const manager = new RoomManager(broadcast);

    await expect(
      manager.joinRoom("XXXX", "player2", "Bob"),
    ).rejects.toThrow("Room not found");
  });

  it("rejects joining a full room", async () => {
    const broadcast = makeBroadcast();
    const manager = new RoomManager(broadcast);

    const room = await manager.createRoom({
      hostId: "host1",
      hostName: "Alice",
      maxPlayers: 2,
      theme: "midnight",
    });

    // Host counts as player 1, so add one more to fill
    room.addPlayer("player2", "Bob");

    await expect(
      manager.joinRoom(room.roomId, "player3", "Charlie"),
    ).rejects.toThrow("Room is full");
  });

  it("rejects joining an in-progress room", async () => {
    const broadcast = makeBroadcast();
    const manager = new RoomManager(broadcast);

    const room = await manager.createRoom({
      hostId: "host1",
      hostName: "Alice",
      maxPlayers: 4,
      theme: "midnight",
    });

    // Add a second player so we can start
    room.addPlayer("player2", "Bob");
    room.startGame();

    await expect(
      manager.joinRoom(room.roomId, "player3", "Charlie"),
    ).rejects.toThrow("already started");
  });

  it("allows a valid player to join an existing room", async () => {
    const broadcast = makeBroadcast();
    const manager = new RoomManager(broadcast);

    const room = await manager.createRoom({
      hostId: "host1",
      hostName: "Alice",
      maxPlayers: 4,
      theme: "midnight",
    });

    const joined = await manager.joinRoom(room.roomId, "player2", "Bob");
    expect(joined.players).toHaveLength(2);
    expect(joined.players[1].name).toBe("Bob");
  });
});
