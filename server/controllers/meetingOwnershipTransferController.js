import transferService from "../services/meetingOwnershipTransferService.js";
import { responseHandler } from "../utils/responseHandler.js";

/**
 * Controller for managing meeting ownership transfers.
 */
class MeetingOwnershipTransferController {
  /**
   * @route POST /api/transfers/request
   * @desc Request a meeting ownership transfer
   * @access Private
   */
  async requestTransfer(req, res, next) {
    try {
      const { meetingId, toUserId } = req.body;
      const fromUserId = req.user._id.toString();

      if (!meetingId || !toUserId) {
        return responseHandler(
          res,
          400,
          false,
          "meetingId and toUserId are required",
        );
      }

      const transfer = await transferService.requestTransfer(
        meetingId,
        fromUserId,
        toUserId,
      );
      return responseHandler(res, 201, true, "Transfer request created", {
        transfer,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /api/transfers/:id/accept
   * @desc Accept a pending transfer request
   * @access Private
   */
  async acceptTransfer(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id.toString();

      const transfer = await transferService.acceptTransfer(id, userId);
      return responseHandler(res, 200, true, "Transfer request accepted", {
        transfer,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /api/transfers/:id/reject
   * @desc Reject a pending transfer request
   * @access Private
   */
  async rejectTransfer(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id.toString();

      const transfer = await transferService.rejectTransfer(id, userId);
      return responseHandler(res, 200, true, "Transfer request rejected", {
        transfer,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route GET /api/transfers/inbox
   * @desc Get pending transfers directed to the user
   * @access Private
   */
  async getInbox(req, res, next) {
    try {
      const userId = req.user._id.toString();
      const transfers = await transferService.getInbox(userId);
      return responseHandler(res, 200, true, "Inbox fetched successfully", {
        transfers,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route GET /api/transfers/outbox
   * @desc Get pending transfers initiated by the user
   * @access Private
   */
  async getOutbox(req, res, next) {
    try {
      const userId = req.user._id.toString();
      const transfers = await transferService.getOutbox(userId);
      return responseHandler(res, 200, true, "Outbox fetched successfully", {
        transfers,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new MeetingOwnershipTransferController();
