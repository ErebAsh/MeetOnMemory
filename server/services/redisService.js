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

let customTestClient = null;

export const overrideRedisClientForTesting = (client) => {
  customTestClient = client;
};

export const getRedisClient = () =>
  customTestClient !== null
    ? customTestClient
    : isRedisDisabled
      ? null
      : redisClient;

export const acquireLock = async (lockKey, ttlMs = 5000) => {
  const client = getRedisClient();
  if (!client || !client.isReady) return false;
  try {
    const res = await client.set(lockKey, "1", { NX: true, PX: ttlMs });
    return res === "OK";
  } catch (err) {
    console.error(`⚠️ acquireLock error for ${lockKey}:`, err.message);
    return false;
  }
};

export const releaseLock = async (lockKey) => {
  const client = getRedisClient();
  if (!client || !client.isReady) return false;
  try {
    await client.del(lockKey);
    return true;
  } catch (err) {
    console.error(`⚠️ releaseLock error for ${lockKey}:`, err.message);
    return false;
  }
};

export const setSearchCache = async (
  cacheKey,
  organizationId = "global",
  payload,
  softTTLSec = 300,
  hardTTLSec = 3600,
) => {
  const client = getRedisClient();
  if (!client || !client.isReady) return false;
  try {
    const orgId = organizationId || "global";
    const cacheValue = {
      payload,
      cachedAt: Date.now(),
      softTTL: softTTLSec,
      hardTTL: hardTTLSec,
    };
    await client.setEx(cacheKey, hardTTLSec, JSON.stringify(cacheValue));
    const setKey = `org:${orgId}:search_keys`;
    await client.sAdd(setKey, cacheKey);
    return true;
  } catch (err) {
    console.error(`⚠️ setSearchCache error for ${cacheKey}:`, err.message);
    return false;
  }
};

export const addKeyToOrgSet = async (organizationId = "global", cacheKey) => {
  const client = getRedisClient();
  if (!client || !client.isReady) return false;
  try {
    const orgId = organizationId || "global";
    await client.sAdd(`org:${orgId}:search_keys`, cacheKey);
    return true;
  } catch (err) {
    console.error(`⚠️ addKeyToOrgSet error:`, err.message);
    return false;
  }
};

export const getOrgKeys = async (organizationId = "global") => {
  const client = getRedisClient();
  if (!client || !client.isReady) return [];
  try {
    const orgId = organizationId || "global";
    const setKey = `org:${orgId}:search_keys`;
    return await client.sMembers(setKey);
  } catch (err) {
    console.error(`⚠️ getOrgKeys error:`, err.message);
    return [];
  }
};

export const clearOrgSetAndKeys = async (organizationId = "global") => {
  const client = getRedisClient();
  if (!client || !client.isReady) return 0;
  try {
    const orgId = organizationId || "global";
    const setKey = `org:${orgId}:search_keys`;
    const keys = await client.sMembers(setKey);

    let deletedCount = 0;
    if (keys && keys.length > 0) {
      const multi = client.multi();
      keys.forEach((key) => multi.del(key));
      multi.del(setKey);
      await multi.exec();
      deletedCount = keys.length;
    } else {
      await client.del(setKey);
    }
    return deletedCount;
  } catch (err) {
    console.error(`⚠️ clearOrgSetAndKeys error:`, err.message);
    return 0;
  }
};
