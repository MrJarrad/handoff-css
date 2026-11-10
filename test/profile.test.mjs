// `handoff-css profile` (HT-111 A-S1): how a design system is built, read from its export.
// Two exports: the real JHD v19 fixture, and a synthetic system that shares no names, separators,
// step numbers or mode names with it, so nothing in src/ can pass by knowing the house.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import Ajv2020 from "ajv/dist/2020.js";

import { dispatch } from "../src/cli.mjs";
import { buildProfile, renderProfileMarkdown } from "../src/profile.mjs";
import { assertValidExport } from "../src/validate-export.mjs";
import { synthetic, variable, cell, collection } from "./synthetic-export.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureGz = path.join(root, "fixtures", "jhd-v19-2026-10-29", "design-system-handoff.json.gz");
const jhd = () => JSON.parse(gunzipSync(readFileSync(fixtureGz)).toString("utf8"));
const schema = JSON.parse(readFileSync(path.join(root, "schema", "system-profile.v1.schema.json"), "utf8"));
const validate = new Ajv2020({ strict: false }).compile(schema);

test("synthetic system: layers come from the alias graph, not from collection names", () => {
  const p = buildProfile(synthetic());
  const role = Object.fromEntries(p.layers.map((l) => [l.collection, l.role]));
  assert.deepEqual(role, { Foundations: "primitive", Semantic: "semantic", Breakpoints: "semantic" });
  assert.deepEqual(p.layers.find((l) => l.collection === "Semantic").evidence.aliasesInto, { Foundations: 22 });
});

test("synthetic system: naming reads its separator, leaf case and code-name rule", () => {
  const p = buildProfile(synthetic());
  const f = p.naming.find((x) => x.collection === "Foundations");
  assert.equal(f.separator, "/");
  assert.deepEqual(f.segmentDepth, { 2: 5, 3: 9 });
  assert.deepEqual(f.webName, { prefix: ["--"], rule: { "drops-0-leading-segments": 14 } });
  assert.deepEqual(f.leafCase, { kebab: 5, numeric: 9 });
});

test("synthetic system: a ramp keeps its own steps, never assumed hundreds", () => {
  const p = buildProfile(synthetic());
  assert.equal(p.ramps.length, 1);
  assert.deepEqual(p.ramps[0].steps, ["10", "20", "30", "40", "50", "60", "70", "80", "90"]);
  assert.deepEqual(p.ramps[0].stepGaps, [10]);
  assert.equal(p.ramps[0].ends.high.step, "90");
});

test("synthetic system: modes carry meaning and how it was detected; unresolved stays unclassified", () => {
  const p = buildProfile(synthetic());
  const sem = p.modes.find((m) => m.collection === "Semantic").modes;
  assert.deepEqual(sem.map((m) => [m.name, m.meaning, m.detectedBy.source]), [["Day", "theme", "export:theme-name"], ["Night", "theme", "export:theme-name"]]);
  const bp = p.modes.find((m) => m.collection === "Breakpoints").modes;
  assert.deepEqual(bp.map((m) => [m.name, m.meaning]), [["S", "responsive-layout"], ["L", "unclassified"]]);
  assert.equal(bp[1].detectedBy.confidence, "none");
});

test("synthetic system: a role one sibling lacks is reported as a fact", () => {
  const p = buildProfile(synthetic());
  assert.deepEqual(p.siblingGaps.map((g) => [g.group, g.lacks, g.presentIn]), [["Ink", "danger", ["Edge", "Surface"]]]);
  assert.match(renderProfileMarkdown(p), /`Semantic:Ink` has no `danger`; `Edge`, `Surface` have it/);
});

test("the profile validates against its schema and is deterministic", () => {
  for (const doc of [synthetic(), jhd()]) {
    const p = buildProfile(doc);
    assert.equal(validate(p), true, JSON.stringify(validate.errors));
    assert.equal(JSON.stringify(buildProfile(doc)), JSON.stringify(p));
  }
});

test("src/ names nothing of the house: no JHD token, collection or mode strings in any source file", () => {
  const src = path.join(root, "src");
  // House names only, so generic words stay free: `light`, `dark`, `core` and `palette` are banned as a
  // quoted or backticked token (a mode or collection named in a comment or string), not as a bare English word.
  const banned = /\b(bttf|cod-grey|text-primitives|color-primitives|JHD)\b|[`'"](?:light|dark|core|palette)[`'"]/;
  const files = readdirSync(src).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.includes("profile.mjs") && files.includes("resolve-need.mjs") && files.includes("resolve-cli.mjs"));
  assert.deepEqual(files.filter((f) => banned.test(readFileSync(path.join(src, f), "utf8"))), []);
});

test("the synthetic export is schema-valid: it passes assertValidExport, as a real export would", () => {
  assert.doesNotThrow(() => assertValidExport(synthetic()));
});

// ---- sibling thresholds: stated, and the edges are tested -----------------------------------------
const family = (groups) => {
  const cols = [collection("Sys", [{ id: "m", name: "base" }], Object.entries(groups).flatMap(([g, leaves]) => leaves.map((l) => variable(`${g}/${l}`, "COLOR", [cell("m", "#112233FF", "#112233FF")]))), "m")];
  return { schema: "design-system-handoff", schemaVersion: 19, documentName: "Edge", exportVersion: 1, contentHash: "e", collections: cols };
};

