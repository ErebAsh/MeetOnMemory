// ================================
// hybridSearchController.js
// Handles hybrid (semantic + knowledge-graph) memory retrieval.
// Additive to the existing /api/search (meeting-only) endpoint - existing
// clients of that route are unaffected.
// ================================

import { hybridRetrieve } from "../services/hybridRetrievalService.js";
import { getRedisClient } from "../services/redisService.js";

/**
 * @desc  Hybrid retrieval: semantic vector search fused with knowledge-graph
 *        multi-hop traversal over decisions, action items and meetings.
 * @route POST /api/search/hybrid
 * @access Private (requires auth)
 *
 * Body:
 *  {
 *    query: string (required),
 *    topK?: number,                 // final result count, default 10
 *    semanticTopK?: number,         // seed candidates before graph expansion
 *    semanticWeight?: number,       // relative weight of vector similarity
 *    graphWeight?: number,          // relative weight of graph connectivity
 *    maxHops?: number,              // graph traversal depth, default 2
 *    decay?: number,                // per-hop score decay (0-1), default 0.6
 *    minEdgeWeight?: number,        // ignore weak relatesTo edges (0-100)
 *    includeTypes?: ("meeting"|"decision"|"actionItem")[]
 *  }
 */
export const hybridSearch = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Missing request body. Please send a valid JSON with { query: 'your question' }.",
      });
    }

    const { query, ...options } = req.body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid search query (minimum 3 characters). Example: { query: 'attendance policy' }",
      });
    }

    const organization = req.user?.organization || null;

    console.log(
      `🔀 Hybrid search for query: "${query}" (org: ${organization})`,
    );

    const { results, meta } = await hybridRetrieve(
      query,
      organization,
      options,
    );

    const responsePayload = {
      success: true,
      message: results.length
        ? "Hybrid search successful."
        : "No relevant memories found.",
      results,
      meta,
    };

    if (req.cacheKey) {
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        await redisClient.setEx(
          req.cacheKey,
          3600,
          JSON.stringify(responsePayload),
        );
      }
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("❌ Hybrid search error:", error);

    if (error.message === "A non-empty query string is required") {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message:
        error.response?.data?.error ||
        error.message ||
        "Server error during hybrid search.",
    });
  }
};
