import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  turnTimeoutMs: parseInt(process.env.TURN_TIMEOUT_MS ?? "30000", 10),
} as const;
