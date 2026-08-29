import cron from "node-cron";
import MeetingOwnershipTransfer from "../models/meetingOwnershipTransferModel.js";

let isJobScheduled = false;

/**
 * Background job to automatically expire pending transfer requests after 7 days.
 */
export const processExpiredTransfers = async () => {
  try {
    const now = new Date();

    // Find all pending transfers whose expiresAt is in the past
    const result = await MeetingOwnershipTransfer.updateMany(
      {
        status: "pending",
        expiresAt: { $lte: now },
      },
      {
        $set: { status: "expired" },
      },
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[Transfer Expiration Job] Expired ${result.modifiedCount} transfer request(s).`,
      );
    }

    return result.modifiedCount;
  } catch (error) {
    console.error("Error in transfer expiration job:", error);
    return 0;
  }
};

export const startExpireTransferRequestsJob = () => {
  if (isJobScheduled) {
    console.log(
      "Transfer expiration job already scheduled, skipping duplicate registration.",
    );
    return;
  }

  try {
    // Run once every hour
    cron.schedule("0 * * * *", async () => {
      await processExpiredTransfers();
    });

    isJobScheduled = true;
    console.log(
      "Successfully initialized transfer expiration background job (schedule: 0 * * * *)",
    );
  } catch (error) {
    console.error(
      "Failed to initialize transfer expiration background job:",
      error,
    );
  }
};
