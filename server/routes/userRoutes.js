import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import {
  getUserData,
  updateUserProfile,
} from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get("/data", userAuth, apiLimiter, getUserData);
userRouter.put("/update", userAuth, writeLimiter, updateUserProfile);

export default userRouter;
