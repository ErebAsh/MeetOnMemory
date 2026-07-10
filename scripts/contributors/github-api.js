import { API } from "./constants.js";
import {
  formatError,
  getOrCreateContributor,
  isAutomationGalleryPullRequest,
  isIgnoredBot,
  purgeAutomationAccounts,
  recordMergedPullRequest,
  sleep,
} from "./utils.js";

/**
 * @param {string} token
 * @returns {Record<string, string>}
 */
function restHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} attempt
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, init, attempt = 1) {
  const response = await fetch(url, init);
  if (response.status === 403 || response.status === 429) {
    const reset = response.headers.get("x-ratelimit-reset");
    const waitMs = reset
      ? Math.max(Number(reset) * 1000 - Date.now(), API.retryDelayMs)
      : API.retryDelayMs * attempt;
    if (attempt <= API.maxRetries) {
      console.warn(
        `Rate limited. Retrying in ${waitMs}ms (attempt ${attempt})`,
      );
      await sleep(waitMs);
      return fetchWithRetry(url, init, attempt + 1);
    }
  }
  if (!response.ok && attempt < API.maxRetries && response.status >= 500) {
    await sleep(API.retryDelayMs * attempt);
    return fetchWithRetry(url, init, attempt + 1);
  }
  return response;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {{ includeCommitCounts?: boolean, maxCommitLookups?: number }} [options]
 * @returns {Promise<Record<string, import("./utils.js").ContributorStats>>}
 */
export async function fetchMergedPullRequestsViaRest(
  owner,
  repo,
  token,
  options = {},
) {
  const { includeCommitCounts = true, maxCommitLookups = 25 } = options;
  const contributors = {};
  let page = 1;
  let commitLookups = 0;
  let mergedPullCount = 0;

  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=${API.perPage}&page=${page}&sort=updated&direction=desc`;
    const response = await fetchWithRetry(url, { headers: restHeaders(token) });
    if (!response.ok) {
      throw new Error(
        `REST pulls failed: ${response.status} ${response.statusText}`,
      );
    }
    const pulls = await response.json();
    if (!Array.isArray(pulls) || pulls.length === 0) break;

    for (const pull of pulls) {
      if (!pull.merged_at) continue;
      if (isAutomationGalleryPullRequest(pull)) continue;
      mergedPullCount += 1;
      const login = pull.user?.login;
      if (isIgnoredBot(login)) continue;

      const contributor = getOrCreateContributor(contributors, login);
      if (pull.user?.avatar_url) contributor.avatarUrl = pull.user.avatar_url;
      if (pull.user?.html_url) contributor.profileUrl = pull.user.html_url;

      let commitCount = 1;
      if (includeCommitCounts && commitLookups < maxCommitLookups) {
        commitCount = await fetchPullCommitCount(
          owner,
          repo,
          pull.number,
          token,
        );
        commitLookups += 1;
      }
      recordMergedPullRequest(contributor, pull.merged_at, commitCount);
    }

    if (pulls.length < API.perPage) break;
    page += 1;
  }

  if (mergedPullCount > maxCommitLookups) {
    throw new Error(
      `REST commit lookup limit exceeded (${mergedPullCount} merged PRs). Switching to GraphQL.`,
    );
  }

  return contributors;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {number} pullNumber
 * @param {string} token
 * @returns {Promise<number>}
 */
async function fetchPullCommitCount(owner, repo, pullNumber, token) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/commits?per_page=1`;
    const response = await fetchWithRetry(url, { headers: restHeaders(token) });
    if (!response.ok) return 1;
    const link = response.headers.get("link") || "";
    const lastMatch = link.match(/page=(\d+)>; rel="last"/);
    if (lastMatch) return Number(lastMatch[1]);
    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data.length : 1;
  } catch (error) {
    console.warn(
      `Commit count fallback for PR #${pullNumber}: ${formatError(error)}`,
    );
    return 1;
  }
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<Record<string, import("./constants.js").ContributorStats>>}
 */
