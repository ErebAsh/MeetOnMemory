import crypto from "crypto";
import { google } from "googleapis";
import axios from "axios";
import cron from "node-cron";
import CalendarConnection from "../models/calendarConnectionModel.js";
import Meeting from "../models/meetingModel.js";
import {
  decryptToken,
  encryptToken,
  getGoogleOAuthClient,
} from "./calendarService.js";

const ALGORITHM = "aes-256-gcm";

/**
 * Resolve the calendar-sync encryption key (Issue #1768).
 *
 * There is no hardcoded fallback. Missing or empty TOKEN_ENCRYPTION_KEY
 * fails closed so Google/Microsoft OAuth tokens cannot be encrypted with
 * a well-known default.
 *
 * @returns {string}
 */
export const getTokenEncryptionKey = () => {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  }
  return key;
};

const encrypt = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(getTokenEncryptionKey()),
    iv,
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
};

const decrypt = (encryptedData) => {
  if (!encryptedData) return encryptedData;
  const parts = encryptedData.split(":");
  if (parts.length !== 3) return encryptedData;
  const [ivHex, encryptedText, authTagHex] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(getTokenEncryptionKey()),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

// Google Calendar Client helper using connection credentials
const getGoogleCalendarClient = (accessToken, refreshToken) => {
  const oAuth2Client = getGoogleOAuthClient();
  oAuth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.calendar({ version: "v3", auth: oAuth2Client });
};

// Helper to resolve external calendar ID
const getExternalCalendarId = (connection) => {
  return connection.providerData?.calendarId || "primary";
};

// --- Calendar Sync Operations ---

export const syncMeetingToGoogle = async (connection, meeting) => {
  try {
    const accessToken = decryptToken(connection.accessToken);
    const refreshToken = decryptToken(connection.refreshToken);
    const calendar = getGoogleCalendarClient(accessToken, refreshToken);

    const event = {
      summary: meeting.title,
      description: meeting.description || "",
      start: {
        dateTime: meeting.date.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: new Date(
          meeting.date.getTime() + (meeting.duration || 60) * 60000,
        ).toISOString(),
        timeZone: "UTC",
      },
      location: meeting.venue || meeting.location || "",
    };

    const existingRef = meeting.externalCalendarRefs?.find(
      (r) => r.provider === "google",
    );
    const calendarId = getExternalCalendarId(connection);

    if (existingRef) {
      await calendar.events.update({
        calendarId,
        eventId: existingRef.eventId,
        requestBody: event,
      });
      return { provider: "google", eventId: existingRef.eventId };
    } else {
      const res = await calendar.events.insert({
        calendarId,
        requestBody: event,
      });
      return { provider: "google", eventId: res.data.id };
    }
  } catch (err) {
    console.error("Google sync error:", err.message);
    throw err;
  }
};

export const deleteGoogleMeeting = async (connection, eventId) => {
  try {
    const accessToken = decryptToken(connection.accessToken);
    const refreshToken = decryptToken(connection.refreshToken);
    const calendar = getGoogleCalendarClient(accessToken, refreshToken);
    const calendarId = getExternalCalendarId(connection);

    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (err) {
    console.error("Google delete error:", err.message);
  }
};

export const syncMeetingToOutlook = async (connection, meeting) => {
  try {
    const accessToken = decryptToken(connection.accessToken);
    const event = {
      subject: meeting.title,
      body: { contentType: "Text", content: meeting.description || "" },
      start: { dateTime: meeting.date.toISOString(), timeZone: "UTC" },
      end: {
        dateTime: new Date(
          meeting.date.getTime() + (meeting.duration || 60) * 60000,
        ).toISOString(),
        timeZone: "UTC",
      },
      location: { displayName: meeting.venue || meeting.location || "" },
    };

    const existingRef = meeting.externalCalendarRefs?.find((r) =>
      ["outlook", "microsoft"].includes(r.provider),
    );
    let res;
    if (existingRef) {
      res = await axios.patch(
        `https://graph.microsoft.com/v1.0/me/events/${existingRef.eventId}`,
        event,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      return { provider: connection.provider, eventId: existingRef.eventId };
    } else {
      res = await axios.post(
        "https://graph.microsoft.com/v1.0/me/events",
        event,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      return { provider: connection.provider, eventId: res.data.id };
    }
  } catch (err) {
    console.error("Outlook sync error:", err.message);
    throw err;
  }
};

export const deleteOutlookMeeting = async (connection, eventId) => {
  try {
    const accessToken = decryptToken(connection.accessToken);
    await axios.delete(
      `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  } catch (err) {
    console.error("Outlook delete error:", err.message);
  }
};

export const pushMeetingToIntegrations = async (userId, meeting) => {
  const connections = await CalendarConnection.find({
    user: userId,
    syncStatus: "connected",
  });
  const newRefs = [];
  for (const connection of connections) {
    try {
      if (connection.provider === "google") {
        const ref = await syncMeetingToGoogle(connection, meeting);
        if (ref) newRefs.push(ref);
      } else if (["outlook", "microsoft"].includes(connection.provider)) {
        const ref = await syncMeetingToOutlook(connection, meeting);
        if (ref) newRefs.push(ref);
      }
      connection.lastSyncAt = new Date();
      await connection.save();
    } catch (_err) {
      console.error(`Failed to push to ${connection.provider}`);
    }
  }

  if (newRefs.length > 0) {
    const combinedRefs = [...(meeting.externalCalendarRefs || [])];
    newRefs.forEach((nr) => {
      if (!combinedRefs.find((r) => r.provider === nr.provider)) {
        combinedRefs.push(nr);
      }
    });
    meeting.externalCalendarRefs = combinedRefs;
    if (typeof meeting.save === "function") {
      await meeting.save();
    }
    if (meeting._id) {
      await Meeting.findByIdAndUpdate(meeting._id, {
        $set: { externalCalendarRefs: combinedRefs },
      }).catch(() => {});
    }
  }
};

export const deleteMeetingFromIntegrations = async (
  userId,
  externalCalendarRefs,
) => {
  if (!externalCalendarRefs || externalCalendarRefs.length === 0) return;
  const connections = await CalendarConnection.find({
    user: userId,
    syncStatus: "connected",
  });

  for (const connection of connections) {
    const ref = externalCalendarRefs.find(
      (r) =>
        r.provider === connection.provider ||
        (["outlook", "microsoft"].includes(r.provider) &&
          ["outlook", "microsoft"].includes(connection.provider)),
    );
    if (ref) {
      if (connection.provider === "google") {
        await deleteGoogleMeeting(connection, ref.eventId);
      } else if (["outlook", "microsoft"].includes(connection.provider)) {
        await deleteOutlookMeeting(connection, ref.eventId);
      }
    }
  }
};

export const suggestFreeSlot = async (
  userId,
  targetDateIso,
  durationMinutes = 30,
) => {
  try {
    const connections = await CalendarConnection.find({
      user: userId,
      syncStatus: "connected",
    });

    let suggestedDate = new Date(targetDateIso);
    if (isNaN(suggestedDate.getTime())) {
      suggestedDate = new Date();
      suggestedDate.setDate(suggestedDate.getDate() + 1); // tomorrow as fallback
      suggestedDate.setHours(14, 0, 0, 0); // 2 PM
    }

    const googleConnection = connections.find((c) => c.provider === "google");

    if (googleConnection) {
      const accessToken = decryptToken(googleConnection.accessToken);
      const refreshToken = decryptToken(googleConnection.refreshToken);
      const calendar = getGoogleCalendarClient(accessToken, refreshToken);

      const timeMin = new Date(suggestedDate);
      timeMin.setHours(0, 0, 0, 0);

      const timeMax = new Date(suggestedDate);
      timeMax.setDate(timeMax.getDate() + 1);
      timeMax.setHours(23, 59, 59, 999);

      const calendarId = getExternalCalendarId(googleConnection);

      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          timeZone: "UTC",
          items: [{ id: calendarId }],
        },
      });

      const busySlots = res.data.calendars[calendarId].busy || [];

      let currentTry = new Date(suggestedDate);

      // Look for a slot within the next 24 tries (12 hours)
      for (let i = 0; i < 24; i++) {
        const tryEnd = new Date(currentTry.getTime() + durationMinutes * 60000);

        const isBusy = busySlots.some((slot) => {
          const busyStart = new Date(slot.start);
          const busyEnd = new Date(slot.end);
          return currentTry < busyEnd && tryEnd > busyStart;
        });

        if (!isBusy) {
          suggestedDate = currentTry;
          break;
        }
        currentTry = new Date(currentTry.getTime() + 30 * 60000); // add 30 mins
      }
    }

    return suggestedDate.toISOString();
  } catch (err) {
    console.error("Error finding free slot:", err.message);
    return targetDateIso;
  }
};

// --- Refresh tokens & Cron ---

const refreshGoogleToken = async (connection) => {
  try {
    const oauth2Client = getGoogleOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: decryptToken(connection.refreshToken),
    });
    const { credentials } = await oauth2Client.refreshAccessToken();
    connection.accessToken = encryptToken(credentials.access_token);
    connection.tokenExpiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : null;
    connection.syncStatus = "connected";
    connection.syncError = null;
    await connection.save();
  } catch (err) {
    console.error("Failed to refresh Google token", err.message);
    connection.syncStatus = "needs_reauth";
    connection.syncError = err.message;
    await connection.save();
  }
};

const refreshOutlookToken = async (connection) => {
  try {
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID,
      client_secret:
        process.env.MS_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: decryptToken(connection.refreshToken),
      scope: "offline_access Calendars.ReadWrite",
    });
    const res = await axios.post(
      `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || "common"}/oauth2/v2.0/token`,
      params,
    );
    connection.accessToken = encryptToken(res.data.access_token);
    if (res.data.refresh_token) {
      connection.refreshToken = encryptToken(res.data.refresh_token);
    }
    connection.tokenExpiresAt = new Date(
      Date.now() + res.data.expires_in * 1000,
    );
    connection.syncStatus = "connected";
    connection.syncError = null;
    await connection.save();
  } catch (err) {
    console.error("Failed to refresh Outlook token", err.message);
    connection.syncStatus = "needs_reauth";
    connection.syncError = err.message;
    await connection.save();
  }
};

// Cron job to run every 15 minutes to refresh expiring tokens
export const initCalendarSyncCron = () => {
  cron.schedule("*/15 * * * *", async () => {
    try {
      console.log("Running Calendar Sync Reconciliation Cron");
      const expiringTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      const queryResult = CalendarConnection.find({
        syncStatus: "connected",
        tokenExpiresAt: { $lte: expiringTime },
      });
      const connectionsCursor =
        typeof queryResult?.cursor === "function"
          ? queryResult.cursor()
          : await queryResult;

      let batch = [];
      const batchSize = 100;

      const processBatch = async () => {
        if (batch.length === 0) return;
        const promises = batch.map(async (connection) => {
          if (connection.provider === "google" && connection.refreshToken) {
            return refreshGoogleToken(connection);
          } else if (
            ["outlook", "microsoft"].includes(connection.provider) &&
            connection.refreshToken
          ) {
            return refreshOutlookToken(connection);
          }
        });
        await Promise.allSettled(promises);
        batch = [];
      };

      for await (const connection of connectionsCursor) {
        batch.push(connection);
        if (batch.length >= batchSize) {
          await processBatch();
        }
      }

      await processBatch(); // process remaining connections
    } catch (error) {
      console.error("Cron job error:", error);
    }
  });
};

export { encrypt, decrypt };
