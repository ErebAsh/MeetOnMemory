import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

let redisClient = null;
let isRedisDisabled = false;

export const initRedis = async () => {
  const redisUri = process.env.REDIS_URI;

  if (!redisUri) {
    console.log("ℹ️ Redis is disabled (REDIS_URI not provided)");
    isRedisDisabled = true;
    return;
  }

  try {
    redisClient = createClient({
      url: redisUri,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error(
              "⚠️ Redis connection failed after 3 retries. Disabling Redis.",
            );
            isRedisDisabled = true;
            return new Error("Retry limit exceeded");
          }
          return Math.min(retries * 50, 500); // Wait 50, 100, 150ms...
        },
      },
    });

    redisClient.on("error", (err) => {
      // Only log if we haven't already disabled it to prevent log spam
      if (!isRedisDisabled) {
        console.log(`⚠️ Redis Client Error: ${err.message}`);
      }
    });

    await redisClient.connect();

    const isLocal =
      redisUri.includes("localhost") || redisUri.includes("127.0.0.1");
    const connectionType = isLocal
      ? "local"
      : redisUri.includes("upstash")
        ? "Upstash"
        : "remote";

    console.log(`✅ Redis connected successfully (${connectionType})`);
  } catch (error) {
    console.error("⚠️ Redis connection failed:", error.message);
    console.warn(
      "⚠️  Server running without Redis. Rate limiting and caching will not work.",
    );
    redisClient = null; // Disable the client for subsequent requests
    isRedisDisabled = true;
  }
};

export const getRedisClient = () => (isRedisDisabled ? null : redisClient);
