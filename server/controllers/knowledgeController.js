import mongoose from "mongoose";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import { getDecisionLineage } from "../services/knowledgeGraphService.js";

export const getDecisionLineageController = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization || null;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision id",
      });
    }

    // Verify the requested decision belongs to the user's organization
    const startDecision = await Decision.findById(id).select("organization");

    if (
      !startDecision ||
      startDecision.organization?.toString() !== organization?.toString()
    ) {
      return res.status(404).json({
        success: false,
        message: "Decision not found",
      });
    }

    const chain = await getDecisionLineage(id);

    // Keep organization filtering as an additional safeguard
    const filteredChain = chain.filter(
      (decision) =>
        decision.organization?.toString() === organization?.toString(),
    );

    res.status(200).json({
      success: true,
      lineage: filteredChain,
    });
  } catch (error) {
    console.error("getDecisionLineage error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch decision lineage",
    });
  }
};

export const getOpenActionItems = async (req, res) => {
  try {
    const { status = "open" } = req.query;
    const organization = req.user.organization;

    const allowedStatuses = [
      "open",
      "in-progress",
      "resolved",
      "superseded",
      "all",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    let query;
    if (status === "all") {
      query = ActionItem.find({ organization });
    } else if (status === "open") {
      query = ActionItem.find({
        organization,
        status: "open",
      });
    } else if (status === "in-progress") {
      query = ActionItem.find({
        organization,
        status: "in-progress",
      });
    } else if (status === "resolved") {
      query = ActionItem.find({
        organization,
        status: "resolved",
      });
    } else if (status === "superseded") {
      query = ActionItem.find({
        organization,
        status: "superseded",
      });
    }

    const items = await query
      .populate("sourceMeetingId", "title date")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      actionItems: items,
    });
  } catch (error) {
    console.error("getOpenActionItems error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch action items",
    });
  }
};

export const updateActionItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const organization = req.user.organization;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action item id",
      });
    }

    const allowedStatuses = ["open", "in-progress", "resolved", "superseded"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Fetch first to satisfy CodeQL
    const item = await ActionItem.findOne({
      _id: id,
      organization,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Action item not found",
      });
    }

    item.status = status;
    item.resolvedAt = status === "resolved" ? new Date() : null;

    await item.save();

    res.status(200).json({
      success: true,
      actionItem: item,
    });
  } catch (error) {
    console.error("updateActionItemStatus error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update action item",
    });
  }
};
