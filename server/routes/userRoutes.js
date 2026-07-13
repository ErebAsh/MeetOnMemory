import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  getUserData,
  updateUserProfile,
} from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get("/data", userAuth, apiLimiter, requirePermission("settings", "view"), getUserData);
userRouter.put("/update", userAuth, writeLimiter, requirePermission("settings", "edit"), updateUserProfile);

export default userRouter;
