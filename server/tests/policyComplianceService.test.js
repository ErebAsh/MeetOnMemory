import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseClassification,
  buildClassificationPrompt,
} from "../services/policyComplianceService.js";
import fixtures from "./fixtures/policyComplianceFixtures.json" with { type: "json" };

describe("parseClassification", () => {
  test("parses a clean JSON response", () => {
    const raw = JSON.stringify({
      classification: "potential_conflict",
      reasoning: "Exceeds the pre-approval threshold.",
    });
    const result = parseClassification(raw);
    assert.equal(result.classification, "potential_conflict");
    assert.equal(result.reasoning, "Exceeds the pre-approval threshold.");
  });

  test("strips markdown code fences before parsing", () => {
    const raw =
      '```json\n{"classification":"aligned","reasoning":"Matches policy."}\n```';
    const result = parseClassification(raw);
    assert.equal(result.classification, "aligned");
  });

  test("falls back to 'unrelated' for an unrecognized classification value", () => {
    // Guards against the LLM inventing a label outside the enum — a
    // hallucinated classification must never be treated as a valid flag.
    const raw = JSON.stringify({
      classification: "definitely_illegal",
      reasoning: "should not be trusted",
    });
    const result = parseClassification(raw);
    assert.equal(result.classification, "unrelated");
  });

  test("fails conservative (unrelated) on unparsable input", () => {
    // A malformed/empty LLM response must never silently become a conflict flag.
    const result = parseClassification("not valid json at all {{{");
    assert.equal(result.classification, "unrelated");
    assert.match(result.reasoning, /could not be parsed/i);
  });

  test("truncates excessively long reasoning text", () => {
    const longReasoning = "x".repeat(5000);
    const raw = JSON.stringify({
      classification: "references",
      reasoning: longReasoning,
    });
    const result = parseClassification(raw);
    assert.ok(result.reasoning.length <= 1000);
  });

  test("handles missing reasoning field gracefully", () => {
    const raw = JSON.stringify({ classification: "unrelated" });
    const result = parseClassification(raw);
    assert.equal(result.classification, "unrelated");
    assert.equal(result.reasoning, "");
  });
});

describe("buildClassificationPrompt", () => {
  test("includes the decision text, policy name, version, and summary", () => {
    const policy = {
      name: "Expense Reimbursement Policy",
      version: "2.0",
      summary: "Requires pre-approval above $500.",
      key_changes: ["Raised threshold from $250 to $500"],
    };
    const prompt = buildClassificationPrompt(
      "Approved a $1,200 purchase without pre-approval.",
      policy,
    );

    assert.match(prompt, /Approved a \$1,200 purchase without pre-approval\./);
    assert.match(prompt, /Expense Reimbursement Policy/);
    assert.match(prompt, /version 2\.0/);
    assert.match(prompt, /Requires pre-approval above \$500\./);
    assert.match(prompt, /Raised threshold from \$250 to \$500/);
  });

  test("instructs conservative bias against false conflict flags", () => {
    const prompt = buildClassificationPrompt("some decision", {
      name: "Policy",
      version: "1.0",
      summary: "",
      key_changes: [],
    });
    assert.match(prompt, /conservative/i);
    assert.match(prompt, /only use this if genuinely confident/i);
  });

  test("requests strict JSON output matching the four-way enum", () => {
    const prompt = buildClassificationPrompt("some decision", {
      name: "Policy",
      version: "1.0",
      summary: "",
      key_changes: [],
    });
    assert.match(prompt, /"aligned" \| "references" \| "potential_conflict" \| "unrelated"/);
  });

  test("handles a policy with no key_changes without throwing", () => {
    assert.doesNotThrow(() =>
      buildClassificationPrompt("decision text", {
        name: "Policy",
        version: "1.0",
        summary: "summary text",
        key_changes: undefined,
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Hand-labeled fixture set (acceptance criterion: "LLM classification
// prompt (with a small hand-labeled fixture set)"). These assert the
// *prompt* is well-formed for every fixture; running the fixtures against
// a live Gemini call to check actual classification accuracy is done via
// scripts/evalPolicyComplianceFixtures.js against a real GEMINI_API_KEY,
// since that requires network access this sandbox/CI unit run doesn't have.
// ─────────────────────────────────────────────────────────────
describe("hand-labeled fixture set", () => {
  for (const fixture of fixtures) {
    test(`prompt for fixture "${fixture.id}" is well-formed`, () => {
      const prompt = buildClassificationPrompt(fixture.decisionText, fixture.policy);
      assert.match(prompt, new RegExp(fixture.policy.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.ok(prompt.includes(fixture.decisionText));
      assert.ok(
        ["aligned", "references", "potential_conflict", "unrelated"].includes(
          fixture.expectedClassification,
        ),
        `fixture "${fixture.id}" has an invalid expectedClassification label`,
      );
    });
  }

  test("fixture set covers all four classification labels", () => {
    const labels = new Set(fixtures.map((f) => f.expectedClassification));
    assert.ok(labels.has("aligned"));
    assert.ok(labels.has("references"));
    assert.ok(labels.has("potential_conflict"));
    assert.ok(labels.has("unrelated"));
  });
});
