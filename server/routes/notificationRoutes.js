// server/routes/notificationRoutes.js
import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} from "../controllers/notificationController.js";

const notificationRouter = express.Router();

notificationRouter.use(userAuth, apiLimiter);

notificationRouter.get("/", getNotifications);
notificationRouter.get("/unread-count", getUnreadCount);
notificationRouter.patch("/:id/read", writeLimiter, markAsRead);
notificationRouter.patch("/mark-all-read", writeLimiter, markAllAsRead);
notificationRouter.delete("/:id", writeLimiter, deleteNotification);

export default notificationRouter;
