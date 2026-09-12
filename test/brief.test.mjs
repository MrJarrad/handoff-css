// P17/0.4.1 — the brief JSON companion (schema `design-handoff` v10) is the
// machine contract; the markdown stays the human rendering. Asserted against
// the real 08:20 export (v14).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateBriefJson, validateBriefPair } from "../src/brief.mjs";

const dir = new URL("../fixtures/jhd-v11-2026-09-12/", import.meta.url);
const doc = () => JSON.parse(readFileSync(new URL("design-handoff-block-navigation.json", dir), "utf8"));
const md = () => readFileSync(new URL("design-handoff-block-navigation.md", dir), "utf8");

test("the real v14 brief JSON validates against schema v10 with zero errors", () => {
  const { ok, errors } = validateBriefJson(doc());
  assert.equal(ok, true, errors.map((e) => `${e.path} ${e.message}`).join("; "));
});

test("a brief missing its required identity fields fails schema validation", () => {
  const { ok, errors } = validateBriefJson({ schema: "design-handoff", schemaVersion: 10 });
  assert.equal(ok, false);
  assert.ok(errors.length > 0);
});

test("the real pair reconciles: identity fields match between JSON and markdown", () => {
  const { ok, findings } = validateBriefPair(doc(), md());
  assert.equal(ok, true, findings.map((f) => `${f.code} ${f.message}`).join("; "));
});

test("a JSON designSystemStateHash that disagrees with the markdown front matter is PAIR_IDENTITY_MISMATCH", () => {
  const mutated = { ...doc(), designSystemStateHash: "mismatched" };
  const { ok, findings } = validateBriefPair(mutated, md());
  assert.equal(ok, false);
  assert.ok(findings.some((f) => f.code === "PAIR_IDENTITY_MISMATCH" && /designSystemStateHash/.test(f.message)));
});

test("a markdown with no front matter is MD_FRONT_MATTER_MISSING", () => {
  const { ok, findings } = validateBriefPair(doc(), "# no front matter here\n");
  assert.equal(ok, false);
  assert.ok(findings.some((f) => f.code === "MD_FRONT_MATTER_MISSING"));
});
