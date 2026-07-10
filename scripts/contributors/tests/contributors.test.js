import test from "node:test";
import assert from "node:assert/strict";
import { rankContributors } from "../ranking.js";
import {
  generateContributorsBlock,
  replaceContributorsBlock,
} from "../readme-generator.js";
import { isIgnoredBot } from "../utils.js";
import { MARKERS } from "../constants.js";

test("rankContributors sorts by PRs, commits, then earliest contribution", () => {
  const ranked = rankContributors({
    alice: {
      login: "alice",
      avatarUrl: "",
      profileUrl: "",
      mergedPrs: 10,
      mergedCommits: 20,
      firstMergedAt: "2024-02-01T00:00:00.000Z",
    },
    bob: {
      login: "bob",
      avatarUrl: "",
      profileUrl: "",
      mergedPrs: 10,
      mergedCommits: 30,
      firstMergedAt: "2024-01-01T00:00:00.000Z",
    },
    carol: {
      login: "carol",
      avatarUrl: "",
      profileUrl: "",
      mergedPrs: 12,
      mergedCommits: 5,
      firstMergedAt: "2024-03-01T00:00:00.000Z",
    },
  });

  assert.deepEqual(
    ranked.map((c) => c.login),
    ["carol", "bob", "alice"],
  );
});

test("rankContributors uses earliest contribution as final tie-breaker", () => {
  const ranked = rankContributors({
    late: {
      login: "late",
      avatarUrl: "",
      profileUrl: "",
      mergedPrs: 5,
      mergedCommits: 10,
      firstMergedAt: "2024-06-01T00:00:00.000Z",
    },
    early: {
      login: "early",
      avatarUrl: "",
      profileUrl: "",
      mergedPrs: 5,
      mergedCommits: 10,
      firstMergedAt: "2024-01-01T00:00:00.000Z",
    },
  });

  assert.equal(ranked[0].login, "early");
});

test("generateContributorsBlock includes hall of fame and all contributors", () => {
  const ranked = Array.from({ length: 7 }).map((_, index) => ({
    login: `user${index}`,
    avatarUrl: `https://github.com/user${index}.png`,
    profileUrl: `https://github.com/user${index}`,
    mergedPrs: 10 - index,
    mergedCommits: 20 - index,
    firstMergedAt: `2024-01-0${index + 1}T00:00:00.000Z`,
  }));

  const block = generateContributorsBlock(ranked);
  assert.match(block, /## 🏆 Hall of Fame/);
  assert.match(block, /## ❤️ All Contributors/);
  assert.match(block, /@user0/);
  assert.match(block, /@user6/);
  assert.equal((block.match(/user0/g) || []).length >= 1, true);
});

test("replaceContributorsBlock preserves content outside markers", () => {
  const readme = `# Title\n\n${MARKERS.start}\nold\n${MARKERS.end}\n\nFooter`;
  const updated = replaceContributorsBlock(readme, "new-block");
  assert.match(updated, /# Title/);
  assert.match(updated, /new-block/);
  assert.match(updated, /Footer/);
  assert.doesNotMatch(updated, /old/);
});

test("isIgnoredBot filters automation accounts", () => {
  assert.equal(isIgnoredBot("github-actions[bot]"), true);
  assert.equal(isIgnoredBot("github-actions"), true);
  assert.equal(isIgnoredBot("dependabot[bot]"), true);
  assert.equal(isIgnoredBot("semantic-release-bot"), true);
  assert.equal(isIgnoredBot("imuniqueshiv"), false);
});

test("isAutomationGalleryPullRequest filters gallery automation PRs", async () => {
  const { isAutomationGalleryPullRequest } = await import("../utils.js");
  assert.equal(
    isAutomationGalleryPullRequest({
      title: "docs: update contributors gallery",
      head: { ref: "feature/test" },
    }),
    true,
  );
  assert.equal(
    isAutomationGalleryPullRequest({
      title: "feat: add search",
      head: { ref: "automation/update-contributors" },
    }),
    true,
  );
  assert.equal(
    isAutomationGalleryPullRequest({
      title: "feat: add search",
      head: { ref: "feature/search" },
    }),
    false,
  );
});

test("purgeAutomationAccounts removes bot entries", async () => {
  const { purgeAutomationAccounts } = await import("../utils.js");
  const cleaned = purgeAutomationAccounts({
    human: {
      login: "human",
      avatarUrl: "",
      profileUrl: "",
      mergedPrs: 1,
      mergedCommits: 1,
      firstMergedAt: null,
    },
    "github-actions": {
      login: "github-actions",
      avatarUrl: "",
      profileUrl: "",
      mergedPrs: 5,
      mergedCommits: 5,
      firstMergedAt: null,
    },
  });
  assert.ok(cleaned.human);
  assert.equal(cleaned["github-actions"], undefined);
});

test("mergeHistoricalContributors keeps contributors missing from PR stats", async () => {
  const { mergeHistoricalContributors } = await import("../github-api.js");
  const merged = mergeHistoricalContributors(
    {
      active: {
        login: "active",
        avatarUrl: "a.png",
        profileUrl: "https://github.com/active",
        mergedPrs: 2,
        mergedCommits: 4,
        firstMergedAt: "2024-01-01T00:00:00.000Z",
      },
    },
    {
      legacy: {
        login: "legacy",
        avatarUrl: "l.png",
        profileUrl: "https://github.com/legacy",
        mergedPrs: 0,
        mergedCommits: 3,
        firstMergedAt: null,
      },
    },
  );

  assert.ok(merged.active);
  assert.ok(merged.legacy);
});
