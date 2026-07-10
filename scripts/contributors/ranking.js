/**
 * @typedef {import("./constants.js").ContributorStats} ContributorStats
 */

/**
 * Sort contributors deterministically:
 * 1) merged PRs desc
 * 2) merged commits desc
 * 3) earliest merged contribution asc
 * @param {Record<string, ContributorStats>} contributorMap
 * @returns {ContributorStats[]}
 */
export function rankContributors(contributorMap) {
  return Object.values(contributorMap).sort((a, b) => {
    if (b.mergedPrs !== a.mergedPrs) return b.mergedPrs - a.mergedPrs;
    if (b.mergedCommits !== a.mergedCommits)
      return b.mergedCommits - a.mergedCommits;
    const aDate = a.firstMergedAt || "9999-12-31T23:59:59.000Z";
    const bDate = b.firstMergedAt || "9999-12-31T23:59:59.000Z";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.login.localeCompare(b.login);
  });
}

/**
 * @param {ContributorStats[]} ranked
 * @param {number} size
 * @returns {ContributorStats[]}
 */
export function getHallOfFame(ranked, size = 5) {
  return ranked.slice(0, size);
}
