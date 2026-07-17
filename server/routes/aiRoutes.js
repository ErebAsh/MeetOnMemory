// server/routes/aiRoutes.js
import express from "express";
import { searchVectorStore } from "../utils/embeddingUtils.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import Membership from "../models/membershipModel.js";
import Meeting from "../models/meetingModel.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// POST /api/ai-search
router.post(
  "/",
  userAuth,
  requirePermission("ai_search", "search"),
  async (req, res) => {
    try {
      const { query, filters } = req.body;

      // ✅ Validate input
      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          error: "Query text is required",
          results: [],
        });
      }

      console.log("🔍 Received search query:", query, "with filters:", filters);

      // ✅ Call vector search with filters
      const results = await searchVectorStore(query, filters || {});

      if (!results || results.length === 0) {
        return res.json({ query, results: [], count: 0 });
      }

      const meetingIds = results.map((r) => r.meetingId);

      // ✅ Get organizations the user belongs to
      const memberships = await Membership.find({
        user: req.user._id,
        status: "active",
      });
      const userOrgIds = memberships.map((m) => m.organization.toString());

      // ✅ Enforce RBAC: Fetch matching meetings from DB where the user has access
      const allowedMeetings = await Meeting.find({
        _id: { $in: meetingIds },
        $or: [
          { organization: { $in: userOrgIds } },
          { uploadedBy: req.user._id },
        ],
      }).lean();

      const allowedMeetingIds = allowedMeetings.map((m) => m._id.toString());

      // ✅ Filter vector results
      const authorizedResults = results.filter((r) =>
        allowedMeetingIds.includes(r.meetingId.toString()),
      );

      // ✅ Debug log
      console.log(
        `📤 Returning ${authorizedResults.length} authorized results to frontend`,
      );

      // ✅ Send response
      res.json({
        query,
        results: authorizedResults,
        count: authorizedResults.length,
      });
    } catch (error) {
      console.error("❌ AI Search Error:", error);
      res.status(500).json({
        error: error.message || "Search failed",
        results: [],
      });
    }
  },
);

export default router;
