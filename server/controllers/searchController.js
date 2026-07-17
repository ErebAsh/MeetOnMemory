// ================================
// searchController.js
// Handles semantic AI-powered search for meetings
// ================================

import { searchVectorStore } from "../utils/embeddingUtils.js";
import Meeting from "../models/meetingModel.js";
import { getRedisClient } from "../services/redisService.js";

/**
 * @desc  Search meetings using AI embeddings
 * @route POST /api/search
 * @access Private (requires auth)
 */
export const semanticSearch = async (req, res) => {
  try {
    // ✅ Step 1 — Defensive check for body
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Missing request body. Please send a valid JSON with { query: 'your question' }.",
      });
    }

    // ✅ Step 2 — Extract query safely
    const { query } = req.body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid search query (minimum 3 characters). Example: { query: 'attendance policy' }",
      });
    }

    console.log(`🔍 AI Semantic Search for query: "${query}"`);

    // ✅ Step 3 — Perform vector search
    const results = await searchVectorStore(query);

    if (!results || results.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No relevant meetings found.",
        results: [],
      });
    }

    // ✅ Step 4 — Fetch full meeting data for context
    const meetingIds = results.map((r) => r.meetingId);
    const meetings = await Meeting.find({ _id: { $in: meetingIds } })
      .select("title summary createdAt")
      .lean();

    // ✅ Step 5 — Merge vector results with DB data and filter out deleted meetings
    const mergedResults = results
      .map((r) => {
        const m = meetings.find((mt) => mt._id.toString() === r.meetingId);
        // Defense in depth: only return results that still exist in MongoDB
        if (!m) return null;
        return {
          meetingId: r.meetingId,
          title: m?.title || r.title || "Untitled Meeting",
          summary: m?.summary || r.summary || "No summary available.",
          score: (1 - r.similarityScore).toFixed(3),
          createdAt: m?.createdAt || null,
        };
      })
      .filter((r) => r !== null);

    const responsePayload = {
      success: true,
      message: "AI Search successful.",
      results: mergedResults,
    };

    // ✅ Step 6 — Save to Redis Cache (if applicable)
    if (req.cacheKey) {
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        // Cache for 1 hour (3600 seconds)
        await redisClient.setEx(
          req.cacheKey,
          3600,
          JSON.stringify(responsePayload),
        );
      }
    }

    // ✅ Step 7 — Send response
    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("❌ Semantic search error:", error);
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.error ||
        error.message ||
        "Server error during semantic search.",
    });
  }
};
