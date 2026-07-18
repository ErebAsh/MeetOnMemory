import { getRedisClient } from "../services/redisService.js";
import crypto from "crypto";

// NOTE: Cache invalidation is not currently implemented for search results.
// Search queries are cached for 1 hour. If meetings or other searchable
// data are updated, users may receive slightly stale results for identical
// queries until the cache expires. This is an accepted trade-off for performance.
export const cacheSearch = async (req, res, next) => {
  try {
    const { query, ...options } = req.body || {};
    if (!query || typeof query !== "string") {
      return next();
    }

    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return next();
    }

    // Include the route path and any extra body options (e.g. hybrid search's
    // weights/topK/maxHops) in the cache key. Otherwise two different routes
    // - or the same route with different options - sharing an identical
    // `query` string would incorrectly serve each other's cached payload.
    const cachePayload = JSON.stringify({
      route: req.baseUrl + req.path,
      query: query.toLowerCase().trim(),
      options,
    });
    const hash = crypto.createHash("sha256").update(cachePayload).digest("hex");
    const cacheKey = `search:${hash}`;

    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      console.log(`⚡ Serving from Redis cache for query: "${query}"`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    // Attach cacheKey to req so controller can save it
    req.cacheKey = cacheKey;
    next();
  } catch (error) {
    console.error("Redis cache error:", error);
    next();
  }
};
