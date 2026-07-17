// ==============================================
// 📘 memoryConsolidationService.js
// AI-Powered Memory Consolidation Engine
//
// The knowledge graph stores "memories" as Decision and ActionItem
// documents (see knowledgeGraphService.js). As meetings accumulate, the
// same fact often gets re-recorded with different wording
// ("I live in Delhi" / "My home city is Delhi" / "I currently stay in
// Delhi"). This service finds those duplicate/near-duplicate memories,
// merges them into a single canonical record, and preserves everything
// that made the duplicates meaningful: aliases, relationships (graph
// edges), version history, and any conflicting metadata.
//
// Design notes:
// - Runs per-model (Decision, ActionItem) and per-organization so
//   multi-tenant isolation matches the rest of the knowledge graph.
// - Never deletes documents. Merged-away memories are kept with
//   `supersededByMemory` pointing at the canonical record, so anything
//   that still references their _id (audit logs, exports, direct links)
//   keeps working. This also means it never changes existing read APIs
//   for callers that don't yet know about consolidation.
// - Clustering uses union-find so transitive duplicates
//   (A~B, B~C => A~B~C) are merged together in one pass.
// ==============================================

import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import { cosineSimilarity } from "./knowledgeGraphService.js";
import { computeTextSimilarity } from "../utils/textSimilarity.js";

// Model registry: keeps the engine generic across memory types instead of
// hard-coding Decision/ActionItem logic twice.
const MODEL_REGISTRY = {
  decision: {
    Model: Decision,
    label: "Decision",
    // Fields (beyond text/aliases/relatesTo/history, which are handled
    // generically) that can disagree between duplicates and need a
    // resolution rule.
    conflictFields: ["owner", "status"],
  },
  actionItem: {
    Model: ActionItem,
    label: "ActionItem",
    conflictFields: ["owner", "status", "dueDate"],
  },
};

export const DEFAULT_EMBEDDING_THRESHOLD = 0.9;
export const DEFAULT_TEXT_THRESHOLD = 0.82;

// resolved/superseded are "terminal" states — if any duplicate reached one,
// the canonical memory should reflect that, since they describe the same
// underlying fact/task.
const STATUS_PRECEDENCE = ["open", "in-progress", "resolved", "superseded"];

function assertSupportedModel(modelType) {
  if (!MODEL_REGISTRY[modelType]) {
    throw new Error(
      `Unsupported memory type "${modelType}". Expected one of: ${Object.keys(
        MODEL_REGISTRY,
      ).join(", ")}`,
    );
  }
  return MODEL_REGISTRY[modelType];
}

// ------------------------------------------------------------------
// Union-Find (Disjoint Set) — groups records into duplicate clusters
// ------------------------------------------------------------------
class DisjointSet {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }

  find(id) {
    let root = id;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    // Path compression
    let curr = id;
    while (this.parent.get(curr) !== root) {
      const next = this.parent.get(curr);
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }

  groups() {
    const clusters = new Map();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(id);
    }
    return [...clusters.values()];
  }
}

/**
 * Pairwise-compares similarity score between two memory records using
 * embeddings first (more semantically robust), falling back to / boosted
 * by lexical paraphrase similarity when embeddings are unavailable or
 * inconclusive.
 */
export function areMemoriesSimilar(
  recordA,
  recordB,
  {
    embeddingThreshold = DEFAULT_EMBEDDING_THRESHOLD,
    textThreshold = DEFAULT_TEXT_THRESHOLD,
  } = {},
) {
  const hasEmbeddings =
    recordA.embedding?.length &&
    recordB.embedding?.length &&
    recordA.embedding.length === recordB.embedding.length;

  const embeddingScore = hasEmbeddings
    ? cosineSimilarity(recordA.embedding, recordB.embedding)
    : 0;

  const textScore = computeTextSimilarity(recordA.text, recordB.text);

  const isDuplicate =
    (hasEmbeddings && embeddingScore >= embeddingThreshold) ||
    textScore >= textThreshold;

  return {
    isDuplicate,
    embeddingScore,
    textScore,
    // Best available signal, useful for ranking/debugging.
    combinedScore: Math.max(hasEmbeddings ? embeddingScore : 0, textScore),
  };
}

