// 0.8.2 — schema `design-handoff` v13 (export v17+) is additive over v12:
// `dimensions` may carry minWidth/minWidthToken/maxWidth/maxWidthToken/
// minHeight/minHeightToken/maxHeight/maxHeightToken — variable bindings for
// auto-layout min/max size constraints, matching the existing padding/gap
// binding pattern (portfolio design-handoff-2026-09-19-action-1630: a
// `title` frame's min-height bound to dimension/dimension-700 exported as a
// raw literal with no binding at all before this change).
//
// No live v13 export exists yet at review time, so this derives its fixture
// by mutating the real v12 FeatureText export (schemaVersion bumped to 13,
// dimensions.min/max fields injected on a real dimensioned node) rather than
// hand-writing a document from scratch — the rest of the real export's shape
// stays intact and is what schema v13 (additive over v12) is asserted against.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateBriefJson } from "../src/brief.mjs";

const dir = new URL("../fixtures/jhd-v12-2026-09-19-feature-text/", import.meta.url);
const v12Doc = () => JSON.parse(readFileSync(new URL("design-handoff.json", dir), "utf8"));

function collect(n) {
  return [n, ...(n.children ?? []).flatMap(collect)];
}

function v13Doc() {
  const doc = { ...v12Doc(), schemaVersion: 13 };
  const target = doc.layerTree.flatMap(collect).find((n) => n.dimensions);
  assert.ok(target, "fixture must contain at least one dimensioned node");
  target.dimensions = {
    ...target.dimensions,
    minWidth: 120,
    minWidthToken: null,
    maxWidth: 480,
    maxWidthToken: "dimension/dimension-900",
    minHeight: 196,
    minHeightToken: "dimension/dimension-700",
    maxHeight: 640,
    maxHeightToken: null,
  };
  return doc;
}

test("a v12 export mutated to schemaVersion 13 with dimensions.min/max fields validates against schema v13", () => {
  const { ok, errors } = validateBriefJson(v13Doc());
  assert.equal(ok, true, errors.slice(0, 10).map((e) => `${e.path} ${e.message}`).join("; "));
});

test("a bound minHeight round-trips as dimensions.minHeightToken", () => {
  const target = v13Doc().layerTree.flatMap(collect).find((n) => n.dimensions?.minHeightToken);
  assert.equal(target.dimensions.minHeightToken, "dimension/dimension-700");
  assert.equal(target.dimensions.minHeight, 196);
});

test("an unbound maxHeight carries the raw value with a null token, not a missing key", () => {
  const target = v13Doc().layerTree.flatMap(collect).find((n) => n.dimensions?.maxHeight === 640);
  assert.equal(target.dimensions.maxHeightToken, null);
});

test("the plain v12 fixture (no min/max fields) still validates against schema v13 — additive, old exports unaffected", () => {
  const doc = { ...v12Doc(), schemaVersion: 13 };
  const { ok, errors } = validateBriefJson(doc);
  assert.equal(ok, true, errors.slice(0, 10).map((e) => `${e.path} ${e.message}`).join("; "));
});

test("an unknown dimensions field still fails v13 validation — additive, not unbounded", () => {
  const doc = v13Doc();
  const target = doc.layerTree.flatMap(collect).find((n) => n.dimensions?.minHeightToken);
  target.dimensions.bogus = true;
  const { ok, errors } = validateBriefJson(doc);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.keyword === "additionalProperties"));
});
