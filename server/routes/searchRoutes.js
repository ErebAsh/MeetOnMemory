// ================================
// searchRoutes.js
// AI-Powered Semantic Search Routes
// ================================

import express from "express";
import { semanticSearch } from "../controllers/searchController.js";
import userAuth from "../middleware/userAuth.js";
import { cacheSearch } from "../middleware/cacheMiddleware.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

// 🔹 POST /api/search
// Protected route — requires login (JWT cookie)
// Expects: { query: "attendance policy" }
router.post("/", apiLimiter, userAuth, requirePermission("ai_search", "search"), cacheSearch, semanticSearch);

export default router;
