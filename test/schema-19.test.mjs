// Design System Handoff schema 18 (specs[], builtReference[]) and 19 (annotations by node id,
// mixedStrokeCaps[]) — the current export. Fixture: `fixtures/jhd-v19-2026-10-29/README.md`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { dispatch } from "../src/cli.mjs";
import { validateExport } from "../src/validate-export.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "jhd-v19-2026-10-29");
const fixture = (name) => gunzipSync(readFileSync(path.join(dir, `${name}.gz`))).toString("utf8");
const exportText = fixture("design-system-handoff.json");
const fresh = () => JSON.parse(exportText);

test("the 29 Oct 22:03 export (schema 19) validates", () => {
  const doc = fresh();
  assert.equal(doc.schemaVersion, 19);
  const { ok, errors } = validateExport(doc);
  assert.deepEqual(errors, []);
  assert.equal(ok, true);
});

test("a v19 export's own fields are typed: a malformed annotation, stroke-cap id or spec is a schema error", () => {
  const cases = [
    ["annotation without a label", (d) => { const [first] = Object.values(d.annotations.nodes); delete first[0].label; }],
    ["annotation category without an id", (d) => { delete d.annotations.categories[0].id; }],
    ["stroke-cap id that is not a string", (d) => { d.mixedStrokeCaps.push(42); }],
    ["spec without a name", (d) => { delete d.specs[0].name; }],
  ];
  for (const [name, mutate] of cases) {
    const doc = fresh();
    mutate(doc);
    assert.equal(validateExport(doc).ok, false, name);
  }
});

test("a schema 20 export passes only with a warning naming it (HT-25)", () => {
  const doc = fresh();
  doc.schemaVersion = 20;
  const res = validateExport(doc);
  assert.equal(res.ok, true);
  assert.equal(res.warnings[0].code, "SCHEMA_NEWER_THAN_CHECKER");
});

test("the real 22:03 set — Overlay brief pair + its export — passes validate", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-v19-"));
  const files = { "overlay.json": fixture("overlay.json"), "overlay.md": fixture("overlay.md"), "ds.json": exportText };
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(cwd, name), text);
  let out = "";
  const code = await dispatch(["validate", ...Object.keys(files), "--json"], { cwd, stdout: { write: (s) => { out += s; } }, stderr: { write: () => {} } });
  const errors = JSON.parse(out).results.flatMap((r) => r.findings.filter((f) => f.severity === "error"));
  assert.deepEqual(errors, []);
  assert.equal(code, 0);
});

test("the house preset accepts schema 18 and 19, so tokens regenerate from the current export", async () => {
  const { default: preset } = await import("../presets/jhd.config.mjs");
  const { assertSchema } = await import("../src/schema.mjs");
  assert.doesNotThrow(() => assertSchema(fresh(), preset));
  assert.doesNotThrow(() => assertSchema({ ...fresh(), schemaVersion: 18 }, preset));
});