export async function fetchMergedPullRequestsViaGraphql(owner, repo, token) {
  const contributors = {};
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const query = `
      query($owner: String!, $repo: String!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          pullRequests(states: MERGED, first: ${API.graphqlBatchSize}, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
            pageInfo { hasNextPage endCursor }
            nodes {
              title
              mergedAt
              headRefName
              commits { totalCount }
              author {
                login
                avatarUrl
                url
                ... on Bot { login }
              }
            }
          }
        }
      }
    `;

    const response = await fetchWithRetry("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        ...restHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { owner, repo, cursor } }),
    });

    if (!response.ok) {
      throw new Error(
        `GraphQL failed: ${response.status} ${response.statusText}`,
      );
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((e) => e.message).join("; "));
    }

    const connection = payload.data?.repository?.pullRequests;
    if (!connection) break;

    for (const pr of connection.nodes || []) {
      if (
        isAutomationGalleryPullRequest({
          title: pr.title,
          head: { ref: pr.headRefName },
        })
      ) {
        continue;
      }
      const login = pr.author?.login;
      if (isIgnoredBot(login)) continue;
      const contributor = getOrCreateContributor(contributors, login);
      if (pr.author?.avatarUrl) contributor.avatarUrl = pr.author.avatarUrl;
      if (pr.author?.url) contributor.profileUrl = pr.author.url;
      recordMergedPullRequest(
        contributor,
        pr.mergedAt,
        pr.commits?.totalCount || 1,
      );
    }

    hasNextPage = connection.pageInfo?.hasNextPage === true;
    cursor = connection.pageInfo?.endCursor || null;
  }

  return contributors;
}

/**
 * @param {Record<string, import("./constants.js").ContributorStats>} contributors
 * @param {string} token
 * @returns {Promise<Record<string, import("./constants.js").ContributorStats>>}
 */
export async function enrichContributorProfiles(contributors, token) {
  const entries = Object.values(contributors);
  for (const contributor of entries) {
    if (!contributor.login) continue;
    try {
      const response = await fetchWithRetry(
        `https://api.github.com/users/${contributor.login}`,
        { headers: restHeaders(token) },
      );
      if (!response.ok) continue;
      const profile = await response.json();
      if (profile.type && profile.type !== "User") {
        delete contributors[contributor.login];
        continue;
      }
      if (profile.avatar_url) contributor.avatarUrl = profile.avatar_url;
      if (profile.html_url) contributor.profileUrl = profile.html_url;
    } catch (error) {
      console.warn(
        `Profile enrichment skipped for @${contributor.login}: ${formatError(error)}`,
      );
    }
  }
  return contributors;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<Record<string, ContributorStats>>}
 */
export async function fetchAllRepoContributors(owner, repo, token) {
  const contributors = {};
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${API.perPage}&page=${page}`;
    const response = await fetchWithRetry(url, { headers: restHeaders(token) });
    if (!response.ok) {
      throw new Error(
        `Contributors list failed: ${response.status} ${response.statusText}`,
      );
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) break;

    for (const row of rows) {
      const login = row.login;
      if (isIgnoredBot(login) || row.type !== "User") continue;
      contributors[login] = {
        login,
        avatarUrl: row.avatar_url || `https://github.com/${login}.png`,
        profileUrl: row.html_url || `https://github.com/${login}`,
        mergedPrs: 0,
        mergedCommits: Number(row.contributions || 0),
        firstMergedAt: null,
      };
    }

    if (rows.length < API.perPage) break;
    page += 1;
  }

  return contributors;
}

/**
 * Preserve historical contributors while keeping merged PR stats authoritative.
 * @param {Record<string, ContributorStats>} rankedStats
 * @param {Record<string, ContributorStats>} historical
 * @returns {Record<string, ContributorStats>}
 */
export function mergeHistoricalContributors(rankedStats, historical) {
  const merged = { ...rankedStats };
  for (const [login, contributor] of Object.entries(historical)) {
    if (isIgnoredBot(login)) continue;
    if (!merged[login]) {
      merged[login] = contributor;
      continue;
    }
    if (!merged[login].avatarUrl && contributor.avatarUrl) {
      merged[login].avatarUrl = contributor.avatarUrl;
    }
  }
  return purgeAutomationAccounts(merged);
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<Record<string, ContributorStats>>}
 */
export async function collectContributorStats(owner, repo, token) {
  try {
    console.log("Collecting contributor stats via GitHub REST API...");
    const restStats = await fetchMergedPullRequestsViaRest(owner, repo, token);
    if (Object.keys(restStats).length > 0) {
      return enrichContributorProfiles(
        purgeAutomationAccounts(restStats),
        token,
      );
    }
  } catch (error) {
    console.warn(`REST collection failed: ${formatError(error)}`);
  }

  try {
    console.log("Collecting contributor stats via GitHub GraphQL API...");
    const graphqlStats = await fetchMergedPullRequestsViaGraphql(
      owner,
      repo,
      token,
    );
    if (Object.keys(graphqlStats).length > 0) {
      return enrichContributorProfiles(
        purgeAutomationAccounts(graphqlStats),
        token,
      );
    }
  } catch (error) {
    console.warn(`GraphQL collection failed: ${formatError(error)}`);
  }

  throw new Error("GitHub API collection failed. Git fallback required.");
}
