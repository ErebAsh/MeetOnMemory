import AuditLog from "../models/auditLogModel.js";

/**
 * ✅ Get Audit Logs for an Organization (Admin/Owner only)
 * GET /api/organization/:id/audit-logs
 */
export const getOrganizationAuditLogs = async (req, res) => {
  try {
    const organizationId = req.params.id;
    const { action, startDate, endDate, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Base filter
    const filter = { organization: organizationId };

    // Action filter
    if (action) {
      filter.action = String(action);
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Execute query with pagination and populate the actor
    const logs = await AuditLog.find(filter)
      .populate("actor", "name email profilePic")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await AuditLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching audit logs:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching audit logs." });
  }
};
