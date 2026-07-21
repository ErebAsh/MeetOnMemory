import AuditLog from "../models/auditLogModel.js";
import {
  detectConflicts,
  listConflictSets,
  getConflictSetById,
  resolveConflictSet,
  MODEL_REGISTRY,
} from "../services/conflictDetection/conflictDetectionService.js";

const VALID_MODEL_TYPES = Object.keys(MODEL_REGISTRY);
const VALID_STATUSES = ["open", "resolved", "dismissed", "all"];

function parseModelsParam(rawModels) {
  if (!rawModels) return VALID_MODEL_TYPES;
  const requested = Array.isArray(rawModels)
    ? rawModels
    : String(rawModels)
        .split(",")
        .map((m) => m.trim());
  return requested.filter(Boolean);
}

/**
 * POST /api/knowledge/conflicts/scan
 * Runs the Contradiction Detection engine for the caller's organization.
 * Defaults to a dry run so admins can preview flagged conflicts before
 * they're persisted for review; pass `{ "dryRun": false }` to actually
 * create/update ConflictSet records.
 */
export const scanForConflicts = async (req, res) => {
  try {
    const organization = req.user.organization || null;
    const {
      dryRun = true,
      models,
      useAI = true,
      minConfidence,
    } = req.body || {};

    const modelTypes = parseModelsParam(models);
    const invalid = modelTypes.filter((m) => !VALID_MODEL_TYPES.includes(m));
    if (invalid.length || modelTypes.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid memory type(s): ${invalid.join(", ") || "none provided"}. Expected one or more of: ${VALID_MODEL_TYPES.join(", ")}`,
      });
    }

    if (
      minConfidence !== undefined &&
      (typeof minConfidence !== "number" ||
        minConfidence < 0 ||
        minConfidence > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "minConfidence must be a number between 0 and 100",
      });
    }

    const report = await detectConflicts({
      organization,
      dryRun: dryRun !== false,
      useAI: useAI !== false,
      models: modelTypes,
      ...(minConfidence !== undefined ? { minConfidence } : {}),
    });

    if (!report.dryRun && organization) {
      await AuditLog.create({
        organization,
        actor: req.user._id,
        action: "conflict_scan",
        entity: "KnowledgeGraph",
        entityId: req.user._id,
        details: {
          modelTypes,
          totalConflictsFound: report.totalConflictsFound,
        },
      });
    }

    res.status(200).json({ success: true, report });
  } catch (error) {
    console.error("scanForConflicts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to run contradiction detection",
    });
  }
};

/**
 * GET /api/knowledge/conflicts?model=decision&status=open&limit=50
 * Lists conflict sets for the caller's organization.
 */
export const getConflicts = async (req, res) => {
  try {
    const organization = req.user.organization || null;
    const { model, status = "open", limit = 50 } = req.query;

    if (model && !VALID_MODEL_TYPES.includes(model)) {
      return res.status(400).json({
        success: false,
        message: `Invalid memory type "${model}". Expected one of: ${VALID_MODEL_TYPES.join(", ")}`,
      });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status "${status}". Expected one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const parsedLimit = Number(limit);
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;

    const conflicts = await listConflictSets(model, {
      organization,
      status,
      limit: safeLimit,
    });

    res.status(200).json({ success: true, count: conflicts.length, conflicts });
  } catch (error) {
    console.error("getConflicts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conflicts",
    });
  }
};

/**
 * GET /api/knowledge/conflicts/:id
 * Returns a single conflict set, including member snapshots and pairwise
 * details, for the resolution review screen.
 */
export const getConflictDetail = async (req, res) => {
  try {
    const conflict = await getConflictSetById(req.params.id);
    if (!conflict) {
      return res
        .status(404)
        .json({ success: false, message: "Conflict set not found" });
    }

    const organization = req.user.organization || null;
    const conflictOrg = conflict.organization
      ? conflict.organization.toString()
      : null;
    if (conflictOrg !== (organization ? organization.toString() : null)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.status(200).json({ success: true, conflict });
  } catch (error) {
    console.error("getConflictDetail error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conflict",
    });
  }
};

/**
 * POST /api/knowledge/conflicts/:id/resolve
 * Body: { resolutionType: "kept_member" | "custom_value" | "dismissed",
 *         keptMemoryId?, customValue?, note? }
 * Applies a user's resolution to a conflict set and updates graph
 * metadata for the losing member(s), preserving full history.
 */
export const resolveConflict = async (req, res) => {
  try {
    const conflict = await getConflictSetById(req.params.id);
    if (!conflict) {
      return res
        .status(404)
        .json({ success: false, message: "Conflict set not found" });
    }

    const organization = req.user.organization || null;
    const conflictOrg = conflict.organization
      ? conflict.organization.toString()
      : null;
    if (conflictOrg !== (organization ? organization.toString() : null)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { resolutionType, keptMemoryId, customValue, note } = req.body || {};

    const resolved = await resolveConflictSet(req.params.id, {
      resolutionType,
      keptMemoryId,
      customValue,
      note,
      resolvedBy: req.user._id,
    });

    if (organization) {
      await AuditLog.create({
        organization,
        actor: req.user._id,
        action: "conflict_resolved",
        entity: "ConflictSet",
        entityId: resolved._id,
        details: {
          modelType: resolved.modelType,
          resolutionType: resolved.resolution.type,
          keptMemoryId: resolved.resolution.keptMemoryId,
        },
      });
    }

    res.status(200).json({ success: true, conflict: resolved });
  } catch (error) {
    console.error("resolveConflict error:", error);
    const clientErrors = [
      "Conflict set not found",
      "already",
      "Invalid resolutionType",
      "keptMemoryId must reference",
    ];
    const isClientError = clientErrors.some((msg) =>
      error.message?.includes(msg),
    );
    res.status(isClientError ? 400 : 500).json({
      success: false,
      message: error.message || "Failed to resolve conflict",
    });
  }
};