test("sibling gap: three groups, a leaf in a strict majority and missing from one is a gap", () => {
  const p = buildProfile(family({ "A/x": ["p", "q", "r"], "A/y": ["p", "q", "r"], "A/z": ["p", "q"] }));
  assert.deepEqual(p.siblingGaps.map((g) => [g.group, g.lacks]), [["A/z", "r"]]);
  assert.deepEqual(p.siblingObservations, []);
});

test("sibling edge: a family of two cannot outvote itself, so a difference is an observation, never a gap", () => {
  const p = buildProfile(family({ "A/x": ["p", "q", "r"], "A/y": ["p", "q"] }));
  assert.deepEqual(p.siblingGaps, []);
  assert.deepEqual(p.siblingObservations, [{ collection: "Sys", family: "A/*", groups: ["A/x", "A/y"], onlyIn: { "A/x": ["r"], "A/y": [] } }]);
  assert.match(renderProfileMarkdown(p), /`A\/x` only has `r`; `A\/y` only has nothing extra/);
  assert.equal(buildProfile(family({ "A/x": ["p", "q"], "A/y": ["p", "q"] })).siblingObservations.length, 0, "two identical groups raise nothing");
});

test("sibling edge: a group sharing under half its leaves is left out of the family, with no gap and no observation", () => {
  const p = buildProfile(family({ "A/x": ["p", "q", "r"], "A/y": ["p", "q", "r"], "A/z": ["u", "v", "w", "p"] }));
  assert.deepEqual(p.siblingGaps, []);
  assert.deepEqual(p.siblingObservations, []);
});

test("sibling edge: a leaf held by exactly half of a family is not a gap (needs a strict majority)", () => {
  const p = buildProfile(family({ "A/w": ["p", "q", "r"], "A/x": ["p", "q", "r"], "A/y": ["p", "q"], "A/z": ["p", "q"] }));
  assert.deepEqual(p.siblingGaps, []);
});

// ---- JHD v19 ---------------------------------------------------------------------------------
test("JHD v19: surfaces content/action having no tertiary while background/action and border/action do", () => {
  const p = buildProfile(jhd());
  assert.deepEqual(p.siblingGaps, [{
    collection: "color", group: "color/content/action", lacks: "tertiary",
    presentIn: ["color/background/action", "color/border/action"], family: "color/*/action",
  }]);
});

test("JHD v19: layers, ramps and modes read as the design file states", () => {
  const p = buildProfile(jhd());
  const layer = (c) => p.layers.find((l) => l.collection === c);
  assert.equal(layer("color-primitives").role, "primitive");
  assert.equal(layer("color").role, "semantic");
  const grey = p.ramps.find((r) => r.path === "color/palette/cod-grey");
  assert.equal(grey.steps.length, 11);
  assert.equal(grey.ends.high.oklchL, 0.145);
  assert.deepEqual(p.modes.find((m) => m.collection === "color").modes.map((m) => [m.name, m.meaning]), [["light", "theme"], ["dark", "theme"], ["bttf", "theme"]]);
  const c = p.coverage.find((x) => x.collection === "color");
  assert.deepEqual([c.variables, c.withDescription, c.scopes], [112, 0, { ALL_SCOPES: 112 }]);
  assert.ok(p.names.find((x) => x.collection === "color").names.some((x) => x.name === "color/background/action/tertiary"));
});

// ---- CLI --------------------------------------------------------------------------------------
const run = async (args, cwd) => {
  let out = "", err = "";
  const code = await dispatch(args, { cwd, stdout: { write: (s) => (out += s) }, stderr: { write: (s) => (err += s) } });
  return { code, out, err };
};

test("profile writes both files; --check is clean, then names the drifted file after an edit", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "profile-"));
  const w = await run(["profile", "--export", fixtureGz, "--out", dir], dir);
  assert.equal(w.code, 0, w.err);
  assert.deepEqual(readdirSync(dir).sort(), ["system-profile.json", "system-profile.md"]);
  const ok = await run(["profile", "--export", fixtureGz, "--out", dir, "--check"], dir);
  assert.equal(ok.code, 0);
  const before = statSync(path.join(dir, "system-profile.md")).mtimeMs;
  writeFileSync(path.join(dir, "system-profile.md"), "stale\n");
  const bad = await run(["profile", "--export", fixtureGz, "--out", dir, "--check"], dir);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /system-profile\.md/);
  assert.doesNotMatch(bad.err, /system-profile\.json/);
  assert.equal(readFileSync(path.join(dir, "system-profile.md"), "utf8"), "stale\n", "--check writes nothing");
  assert.ok(before);
});

test("profile --check on a missing output fails; no --export prints usage", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "profile-"));
  assert.equal((await run(["profile", "--export", fixtureGz, "--out", dir, "--check"], dir)).code, 1);
  const u = await run(["profile"], dir);
  assert.equal(u.code, 1);
  assert.match(u.err, /handoff-css profile --export/);
});
