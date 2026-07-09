import Meeting from "../models/meetingModel.js";
import Policy from "../models/policyModel.js";

export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const queryOptions = [{ uploadedBy: userId }];
    if (req.user?.organization) {
      queryOptions.push({ organization: req.user.organization });
    }
    const matchQuery = { $or: queryOptions };

    const totalMeetings = await Meeting.countDocuments(matchQuery);
    const totalPolicies = await Policy.countDocuments(matchQuery);
    const completedMeetings = await Meeting.countDocuments({
      ...matchQuery,
      status: "completed",
    });
    const updatedPolicies = await Policy.countDocuments({
      ...matchQuery,
      version: { $ne: "1.0" },
    });

    // Monthly trend (last 6 months)
    const lastSixMonths = new Date();
    lastSixMonths.setMonth(lastSixMonths.getMonth() - 5);
    const monthlyMeetings = await Meeting.aggregate([
      { $match: { createdAt: { $gte: lastSixMonths }, ...matchQuery } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyPolicies = await Policy.aggregate([
      { $match: { createdAt: { $gte: lastSixMonths }, ...matchQuery } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      summary: {
        totalMeetings,
        completedMeetings,
        totalPolicies,
        updatedPolicies,
      },
      trends: { monthlyMeetings, monthlyPolicies },
    });
  } catch (error) {
    console.error("❌ Analytics Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to load analytics" });
  }
};
