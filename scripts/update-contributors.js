import { readFile, writeFile } from "node:fs/promises";
import {
  collectContributorStats,
  fetchAllRepoContributors,
  mergeHistoricalContributors,
} from "./contributors/github-api.js";
import { collectContributorStatsFromGit } from "./contributors/git-fallback.js";
import { rankContributors } from "./contributors/ranking.js";
import {
  generateContributorsBlock,
  replaceContributorsBlock,
} from "./contributors/readme-generator.js";
import {
  formatError,
  parseRepository,
  purgeAutomationAccounts,
} from "./contributors/utils.js";

const README_PATH = process.env.README_PATH || "README.md";

// Default repository for local execution
const DEFAULT_REPOSITORY = "imuniqueshiv/MeetOnMemory";

/**
 * Resolve repository from:
 * 1. GitHub Actions (GITHUB_REPOSITORY)
 * 2. CLI (--repo owner/repo)
 * 3. Local fallback
 */
function resolveRepository() {
  const repoArgIndex = process.argv.indexOf("--repo");

  if (repoArgIndex !== -1 && process.argv.length > repoArgIndex + 1) {
    return process.argv[repoArgIndex + 1];
  }

  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }

  console.warn(
    `⚠️ GITHUB_REPOSITORY not found. Falling back to "${DEFAULT_REPOSITORY}".`,
  );

  return DEFAULT_REPOSITORY;
}

/**
 * Main
 */
async function main() {
  const repository = resolveRepository();

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

  if (!token) {
    console.warn(
      "⚠️ No GitHub token detected. API requests may be rate-limited. Falling back to git history if necessary.",
    );
  }

  const { owner, repo } = parseRepository(repository);

  let contributorMap = {};

  try {
    contributorMap = await collectContributorStats(owner, repo, token);

    try {
      const historical = await fetchAllRepoContributors(owner, repo, token);

      contributorMap = mergeHistoricalContributors(contributorMap, historical);
    } catch (historicalError) {
      console.warn(
        `Historical contributor merge skipped: ${formatError(historicalError)}`,
      );
    }
  } catch (apiError) {
    console.warn(`GitHub API unavailable: ${formatError(apiError)}`);

    console.warn("Using git history fallback...");

    contributorMap = await collectContributorStatsFromGit(owner, repo);
  }

  const ranked = rankContributors(purgeAutomationAccounts(contributorMap));

  if (ranked.length === 0) {
    console.log("No human contributors found. README unchanged.");
    return;
  }

  const contributorsBlock = generateContributorsBlock(ranked);

  const readme = await readFile(README_PATH, "utf8");

  const updatedReadme = replaceContributorsBlock(readme, contributorsBlock);

  if (updatedReadme === readme) {
    console.log("Contributor section already up to date.");
    return;
  }

  await writeFile(README_PATH, updatedReadme, "utf8");

  console.log("");
  console.log("✅ Contributor gallery updated.");
  console.log(`Repository : ${repository}`);
  console.log(`Contributors : ${ranked.length}`);
  console.log(`Hall of Fame : ${Math.min(5, ranked.length)}`);
}

main().catch((error) => {
  console.error(`Contributor gallery update failed: ${formatError(error)}`);

  process.exit(1);
});
