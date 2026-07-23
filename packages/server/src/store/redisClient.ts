import Redis from "ioredis";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
    });

    client.on("connect", () => logger.info("Redis connected"));
    client.on("error", (err) => logger.error("Redis error:", err.message));
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