/**
 * Groups a flat list of memory records into duplicate/paraphrase clusters.
 * Only clusters with 2+ members represent actual consolidation work.
 */
export function buildDuplicateClusters(records, options = {}) {
  const ids = records.map((r) => r._id.toString());
  const dsu = new DisjointSet(ids);
  const byId = new Map(records.map((r) => [r._id.toString(), r]));

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      const { isDuplicate } = areMemoriesSimilar(a, b, options);
      if (isDuplicate) {
        dsu.union(a._id.toString(), b._id.toString());
      }
    }
  }

  return dsu
    .groups()
    .filter((group) => group.length > 1)
    .map((group) => group.map((id) => byId.get(id)));
}

/**
 * Chooses the canonical record for a cluster of duplicate memories.
 * Preference order:
 *   1. Earliest created — the first time this fact/task entered the graph.
 *   2. Most existing relationships — already the most "connected" node,
 *      so repointing edges elsewhere would lose more context.
 *   3. Longest text — tends to be the most descriptive phrasing.
 */
export function selectCanonical(cluster) {
  return [...cluster].sort((a, b) => {
    const createdDiff = new Date(a.createdAt) - new Date(b.createdAt);
    if (createdDiff !== 0) return createdDiff;

    const relDiff = (b.relatesTo?.length || 0) - (a.relatesTo?.length || 0);
    if (relDiff !== 0) return relDiff;

    return (b.text?.length || 0) - (a.text?.length || 0);
  })[0];
}

/**
 * Resolves a single conflicting field between the canonical record and its
 * duplicates. Returns { value, changed, values } — `values` lists every
 * distinct value seen, for the audit trail.
 */
function resolveField(field, canonical, duplicates) {
  const all = [canonical, ...duplicates];
  const distinctValues = [
    ...new Set(all.map((r) => serializeFieldValue(r[field]))),
  ];

  if (distinctValues.length <= 1) {
    return { value: canonical[field], changed: false, values: distinctValues };
  }

  let resolvedValue = canonical[field];

  if (field === "status") {
    resolvedValue = all
      .map((r) => r.status)
      .reduce((best, current) =>
        STATUS_PRECEDENCE.indexOf(current) > STATUS_PRECEDENCE.indexOf(best)
          ? current
          : best,
      );
  } else if (field === "owner") {
    // Prefer a real, assigned owner over the empty/"Unassigned" default.
    const isDefaultOwner = (o) => !o || o === "Unassigned";
    const assigned = all.map((r) => r.owner).find((o) => !isDefaultOwner(o));
    resolvedValue = assigned || canonical.owner;
  } else if (field === "dueDate") {
    // Keep the earliest non-null deadline — the more conservative choice.
    const dates = all
      .map((r) => r.dueDate)
      .filter(Boolean)
      .map((d) => new Date(d));
    resolvedValue = dates.length
      ? new Date(Math.min(...dates.map((d) => d.getTime())))
      : null;
  }

  const changed =
    serializeFieldValue(resolvedValue) !==
    serializeFieldValue(canonical[field]);

  return { value: resolvedValue, changed, values: distinctValues };
}

function serializeFieldValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Applies conflict resolution across the configured fields for a memory
 * type, mutating `canonical` in place and returning the list of conflict
 * records to store on `mergeConflicts`.
 */
function resolveConflicts(modelType, canonical, duplicates) {
  const { conflictFields } = assertSupportedModel(modelType);
  const conflicts = [];

  for (const field of conflictFields) {
    const { value, changed, values } = resolveField(
      field,
      canonical,
      duplicates,
    );
    if (values.length > 1) {
      conflicts.push({
        field,
        values,
        resolution: `Resolved to "${serializeFieldValue(value)}"`,
        resolvedAt: new Date(),
      });
    }
    if (changed) canonical[field] = value;
  }

  return conflicts;
}

