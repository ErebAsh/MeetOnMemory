import express from "express";
import { getAnalytics } from "../controllers/analyticsController.js";
import rateLimiter from "../middleware/rateLimiter.js";

const router = express.Router();

router.get("/", rateLimiter, getAnalytics);

export default router;
