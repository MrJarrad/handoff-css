// HT-55 (operator, 2 Nov 2026): the link run's own findings and asks go to a separate file beside the
// brief, so the brief is exactly the plugin's. `handoff-css validate` used to read them from inside the
// brief (`linkRun`); the set checks (a stale pair, a missing export, the script's findings) must not stop
// working when they move. The sidecar is `<brief>.link-run.json`, tied to its brief by the brief's
// content hash. The expected findings are the ones the same run gives with `linkRun` inside the brief.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { dispatch } from "../src/cli.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "script-2026-10-29");
const fixture = (name) => gunzipSync(readFileSync(path.join(dir, `${name}.gz`))).toString("utf8");

/** Write `files` to a temp dir, pass `named` of them to `validate --json`, return {code, cwd, results}. */
async function validate(files, named = Object.keys(files)) {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-linkrun-"));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(cwd, name), text);
  let out = "";
  const code = await dispatch(["validate", ...named, "--json"], {
    cwd, stdout: { write: (s) => { out += s; } }, stderr: { write: () => {} },
  });
  return { code, cwd, results: JSON.parse(out).results };
}
const set = (results) => results.find((r) => r.kind === "set");
const sidecarResult = (results) => results.find((r) => r.kind === "link-run");

const ds = fixture("design-system-handoff.json");
const inline = JSON.parse(fixture("overlay.json"));
// What the script writes after HT-55: the brief as the plugin writes it, and the link run beside it.
const { linkRun, ...plain } = inline;
const sidecar = (over = {}) => ({ schema: "design-handoff-link-run", schemaVersion: 1, brief: { contentHash: inline.contentHash }, linkRun, ...over });
const files = (extra = {}) => ({ "overlay.json": JSON.stringify(plain), "overlay.md": fixture("overlay.md"), "ds.json": ds, ...extra });

test("a link-run file given with the brief gives the same set findings as linkRun inside the brief", async () => {
  const expected = await validate({ "overlay.json": JSON.stringify(inline), "overlay.md": fixture("overlay.md"), "ds.json": ds });
  assert.ok(set(expected.results).findings.length > 0, "the fixture's link run has a finding to carry over");
  const given = await validate(files({ "overlay.link-run.json": JSON.stringify(sidecar()) }));
  assert.deepEqual(set(given.results).findings, set(expected.results).findings);
  assert.equal(given.code, expected.code);
});

test("a link-run file beside the brief is found without being named", async () => {
  const expected = await validate({ "overlay.json": JSON.stringify(inline), "overlay.md": fixture("overlay.md"), "ds.json": ds });
  const beside = await validate(files({ "overlay.link-run.json": JSON.stringify(sidecar()) }), ["overlay.json", "overlay.md", "ds.json"]);
  assert.deepEqual(set(beside.results).findings, set(expected.results).findings);
});

test("an export the link run joined is still required when the link run is a separate file", async () => {
  const withLibrary = sidecar({ linkRun: { ...linkRun, designSystemExports: [...linkRun.designSystemExports, { artifactFilename: "brand-library-design-system-handoff", documentName: "Brand Library", generatedAt: "2026-10-28T10:00:00.000Z" }] } });
  const { code, results } = await validate(files({ "overlay.link-run.json": JSON.stringify(withLibrary) }));
  assert.deepEqual(set(results).findings.filter((f) => f.severity === "error").map((f) => f.code), ["SET_MEMBER_MISSING"]);
  assert.equal(code, 1);
});

test("a link-run file made for another brief is refused", async () => {
  const other = sidecar({ brief: { contentHash: inline.contentHash.replace(/^./, (c) => (c === "0" ? "1" : "0")) } });
  const { code, results } = await validate(files({ "overlay.link-run.json": JSON.stringify(other) }));
  assert.deepEqual(set(results).findings.filter((f) => f.severity === "error").map((f) => f.code), ["LINK_RUN_NOT_FOR_BRIEF"]);
  assert.equal(code, 1);
});

test("a link-run file is checked against its own shape", async () => {
  const { linkRun: _gone, ...broken } = sidecar();
  const { code, results } = await validate(files({ "overlay.link-run.json": JSON.stringify(broken) }));
  assert.equal(sidecarResult(results).ok, false);
  assert.ok(sidecarResult(results).findings.some((f) => f.code === "SCHEMA"));
  assert.equal(code, 1);
});

test("a brief that carries linkRun and a link-run file together has two sources, and is refused", async () => {
  const { code, results } = await validate({ "overlay.json": JSON.stringify(inline), "overlay.md": fixture("overlay.md"), "ds.json": ds, "overlay.link-run.json": JSON.stringify(sidecar()) });
  assert.deepEqual(set(results).findings.filter((f) => f.severity === "error").map((f) => f.code), ["LINK_RUN_TWICE"]);
  assert.equal(code, 1);
});

test("a brief with no link run anywhere (the plugin's own) has no link-run findings and no error", async () => {
  const { code, results } = await validate(files());
  assert.deepEqual(set(results).findings.filter((f) => f.severity === "error"), []);
  assert.equal(code, 0);
});

test("the published link-run schema is reachable as handoff-css/schema/link-run", async () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(pkg.exports["./schema/link-run"]);
  assert.ok(existsSync(new URL("../" + pkg.exports["./schema/link-run"], import.meta.url)));
});