/**
 * Merges `relatesTo` edges from duplicates into the canonical record,
 * deduping by target and keeping the highest confidence for any shared
 * target. Skips self-referential edges created by the merge itself.
 */
function mergeRelationships(canonical, duplicates, mergedIdSet) {
  const byTarget = new Map(
    canonical.relatesTo.map((edge) => [edge.target.toString(), edge]),
  );

  for (const duplicate of duplicates) {
    for (const edge of duplicate.relatesTo || []) {
      const targetId = edge.target.toString();
      if (targetId === canonical._id.toString()) continue; // would self-loop
      if (mergedIdSet.has(targetId)) continue; // duplicate merging into itself/cluster

      const existing = byTarget.get(targetId);
      if (!existing || edge.confidence > existing.confidence) {
        byTarget.set(targetId, {
          target: edge.target,
          confidence: edge.confidence,
          computedAt: edge.computedAt || new Date(),
        });
      }
    }
  }

  canonical.relatesTo = [...byTarget.values()];
}

/**
 * Merges one cluster of duplicate memories into a single canonical record.
 * Returns a summary of the merge. When `dryRun` is true, no writes happen
 * and the summary describes what *would* be merged.
 */
export async function mergeCluster(modelType, cluster, { dryRun = true } = {}) {
  if (!cluster || cluster.length < 2) return null;
  const { Model } = assertSupportedModel(modelType);

  const canonical = selectCanonical(cluster);
  const duplicates = cluster.filter(
    (r) => r._id.toString() !== canonical._id.toString(),
  );
  const mergedIdSet = new Set(cluster.map((r) => r._id.toString()));

  // --- Aliases: every distinct phrasing that isn't the canonical text ---
  const existingAliases = new Set(canonical.aliases || []);
  for (const dup of duplicates) {
    if (dup.text && dup.text !== canonical.text) existingAliases.add(dup.text);
    for (const alias of dup.aliases || []) existingAliases.add(alias);
  }
  existingAliases.delete(canonical.text);

  // --- Version history: snapshot each duplicate exactly as it was ---
  const mergeHistoryEntries = duplicates.map((dup) => ({
    originalId: dup._id,
    text: dup.text,
    owner: dup.owner,
    status: dup.status,
    ...(modelType === "actionItem" ? { dueDate: dup.dueDate || null } : {}),
    sourceMeetingId: dup.sourceMeetingId,
    mergedAt: new Date(),
  }));

  const conflicts = resolveConflicts(modelType, canonical, duplicates);
  mergeRelationships(canonical, duplicates, mergedIdSet);

  canonical.aliases = [...existingAliases];
  canonical.mergedFrom = [
    ...(canonical.mergedFrom || []),
    ...duplicates.flatMap((d) => d.mergedFrom || []),
    ...mergeHistoryEntries,
  ];
  canonical.mergeConflicts = [
    ...(canonical.mergeConflicts || []),
    ...conflicts,
  ];
  canonical.lastConsolidatedAt = new Date();

  const summary = {
    modelType,
    canonicalId: canonical._id.toString(),
    canonicalText: canonical.text,
    mergedIds: duplicates.map((d) => d._id.toString()),
    aliasesAdded: [...existingAliases],
    conflicts,
    dryRun,
  };

  if (dryRun) return summary;

  await canonical.save();

  for (const dup of duplicates) {
    dup.supersededByMemory = canonical._id;
    dup.lastConsolidatedAt = new Date();
    // Clear relatesTo on the merged-away record — its relationships now
    // live on the canonical record. The record itself is preserved intact
    // for history via mergedFrom/supersededByMemory, not deleted.
    dup.relatesTo = [];
    await dup.save();
  }

  await repointGraphEdges(
    Model,
    duplicates.map((d) => d._id),
    canonical._id,
  );

  return summary;
}

/**
 * After a cluster has been merged, any *other* document in the collection
 * that still has a `relatesTo` edge pointing at one of the merged-away ids
 * needs to be repointed at the new canonical id — otherwise graph
 * traversals (e.g. getDecisionLineage) would silently dead-end.
 */
