import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import transferController from "../controllers/meetingOwnershipTransferController.js";

const router = express.Router();

// All routes require authentication
router.use(userAuth);
router.use(apiLimiter);

// Get inbox/outbox
router.get("/inbox", transferController.getInbox);
router.get("/outbox", transferController.getOutbox);

// Request, accept, reject transfers (use writeLimiter for mutations)
router.post("/request", writeLimiter, transferController.requestTransfer);
router.post("/:id/accept", writeLimiter, transferController.acceptTransfer);
router.post("/:id/reject", writeLimiter, transferController.rejectTransfer);

export default router;
