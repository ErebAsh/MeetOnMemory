import { google } from "googleapis";

// Assuming credentials will be in process.env
// Need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
const getOAuth2Client = (user) => {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  if (user && user.googleAccessToken) {
    oAuth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });
  }

  return oAuth2Client;
};

/**
 * Creates a Google Calendar event for a scheduled meeting
 * @param {Object} user - The user creating the meeting
 * @param {Object} meetingDetails - The meeting details
 * @returns {String|null} - The Google Calendar Event ID or null on failure
 */
export const createEvent = async (user, meetingDetails) => {
  try {
    if (!user.calendarSyncEnabled || !user.googleAccessToken) {
      return null;
    }

    const oAuth2Client = getOAuth2Client(user);
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    // Combine date and time
    // If no time is provided, we can default to 00:00 or current time, let's use what we can
    let startDateTime = new Date(meetingDetails.date);
    if (meetingDetails.time) {
      const [hours, minutes] = meetingDetails.time.split(":");
      startDateTime.setHours(parseInt(hours, 10));
      startDateTime.setMinutes(parseInt(minutes, 10));
    }

    // Default duration to 60 minutes if not specified
    const duration = meetingDetails.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const event = {
      summary: meetingDetails.title,
      location: meetingDetails.location || meetingDetails.venue || "",
      description: meetingDetails.description || "",
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "UTC", // or appropriate timezone
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "UTC",
      },
    };

    const res = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    console.log("✅ Google Calendar event created:", res.data.id);
    return res.data.id;
  } catch (error) {
    console.error("❌ Error creating Google Calendar event:", error.message);
    return null; // Return null so meeting creation doesn't fail
  }
};

/**
 * Updates a Google Calendar event
 * @param {Object} user - The user updating the meeting
 * @param {Object} meetingDetails - The updated meeting details including googleEventId
 */
export const updateEvent = async (user, meetingDetails) => {
  try {
    if (
      !user.calendarSyncEnabled ||
      !user.googleAccessToken ||
      !meetingDetails.googleEventId
    ) {
      return;
    }

    const oAuth2Client = getOAuth2Client(user);
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    let startDateTime = new Date(meetingDetails.date);
    if (meetingDetails.time) {
      const [hours, minutes] = meetingDetails.time.split(":");
      startDateTime.setHours(parseInt(hours, 10));
      startDateTime.setMinutes(parseInt(minutes, 10));
    }

    const duration = meetingDetails.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const event = {
      summary: meetingDetails.title,
      location: meetingDetails.location || meetingDetails.venue || "",
      description: meetingDetails.description || "",
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "UTC",
      },
    };

    await calendar.events.update({
      calendarId: "primary",
      eventId: meetingDetails.googleEventId,
      resource: event,
    });

    console.log(
      "✅ Google Calendar event updated:",
      meetingDetails.googleEventId,
    );
  } catch (error) {
    console.error("❌ Error updating Google Calendar event:", error.message);
  }
};

/**
 * Deletes a Google Calendar event
 * @param {Object} user - The user deleting the meeting
 * @param {String} eventId - The Google Calendar Event ID
 */
export const deleteEvent = async (user, eventId) => {
  try {
    if (!user.calendarSyncEnabled || !user.googleAccessToken || !eventId) {
      return;
    }

    const oAuth2Client = getOAuth2Client(user);
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    await calendar.events.delete({
      calendarId: "primary",
      eventId: eventId,
    });

    console.log("✅ Google Calendar event deleted:", eventId);
  } catch (error) {
    console.error("❌ Error deleting Google Calendar event:", error.message);
  }
};

export const getAuthUrl = () => {
  const oAuth2Client = getOAuth2Client();
  const scopes = ["https://www.googleapis.com/auth/calendar.events"];

  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // Force to get refresh token
  });
};

export const getTokens = async (code) => {
  const oAuth2Client = getOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
};
