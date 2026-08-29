import mongoose from "mongoose";
import MeetingOwnershipTransfer from "../models/meetingOwnershipTransferModel.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import Membership from "../models/membershipModel.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "../utils/errors.js";

/**
 * Validates that both users belong to the same organization.
 */
async function validateSameOrganization(fromUserId, toUserId) {
  const fromUser = await User.findById(fromUserId).populate(
    "currentOrganization",
  );
  const toUser = await User.findById(toUserId).populate("currentOrganization");

  if (!fromUser || !toUser) {
    throw new NotFoundError("One or both users not found");
  }

  const fromOrgId =
    fromUser.currentOrganization?._id?.toString() ||
    fromUser.currentOrganization?.toString();
  const toOrgId =
    toUser.currentOrganization?._id?.toString() ||
    toUser.currentOrganization?.toString();

  if (!fromOrgId || !toOrgId || fromOrgId !== toOrgId) {
    throw new ForbiddenError(
      "Users must belong to the same active organization",
    );
  }

  return { fromUser, toUser };
}

class MeetingOwnershipTransferService {
  /**
   * Request a transfer of meeting ownership to another user.
   */
  async requestTransfer(meetingId, fromUserId, toUserId) {
    if (fromUserId === toUserId) {
      throw new ValidationError("Cannot transfer ownership to yourself");
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new NotFoundError("Meeting not found");
    }

    if (meeting.uploadedBy.toString() !== fromUserId) {
      // Allow org admins to transfer meetings they don't own
      const adminMembership = await Membership.findOne({
        user: fromUserId,
        organization: meeting.organization,
        role: "admin",
      });

      if (!adminMembership) {
        throw new ForbiddenError(
          "Only the meeting owner or an organization admin can transfer ownership",
        );
      }
    }

    await validateSameOrganization(fromUserId, toUserId);

    // Check if a pending transfer already exists for this meeting
    const existingTransfer = await MeetingOwnershipTransfer.findOne({
      meeting: meetingId,
      status: "pending",
    });

    if (existingTransfer) {
      throw new ValidationError(
        "A pending transfer request already exists for this meeting",
      );
    }

    // Expire in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const transfer = new MeetingOwnershipTransfer({
      meeting: meetingId,
      fromUser: fromUserId,
      toUser: toUserId,
      status: "pending",
      expiresAt,
    });

    await transfer.save();
    return transfer;
  }

  /**
   * Accept a pending transfer request.
   */
  async acceptTransfer(transferId, toUserId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const transfer =
        await MeetingOwnershipTransfer.findById(transferId).session(session);

      if (!transfer) {
        throw new NotFoundError("Transfer request not found");
      }

      if (transfer.status !== "pending") {
        throw new ValidationError(
          `Transfer request is already ${transfer.status}`,
        );
      }

      if (transfer.toUser.toString() !== toUserId) {
        throw new ForbiddenError(
          "You are not authorized to accept this transfer",
        );
      }

      const meeting = await Meeting.findById(transfer.meeting).session(session);
      if (!meeting) {
        throw new NotFoundError("Meeting not found");
      }

      // Atomically update Meeting and Transfer
      meeting.uploadedBy = toUserId;
      meeting.auditNote = `Ownership transferred from ${transfer.fromUser} to ${toUserId}`;
      await meeting.save({ session });

      transfer.status = "accepted";
      await transfer.save({ session });

      await session.commitTransaction();
      session.endSession();

      return transfer;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  /**
   * Reject a pending transfer request.
   */
  async rejectTransfer(transferId, toUserId) {
    const transfer = await MeetingOwnershipTransfer.findById(transferId);

    if (!transfer) {
      throw new NotFoundError("Transfer request not found");
    }

    if (transfer.status !== "pending") {
      throw new ValidationError(
        `Transfer request is already ${transfer.status}`,
      );
    }

    if (transfer.toUser.toString() !== toUserId) {
      throw new ForbiddenError(
        "You are not authorized to reject this transfer",
      );
    }

    transfer.status = "rejected";
    await transfer.save();

    return transfer;
  }

  /**
   * Get pending transfers directed to a user (Inbox).
   */
  async getInbox(userId) {
    return MeetingOwnershipTransfer.find({
      toUser: userId,
      status: "pending",
    })
      .populate("fromUser", "name email avatarUrl")
      .populate("meeting", "title date")
      .sort({ createdAt: -1 });
  }

  /**
   * Get pending transfers initiated by a user (Outbox).
   */
  async getOutbox(userId) {
    return MeetingOwnershipTransfer.find({
      fromUser: userId,
      status: "pending",
    })
      .populate("toUser", "name email avatarUrl")
      .populate("meeting", "title date")
      .sort({ createdAt: -1 });
  }
}

export default new MeetingOwnershipTransferService();
