// 0.4.3 — the brief JSON companion (schema `design-handoff` v11) is the
// machine contract; the markdown stays the human rendering. Asserted against
// the real 09:51 export (v15), which makes alignment explicit: every grid
// child's `gridPlacement` carries `justifySelf`/`alignSelf`, every layout
// container carries CSS-resolved `alignItems`/`justifyContent`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateBriefJson, validateBriefPair } from "../src/brief.mjs";

const dir = new URL("../fixtures/jhd-v11-2026-09-12/", import.meta.url);
const doc = () => JSON.parse(readFileSync(new URL("design-handoff-block-navigation.json", dir), "utf8"));
const md = () => readFileSync(new URL("design-handoff-block-navigation.md", dir), "utf8");

test("the real v15 brief JSON validates against schema v11 with zero errors", () => {
  const { ok, errors } = validateBriefJson(doc());
  assert.equal(ok, true, errors.map((e) => `${e.path} ${e.message}`).join("; "));
});

test("a brief missing its required identity fields fails schema validation", () => {
  const { ok, errors } = validateBriefJson({ schema: "design-handoff", schemaVersion: 11 });
  assert.equal(ok, false);
  assert.ok(errors.length > 0);
});

test("a v10 brief still validates against schema v10 (v10 stays accepted)", () => {
  const v10 = { ...doc(), schemaVersion: 10 };
  // strip the v11-only alignment fields a v10 document would never carry
  const strip = (n) => {
    if (n.gridPlacement) {
      delete n.gridPlacement.justifySelf;
      delete n.gridPlacement.alignSelf;
    }
    if (n.layout) {
      delete n.layout.justifyContent;
      delete n.layout.alignItems;
    }
    (n.children ?? []).forEach(strip);
  };
  v10.layerTree.forEach(strip);
  const { ok, errors } = validateBriefJson(v10);
  assert.equal(ok, true, errors.map((e) => `${e.path} ${e.message}`).join("; "));
});

test("an unknown alignment value on gridPlacement.justifySelf fails schema validation", () => {
  const mutated = doc();
  const target = mutated.layerTree
    .flatMap(function collect(n) { return [n, ...(n.children ?? []).flatMap(collect)]; })
    .find((n) => n.gridPlacement);
  assert.ok(target, "fixture must contain at least one gridPlacement node");
  target.gridPlacement.justifySelf = "not-a-real-value";
  const { ok, errors } = validateBriefJson(mutated);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /justifySelf/.test(e.path)));
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

// Reviewer round 2: the schema must constrain the shape, not just its presence.
test("a `selectedNodes` that is a string, not an array, fails schema validation", () => {
  const { ok } = validateBriefJson({ ...doc(), selectedNodes: "not-an-array" });
  assert.equal(ok, false);
});

test("a `selectedNodes` item that is a number, not {id, name}, fails schema validation", () => {
  const { ok } = validateBriefJson({ ...doc(), selectedNodes: [42] });
  assert.equal(ok, false);
});

test("a `selectedNodes` item with an unknown key fails schema validation", () => {
  const { ok } = validateBriefJson({ ...doc(), selectedNodes: [{ id: "x", name: "y", bogus: true }] });
  assert.equal(ok, false);
});

test("a `layerTree` node with an unknown key fails schema validation", () => {
  const mutated = doc();
  mutated.layerTree = [{ ...mutated.layerTree[0], bogus: true }];
  const { ok } = validateBriefJson(mutated);
  assert.equal(ok, false);
});
