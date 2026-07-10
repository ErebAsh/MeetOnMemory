import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import {
  getDecisionLineageController,
  getOpenActionItems,
  updateActionItemStatus,
} from "../controllers/knowledgeController.js";

const router = express.Router();
router.use(apiLimiter);
router.use(userAuth);

router.get("/decisions/:id/lineage", getDecisionLineageController);
router.get("/action-items", getOpenActionItems);
router.patch("/action-items/:id", writeLimiter, updateActionItemStatus);

export default router;
