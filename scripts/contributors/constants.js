/** @typedef {{ login: string, avatarUrl: string, profileUrl: string, mergedPrs: number, mergedCommits: number, firstMergedAt: string | null }} ContributorStats */

export const MARKERS = Object.freeze({
  start: "<!-- CONTRIBUTORS:START -->",
  end: "<!-- CONTRIBUTORS:END -->",
});

export const IGNORED_ACCOUNTS = Object.freeze([
  "github-actions[bot]",
  "github-actions",
  "dependabot[bot]",
  "dependabot",
  "renovate[bot]",
  "renovate",
  "renovate-bot",
  "codecov[bot]",
  "codecov",
  "codecov-commenter",
  "imgbot[bot]",
  "imgbot",
  "stale[bot]",
  "stale",
  "semantic-release-bot",
  "allcontributors[bot]",
  "allcontributors",
]);

export const AUTOMATION_GALLERY = Object.freeze({
  prTitle: "docs: update contributors gallery",
  branch: "automation/update-contributors",
});

export const RANK_BADGES = Object.freeze(["🥇", "🥈", "🥉", "4", "5"]);

export const HALL_OF_FAME_SIZE = 5;

export const API = Object.freeze({
  perPage: 100,
  maxRetries: 3,
  retryDelayMs: 1500,
  graphqlBatchSize: 50,
});
