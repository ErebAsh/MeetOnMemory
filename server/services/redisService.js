import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

let redisClient = null;

export const initRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URI || "redis://localhost:6379",
    });

    redisClient.on("error", (err) => console.log("Redis Client Error", err));

    await redisClient.connect();
    console.log("✅ Redis connected successfully");
  } catch (error) {
    console.error("⚠️ Redis connection failed:", error.message);
    console.warn("⚠️  Server running without Redis. Rate limiting and caching will not work.");
    redisClient = null;
  }
};

export const getRedisClient = () => redisClient;
