import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  getOrCreateContributor,
  isIgnoredBot,
  recordMergedPullRequest,
} from "./utils.js";

const execFileAsync = promisify(execFile);

/**
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Record<string, import("./constants.js").ContributorStats>>}
 */
export async function collectContributorStatsFromGit(owner, repo) {
  const contributors = {};
  const baseBranch = process.env.DEFAULT_BRANCH || "main";

  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "log",
        baseBranch,
        "--merges",
        "--pretty=format:%H|%an|%ae|%aI",
        "--grep=Merge pull request",
      ],
      { maxBuffer: 1024 * 1024 * 50 },
    );

    const lines = stdout.split("\n").filter(Boolean);
    for (const line of lines) {
      const [, authorName, authorEmail, mergedAt] = line.split("|");
      const login =
        resolveLoginFromEmail(authorEmail) || sanitizeAuthorName(authorName);
      if (isIgnoredBot(login)) continue;

      const contributor = getOrCreateContributor(contributors, login);
      recordMergedPullRequest(contributor, mergedAt, 1);
    }
  } catch (error) {
    console.warn(`Git fallback merge log failed: ${error.message}`);
  }

  if (Object.keys(contributors).length === 0) {
    const { stdout } = await execFileAsync(
      "git",
      ["log", baseBranch, "--pretty=format:%an|%ae|%aI", "--no-merges"],
      { maxBuffer: 1024 * 1024 * 50 },
    );
    for (const line of stdout.split("\n").filter(Boolean)) {
      const [authorName, authorEmail, mergedAt] = line.split("|");
      const login =
        resolveLoginFromEmail(authorEmail) || sanitizeAuthorName(authorName);
      if (isIgnoredBot(login)) continue;
      const contributor = getOrCreateContributor(contributors, login);
      recordMergedPullRequest(contributor, mergedAt, 1);
    }
  }

  if (Object.keys(contributors).length === 0) {
    throw new Error(
      `Git fallback produced no contributors for ${owner}/${repo}.`,
    );
  }

  console.log(
    `Git fallback collected ${Object.keys(contributors).length} contributors.`,
  );
  return contributors;
}

/**
 * @param {string | undefined} email
 * @returns {string | null}
 */
function resolveLoginFromEmail(email) {
  if (!email) return null;
  const noreply = email.match(
    /^(\d+\+)?([^@+]+)@users\.noreply\.github\.com$/i,
  );
  if (noreply?.[2]) return noreply[2];
  return null;
}

/**
 * @param {string | undefined} name
 * @returns {string}
 */
function sanitizeAuthorName(name) {
  return String(name || "unknown-contributor")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}
