import { AUTOMATION_GALLERY, IGNORED_ACCOUNTS } from "./constants.js";

/**
 * @typedef {{ login: string, avatarUrl: string, profileUrl: string, mergedPrs: number, mergedCommits: number, firstMergedAt: string | null }} ContributorStats
 */

/**
 * @param {string | undefined} login
 * @returns {boolean}
 */
export function isIgnoredBot(login) {
  if (!login) return true;
  const normalized = login.toLowerCase();
  if (normalized.endsWith("[bot]")) return true;
  return IGNORED_ACCOUNTS.map((b) => b.toLowerCase()).includes(normalized);
}

/**
 * @param {{ title?: string, head?: { ref?: string } }} pull
 * @returns {boolean}
 */
export function isAutomationGalleryPullRequest(pull) {
  const title = String(pull?.title || "")
    .trim()
    .toLowerCase();
  const headRef = String(pull?.head?.ref || "").trim();
  return (
    title === AUTOMATION_GALLERY.prTitle ||
    headRef === AUTOMATION_GALLERY.branch
  );
}

/**
 * @param {Record<string, ContributorStats>} contributorMap
 * @returns {Record<string, ContributorStats>}
 */
export function purgeAutomationAccounts(contributorMap) {
  const cleaned = {};
  for (const [login, stats] of Object.entries(contributorMap)) {
    if (!isIgnoredBot(login)) {
      cleaned[login] = stats;
    }
  }
  return cleaned;
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function formatError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * @param {string} repository
 * @returns {{ owner: string, repo: string }}
 */
export function parseRepository(repository) {
  const [owner, repo] = String(repository || "").split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY must be in owner/repo format.");
  }
  return { owner, repo };
}

/**
 * @param {Record<string, ContributorStats>} map
 * @param {string} login
 * @returns {ContributorStats}
 */
export function getOrCreateContributor(map, login) {
  if (!map[login]) {
    map[login] = {
      login,
      avatarUrl: `https://github.com/${login}.png`,
      profileUrl: `https://github.com/${login}`,
      mergedPrs: 0,
      mergedCommits: 0,
      firstMergedAt: null,
    };
  }
  return map[login];
}

/**
 * @param {ContributorStats} contributor
 * @param {string | null | undefined} mergedAt
 * @param {number} commitCount
 */
export function recordMergedPullRequest(contributor, mergedAt, commitCount) {
  contributor.mergedPrs += 1;
  contributor.mergedCommits += Math.max(commitCount, 1);
  if (
    mergedAt &&
    (!contributor.firstMergedAt || mergedAt < contributor.firstMergedAt)
  ) {
    contributor.firstMergedAt = mergedAt;
  }
}