export async function repointGraphEdges(Model, mergedAwayIds, canonicalId) {
  const mergedAwaySet = new Set(mergedAwayIds.map((id) => id.toString()));
  if (mergedAwaySet.size === 0) return 0;

  const referencingDocs = await Model.find({
    "relatesTo.target": { $in: [...mergedAwaySet] },
  });

  let updatedCount = 0;
  for (const doc of referencingDocs) {
    const byTarget = new Map();
    for (const edge of doc.relatesTo) {
      const targetId = edge.target.toString();
      const resolvedTarget = mergedAwaySet.has(targetId)
        ? canonicalId.toString()
        : targetId;

      if (resolvedTarget === doc._id.toString()) continue; // avoid self-loop

      const existing = byTarget.get(resolvedTarget);
      if (!existing || edge.confidence > existing.confidence) {
        byTarget.set(resolvedTarget, {
          target: resolvedTarget,
          confidence: edge.confidence,
          computedAt: edge.computedAt || new Date(),
        });
      }
    }
    doc.relatesTo = [...byTarget.values()];
    await doc.save();
    updatedCount += 1;
  }

  return updatedCount;
}

/**
 * Runs the full consolidation pipeline for a single memory type, scoped to
 * an organization (or global/null-org memories).
 */
export async function consolidateModel(
  modelType,
  {
    organization = null,
    dryRun = true,
    embeddingThreshold,
    textThreshold,
  } = {},
) {
  const { Model } = assertSupportedModel(modelType);

  // Only consider active, still-canonical memories as clustering input —
  // records already merged away shouldn't be re-clustered.
  const records = await Model.find({
    organization: organization || null,
    supersededByMemory: null,
  });

  const clusters = buildDuplicateClusters(records, {
    embeddingThreshold,
    textThreshold,
  });

  const mergeSummaries = [];
  for (const cluster of clusters) {
    const summary = await mergeCluster(modelType, cluster, { dryRun });
    if (summary) mergeSummaries.push(summary);
  }

  return {
    modelType,
    recordsScanned: records.length,
    clustersFound: clusters.length,
    merges: mergeSummaries,
  };
}

/**
 * Entry point for the Memory Consolidation Engine. Runs across the
 * requested memory types (default: all supported types) for a given
 * organization and returns a combined report.
 */
export async function consolidateMemories({
  organization = null,
  dryRun = true,
  models = Object.keys(MODEL_REGISTRY),
  embeddingThreshold = DEFAULT_EMBEDDING_THRESHOLD,
  textThreshold = DEFAULT_TEXT_THRESHOLD,
} = {}) {
  const invalidModels = models.filter((m) => !MODEL_REGISTRY[m]);
  if (invalidModels.length) {
    throw new Error(`Unsupported memory type(s): ${invalidModels.join(", ")}`);
  }

  const results = {};
  for (const modelType of models) {
    results[modelType] = await consolidateModel(modelType, {
      organization,
      dryRun,
      embeddingThreshold,
      textThreshold,
    });
  }

  const totalClustersFound = Object.values(results).reduce(
    (sum, r) => sum + r.clustersFound,
    0,
  );
  const totalMerged = Object.values(results).reduce(
    (sum, r) => sum + r.merges.length,
    0,
  );

  return {
    dryRun,
    organization: organization ? organization.toString() : null,
    totalClustersFound,
    totalMerged,
    results,
  };
}

/**
 * Fetches canonical memories that resulted from a consolidation (i.e. have
 * at least one merged alias/history entry), for display/audit purposes.
 */
export async function getConsolidatedMemories(
  modelType,
  { organization = null, limit = 50 } = {},
) {
  const { Model } = assertSupportedModel(modelType);

  return Model.find({
    organization: organization || null,
    "mergedFrom.0": { $exists: true },
  })
    .sort({ lastConsolidatedAt: -1 })
    .limit(Math.min(limit, 200));
}

export { MODEL_REGISTRY };
