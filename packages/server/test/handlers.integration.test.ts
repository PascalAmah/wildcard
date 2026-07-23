import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { io as Client, type Socket as ClientSocket } from "socket.io-client";
import { createSocketServer, emitToPlayer } from "../src/sockets/socketServer.js";
import { RoomManager } from "../src/rooms/RoomManager.js";
import type { RoomBroadcastFn } from "../src/rooms/RoomManager.js";
import { BotScheduler } from "../src/bots/BotScheduler.js";
import type { Server as HttpServer } from "node:http";
import type { Server as SocketIOServer } from "socket.io";

// Mock Redis for the entire test file
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

describe("Full game over sockets (integration)", () => {
  let httpServer: HttpServer;
  let io: SocketIOServer;
  let roomManager: RoomManager;
  let botScheduler: BotScheduler;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    const app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    app.get("/health", async (_req, reply) => {
      reply.status(200).send({ status: "ok" });
    });

    botScheduler = new BotScheduler();

    // Create a placeholder broadcast — we'll set the real one after io is ready
    roomManager = new RoomManager(() => {});

    await app.listen({ port: 0, host: "0.0.0.0" });
    httpServer = app.server;
    const addr = httpServer.address();
    port = typeof addr === "object" && addr ? addr.port : 3001;
    baseUrl = `http://localhost:${port}`;

    // Create Socket.IO and wire the broadcast
    io = createSocketServer(httpServer, roomManager, botScheduler);

    // Now set the real broadcast function that uses io
    const realBroadcast: RoomBroadcastFn = (
      roomId: string,
      event: string,
      data: unknown,
      playerIds?: string[],
    ) => {
      if (Array.isArray(playerIds)) {
        for (const pid of playerIds) {
          emitToPlayer(io, roomId, pid, event, data);
        }
      } else {
        io.to(roomId).emit(event, data);
      }
    };
    roomManager.setBroadcast(realBroadcast);
  }, 15000);

  afterAll(async () => {
    botScheduler.cancelAll();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function connectClient(): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = Client(baseUrl, {
        transports: ["websocket"],
        timeout: 5000,
        reconnection: false,
      });
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (err) => reject(err));
      setTimeout(() => reject(new Error("Connection timeout")), 5000);
    });
  }

  it(
    "plays a full game between two humans and two bots",
    async () => {
      // Connect two human players
      const alice = await connectClient();
      const bob = await connectClient();

      // Alice creates room
      const createResult = await new Promise<{
        success: boolean;
        roomId: string;
        players: unknown[];
      }>((resolve) => {
        alice.emit(
          "room:create",
          { hostName: "Alice", maxPlayers: 4, theme: "midnight" },
          resolve,
        );
      });

      expect(createResult.success).toBe(true);
      const { roomId } = createResult;

      // Bob joins
      const joinResult = await new Promise<{
        success: boolean;
        roomId: string;
      }>((resolve) => {
        bob.emit(
          "room:join",
          { roomCode: roomId, playerName: "Bob" },
          resolve,
        );
      });

      expect(joinResult.success).toBe(true);

      // Add two bots
      const addBot1 = await new Promise<{ success: boolean }>((resolve) => {
        alice.emit("room:addBot", { name: "Bot1" }, resolve);
      });
      expect(addBot1.success).toBe(true);

      const addBot2 = await new Promise<{ success: boolean }>((resolve) => {
        alice.emit("room:addBot", { name: "Bot2" }, resolve);
      });
      expect(addBot2.success).toBe(true);

      // Collect game states
      const aliceStates: unknown[] = [];
      const bobStates: unknown[] = [];
      alice.on("game:state", (state) => aliceStates.push(state));
      bob.on("game:state", (state) => bobStates.push(state));

      // Start the game
      const startResult = await new Promise<{ success: boolean }>((resolve) => {
        alice.emit("room:start", {}, resolve);
      });

      expect(startResult.success).toBe(true);

      // Wait for bots to play and game to progress
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Both players should have received game state updates
      expect(aliceStates.length).toBeGreaterThan(0);
      expect(bobStates.length).toBeGreaterThan(0);

      // Each state should be a ClientView with the right shape
      const firstState = aliceStates[0] as Record<string, unknown>;
      expect(firstState).toHaveProperty("roomId");
      expect(firstState).toHaveProperty("myHand");
      expect(firstState).toHaveProperty("topCard");
      expect(firstState).toHaveProperty("players");
      expect(firstState).toHaveProperty("activeColor");

      // Alice's hand should be visible
      expect(Array.isArray(firstState.myHand)).toBe(true);

      // Players should have handCount, not raw hand
      const players = firstState.players as Array<Record<string, unknown>>;
      expect(players.length).toBe(4);
      for (const p of players) {
        expect(p).toHaveProperty("handCount");
        expect(p).not.toHaveProperty("hand");
      }

      // Cleanup
      alice.disconnect();
      bob.disconnect();
    },
    20000,
  );
});
