import express from "express";
import {
  getConnectionStatus,
  getGoogleOAuthUrl,
  handleGoogleCallback,
  getMicrosoftOAuthUrl,
  handleMicrosoftCallback,
  disconnectCalendar,
  resyncCalendar,
  getFreeBusyAvailability,
  getExternalEvents,
} from "../controllers/calendarController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// All calendar routes require authentication
router.use(userAuth);

// Get connection status
router.get("/status", getConnectionStatus);

// Google OAuth
router.get("/google/auth-url", getGoogleOAuthUrl);
router.post("/google/callback", handleGoogleCallback);

// Microsoft OAuth
router.get("/microsoft/auth-url", getMicrosoftOAuthUrl);
router.post("/microsoft/callback", handleMicrosoftCallback);

// Disconnect
router.delete("/:provider/disconnect", disconnectCalendar);

// Manual resync
router.post("/:provider/resync", resyncCalendar);

// Free/busy availability
router.post("/freebusy", getFreeBusyAvailability);

// External events for calendar view
router.get("/external-events", getExternalEvents);

export default router;
