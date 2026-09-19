// 0.8.0 — schema `design-handoff` v12 (export v16+) is additive over v11: a
// layer node may now carry per-node token/variable-binding provenance
// (`tokenBindings`, `variableBindings`, `styleBindings`), spacer/variant
// metadata (`componentPropertyDefinitions`, `variantStates`, `siblingIndex`),
// semantic inference detail (`semanticSource`, `semanticRejected`), and
// cosmetic node state (`opacity`, `rotation`, `description`,
// `descriptionHints`); the document itself may carry `schemaNote` and
// `validation.findings`. Asserted against the real 07:53 FeatureText block
// export (2026-09-19), which the v11 schema throws ~4600 errors on before
// this change (2026-09-17 finding).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateBriefJson, validateBriefPair } from "../src/brief.mjs";

const dir = new URL("../fixtures/jhd-v12-2026-09-19-feature-text/", import.meta.url);
const doc = () => JSON.parse(readFileSync(new URL("design-handoff.json", dir), "utf8"));
const md = () => readFileSync(new URL("design-handoff.md", dir), "utf8");

test("the real schema-12 FeatureText brief JSON has schemaVersion 12", () => {
  assert.equal(doc().schema, "design-handoff");
  assert.equal(doc().schemaVersion, 12);
});

test("the real schema-12 brief JSON validates against schema v12 with zero errors", () => {
  const { ok, errors } = validateBriefJson(doc());
  assert.equal(ok, true, errors.slice(0, 10).map((e) => `${e.path} ${e.message}`).join("; "));
});

test("the same document still fails schema v11 — proves v12 is a real dispatch target, not a silent fallback", () => {
  const v11doc = { ...doc(), schemaVersion: 11 };
  const { ok, errors } = validateBriefJson(v11doc);
  assert.equal(ok, false);
  assert.ok(errors.length > 0);
});

test("the real pair reconciles: identity fields match between JSON and markdown", () => {
  const { ok, findings } = validateBriefPair(doc(), md());
  assert.equal(ok, true, findings.map((f) => `${f.code} ${f.message}`).join("; "));
});

test("a v12 root node's null parentId is accepted (a root has no parent)", () => {
  const d = doc();
  d.layerTree[0].parentId = null;
  const { ok, errors } = validateBriefJson(d);
  assert.equal(ok, true, errors.slice(0, 5).map((e) => `${e.path} ${e.message}`).join("; "));
});

test("v12's new node fields are actually present on the real export (the schema is exercised, not vacuous)", () => {
  const collect = (n) => [n, ...(n.children ?? []).flatMap(collect)];
  const nodes = doc().layerTree.flatMap(collect);
  for (const key of ["tokenBindings", "variableBindings", "styleBindings", "componentPropertyDefinitions", "semanticSource"]) {
    assert.ok(nodes.some((n) => key in n), `no node in the fixture states ${key}`);
  }
});

test("an unknown top-level field still fails v12 validation — additive, not unbounded", () => {
  const mutated = { ...doc(), notARealField: true };
  const { ok, errors } = validateBriefJson(mutated);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.keyword === "additionalProperties"));
});
