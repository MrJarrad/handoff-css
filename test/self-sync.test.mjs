// HT-25: an out-of-date handoff set is brought up to date, not refused. `validate` still says what
// is wrong, but each finding carries the move that fixes it: a newer export than this checker knows
// passes with a warning; a stale pair names the command that regenerates the brief; a Design System
// Handoff export that is itself behind becomes one ask — that plugin run, by file name.
// Fixtures are real 29 Oct exports: `fixtures/script-2026-10-29` (briefs made from the 28 Oct
// Design System Handoff run) and `fixtures/jhd-v19-2026-10-29` (that export's 22:03 run).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { dispatch } from "../src/cli.mjs";
import { VALIDATED_SCHEMA_VERSIONS, validateExport, assertValidExport } from "../src/validate-export.mjs";
import { validateBriefJson } from "../src/brief.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const fixture = (dir, name) => gunzipSync(readFileSync(path.join(fixtures, dir, `${name}.gz`))).toString("utf8");
const script = (name) => fixture("script-2026-10-29", name);

async function validate(files) {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-sync-"));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(cwd, name), text);
  let out = "";
  const code = await dispatch(["validate", ...Object.keys(files), "--json"], {
    cwd, stdout: { write: (s) => { out += s; } }, stderr: { write: () => {} },
  });
  return { code, results: JSON.parse(out).results };
}
const kind = (results, k) => results.find((r) => r.kind === k);
const codes = (r, severity) => r.findings.filter((f) => f.severity === severity).map((f) => f.code);

/** The overlay brief pair as the plugin would write it one schema version on, with a field this checker has never seen. */
function newerBrief() {
  const json = JSON.parse(script("overlay.json"));
  const next = json.schemaVersion + 1;
  const md = script("overlay.md").replace(/^schemaVersion: \d+$/m, `schemaVersion: ${next}`);
  return { json: JSON.stringify({ ...json, schemaVersion: next, fieldFromTheFuture: true }), md, next };
}

test("a brief newer than this checker knows passes with a warning, never an error", async () => {
  const { json, md, next } = newerBrief();
  const { code, results } = await validate({ "overlay.json": json, "overlay.md": md, "ds.json": script("design-system-handoff.json") });
  const brief = kind(results, "brief");
  assert.equal(brief.schemaVersion, next);
  assert.deepEqual(codes(brief, "error"), []);
  assert.ok(codes(brief, "warning").includes("SCHEMA_NEWER_THAN_CHECKER"), JSON.stringify(brief.findings));
  assert.ok(brief.findings.some((f) => f.message.includes("fieldFromTheFuture")), "the field it does not know is named");
  assert.equal(code, 0);
});

test("a Design System Handoff export newer than this checker knows passes with a warning, never an error", async () => {
  const doc = JSON.parse(fixture("jhd-v19-2026-10-29", "design-system-handoff.json"));
  const next = Math.max(...VALIDATED_SCHEMA_VERSIONS) + 1;
  const { code, results } = await validate({ "ds.json": JSON.stringify({ ...doc, schemaVersion: next }) });
  const exported = kind(results, "export");
  assert.deepEqual(codes(exported, "error"), []);
  assert.deepEqual(codes(exported, "warning"), ["SCHEMA_NEWER_THAN_CHECKER"]);
  assert.equal(code, 0);
});

test("a newer version excuses only fields it adds — a missing required field or a wrong type is still an error, and generate still refuses it", () => {
  const doc = JSON.parse(fixture("jhd-v19-2026-10-29", "design-system-handoff.json"));
  const next = Math.max(...VALIDATED_SCHEMA_VERSIONS) + 1;
  const { contentHash, ...withoutHash } = doc;
  const broken = { ...withoutHash, schemaVersion: next, styles: "nope" };
  const result = validateExport(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.keyword === "required"), JSON.stringify(result.errors));
  assert.ok(result.errors.some((e) => e.keyword === "type" && e.path === "/styles"), JSON.stringify(result.errors));
  assert.throws(() => assertValidExport(broken));
  const brief = validateBriefJson({ schema: "design-handoff", schemaVersion: 99 });
  assert.equal(brief.ok, false);
  assert.ok(brief.errors.some((e) => e.keyword === "required"), JSON.stringify(brief.errors));
});

test("a brief made from an older Design System Handoff run names the command that regenerates it against the newer one", async () => {
  const { code, results } = await validate({ "navigation.json": script("navigation.json"), "navigation.md": script("navigation.md"), "ds.json": fixture("jhd-v19-2026-10-29", "design-system-handoff.json") });
  const stale = kind(results, "set").findings.filter((f) => f.code === "STALE_PAIR");
  assert.ok(stale.length > 0);
  for (const f of stale) assert.match(f.message, /design-handoff --regenerate navigation\.json --ds ds\.json/);
  assert.equal(code, 1, "the set is still not one state until the brief is regenerated");
});

test("a Design System Handoff export older than the brief's asks for the newer run, not a regenerate", async () => {
  const older = JSON.parse(script("design-system-handoff.json"));
  const brief = JSON.parse(script("navigation.json"));
  brief.companion = { ...brief.companion, contentHash: "made-from-a-later-run", generatedAt: "2026-10-30T09:00:00.000Z" };
  const { results } = await validate({ "navigation.json": JSON.stringify(brief), "navigation.md": script("navigation.md"), "ds.json": JSON.stringify(older) });
  const stale = kind(results, "set").findings.find((f) => f.path === "/companion/contentHash");
  assert.match(stale.message, /2026-10-30T09:00:00.000Z run/);
  assert.doesNotMatch(stale.message, /--regenerate/);
});

test("a Design System Handoff export that is itself behind becomes one ask: that plugin run, named by file", async () => {
  const json = script("overlay.json");
  const { code, results } = await validate({ "overlay.json": json, "overlay.md": script("overlay.md"), "ds.json": script("design-system-handoff.json") });
  const file = JSON.parse(json).linkRun.sources.find((s) => s.role === "this file").name;
  const asks = kind(results, "set").findings.filter((f) => f.code === "DS_EXPORT_OUT_OF_DATE");
  assert.deepEqual(asks.map((f) => [f.severity, f.message]), [["warning", `run the Design System Handoff plugin on ${file}, then regenerate the brief with its export — variables cannot be read without that plugin`]]);
  assert.equal(code, 0);
});

test("HT-22: a schema 12+ export with a top-level field its version does not declare fails — a new field needs a new version", async () => {
  const doc = JSON.parse(fixture("jhd-v19-2026-10-29", "design-system-handoff.json"));
  const { code, results } = await validate({ "ds.json": JSON.stringify({ ...doc, fieldWithoutABump: true }) });
  const exported = kind(results, "export");
  assert.ok(exported.findings.some((f) => f.severity === "error" && f.message.includes("fieldWithoutABump")), JSON.stringify(exported.findings));
  assert.equal(code, 1);
});
