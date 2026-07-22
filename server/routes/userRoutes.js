import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter, dataExportLimiter } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  getUserData,
  updateUserProfile,
  requestDataExport,
  downloadExport,
} from "../controllers/userController.js";

const userRouter = express.Router();

// Apply rate limiting to all routes
userRouter.use(apiLimiter);

userRouter.get(
  "/data",
  userAuth,
  requirePermission("settings", "view"),
  getUserData,
);
userRouter.put(
  "/update",
  userAuth,
  writeLimiter,
  requirePermission("settings", "edit"),
  updateUserProfile,
);

userRouter.post("/request-data-export", userAuth, dataExportLimiter, requirePermission("settings", "view"), requestDataExport);
userRouter.get("/download-export/:token", downloadExport);

export default userRouter;
