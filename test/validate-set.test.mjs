// `handoff-css validate` over what the link-run script writes (figma-plugins
// `handoff/design-handoff-script`, the Design Handoff export path since HT-19):
// the brief pair plus every Design System Handoff export it was made from — a
// set, joined by the names the brief's `companion` and `linkRun` carry.
// Fixtures: `fixtures/script-2026-10-29/README.md`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { dispatch } from "../src/cli.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "script-2026-10-29");
const fixture = (name) => gunzipSync(readFileSync(path.join(dir, `${name}.gz`))).toString("utf8");

/** Write named texts to a temp dir, run `validate --json` over them, return {code, results}. */
async function validate(files, extra = []) {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-set-"));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(cwd, name), text);
  let out = "";
  const code = await dispatch(["validate", ...Object.keys(files), ...extra, "--json"], {
    cwd, stdout: { write: (s) => { out += s; } }, stderr: { write: () => {} },
  });
  return { code, cwd, results: JSON.parse(out).results };
}
const brief = (results) => results.find((r) => r.kind === "brief");
const set = (results) => results.find((r) => r.kind === "set");
const codes = (r, severity) => r.findings.filter((f) => f.severity === severity).map((f) => f.code);

const ds = fixture("design-system-handoff.json");

test("a script export at schema v13 validates against the brief schema", async () => {
  const { results } = await validate({ "navigation.json": fixture("navigation.json"), "navigation.md": fixture("navigation.md"), "ds.json": ds });
  assert.deepEqual(brief(results).findings, []);
});

test("a script export at schema v14 (it holds a spec) validates against the v14 brief schema", async () => {
  const { results } = await validate({ "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md"), "ds.json": ds });
  assert.equal(brief(results).schemaVersion, 14);
  assert.deepEqual(brief(results).findings, []);
});

test("the set reconciles: the export the brief names is given, with the hashes its companion block states", async () => {
  const { code, results } = await validate({ "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md"), "ds.json": ds });
  assert.deepEqual(codes(set(results), "error"), []);
  assert.equal(code, 0);
});

test("a Design System Handoff export of another state is a stale pair, and stops validate", async () => {
  const other = JSON.parse(ds);
  other.contentHash = other.contentHash.replace(/^./, (c) => (c === "0" ? "1" : "0"));
  const { code, results } = await validate({ "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md"), "ds.json": JSON.stringify(other) });
  assert.deepEqual(codes(set(results), "error"), ["STALE_PAIR"]);
  assert.equal(code, 1);
});

test("each export the link run joined is a member of the set: missing, or another run of it, stops validate", async () => {
  const withLibrary = JSON.parse(fixture("overlay.json"));
  withLibrary.linkRun.designSystemExports.push({ artifactFilename: "brand-library-design-system-handoff", documentName: "Brand Library", generatedAt: "2026-10-28T10:00:00.000Z" });
  const missing = await validate({ "overlay.json": JSON.stringify(withLibrary), "overlay.md": fixture("overlay.md"), "ds.json": ds });
  assert.deepEqual(codes(set(missing.results), "error"), ["SET_MEMBER_MISSING"]);
  assert.match(set(missing.results).findings[0].message, /brand-library-design-system-handoff/);
  assert.equal(missing.code, 1);

  const rerun = JSON.parse(ds);
  rerun.generatedAt = "2026-10-29T09:00:00.000Z";
  const other = await validate({ "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md"), "ds.json": JSON.stringify(rerun) });
  assert.ok(codes(set(other.results), "error").includes("STALE_PAIR"));
});

test("a script brief given without its Design System Handoff export is an incomplete set", async () => {
  const { code, results } = await validate({ "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md") });
  assert.deepEqual(codes(set(results), "error"), ["SET_MEMBER_MISSING"]);
  assert.equal(code, 1);
});

test("every link-run finding is reported as a warning under its own code", async () => {
  const exported = JSON.parse(fixture("overlay.json"));
  const { code, results } = await validate({ "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md"), "ds.json": ds });
  assert.ok(exported.linkRun.findings.length > 0, "the fixture carries at least one finding");
  const reported = set(results).findings.filter((f) => f.path.startsWith("/linkRun/findings/"));
  assert.deepEqual(reported.map((f) => [f.severity, f.code]), exported.linkRun.findings.map((f) => ["warning", f.code]));
  assert.equal(code, 0);
});

// The spec index (HT-10): one row per spec placed in Figma — the file key, the
// spec node id, and the markdown file that holds its text, as a link relative
// to the index itself.
const specIndex = (rows) => [
  "# Spec index", "",
  "| file key | spec node id | spec | path |", "| --- | --- | --- | --- |",
  ...rows.map((r) => `| \`${r.key}\` | \`${r.id}\` | ${r.name} | [${r.name}](${r.path}) |`), "",
].join("\n");
const overlay = JSON.parse(fixture("overlay.json"));
const [spec] = overlay.specs;
const fileKey = overlay.linkRun.sources.find((s) => s.role === "this file").fileKey;

test("a spec whose text the export lacks, validated with no spec index, is a warning naming --spec-index", async () => {
  const { results } = await validate({ "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md"), "ds.json": ds });
  const f = set(results).findings.find((x) => x.code === "SPEC_TEXT_NOT_IN_EXPORT");
  assert.ok(f, "the missing spec text is reported");
  assert.match(f.message, new RegExp(spec.id));
  assert.match(f.message, /--spec-index/);
});

test("a spec with no index entry is flagged; a listed one resolves to its file", async () => {
  const files = { "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md"), "ds.json": ds };
  const unlisted = await validate({ ...files, "index.md": specIndex([]) }, ["--spec-index", "index.md"]);
  assert.deepEqual(codes(set(unlisted.results), "warning").filter((c) => c.startsWith("SPEC")), ["SPEC_NOT_INDEXED"]);

  const listed = await validate({ ...files, "index.md": specIndex([{ key: fileKey, id: spec.id, name: "Overlay", path: "overlay-spec.md" }]), "overlay-spec.md": "# Overlay spec\n" }, ["--spec-index", "index.md"]);
  assert.deepEqual(set(listed.results).findings.filter((f) => f.code.startsWith("SPEC")), []);
  assert.deepEqual(set(listed.results).specs, [{ id: spec.id, name: spec.name, path: path.join(listed.cwd, "overlay-spec.md") }]);

  const wrongFile = await validate({ ...files, "index.md": specIndex([{ key: "anotherFileKey", id: spec.id, name: "Overlay", path: "overlay-spec.md" }]), "overlay-spec.md": "x" }, ["--spec-index", "index.md"]);
  assert.deepEqual(codes(set(wrongFile.results), "warning").filter((c) => c.startsWith("SPEC")), ["SPEC_NOT_INDEXED"]);
});

test("an index entry whose file is not there is a broken index, and stops validate", async () => {
  const { code, results } = await validate({ "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md"), "ds.json": ds, "index.md": specIndex([{ key: fileKey, id: spec.id, name: "Overlay", path: "nowhere.md" }]) }, ["--spec-index", "index.md"]);
  assert.deepEqual(codes(set(results), "error"), ["SPEC_INDEX_PATH_MISSING"]);
  assert.equal(code, 1);
});
