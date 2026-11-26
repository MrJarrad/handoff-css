// The configured source label reaches the findings that name the source. With the
// default label every sentence, finding code and JSON key is what it was.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { sourcePhrase, sourceOf } from "../src/index.mjs";
import { dispatch } from "../src/cli.mjs";
import { componentDrift } from "../src/conform-drift.mjs";
import { bindingMap, renderBindingsMarkdown } from "../src/bindings.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fx = path.join(root, "fixtures");
const gz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString("utf8"));
const dsDoc = () => gz(path.join(fx, "ht134-contrast", "ds-export-21-nov.json.gz"));
const bindings = () => JSON.parse(readFileSync(path.join(fx, "ht137-drift", "action-bindings.json"), "utf8"));
const layerPath = path.join(fx, "jhd-v18-placed-2026-11-08", "design-handoff-mediarow.json.gz");
const css = "@utility action-base { color: var(--local-ink); }";
const drift = (source) => componentDrift({ doc: dsDoc(), bindings: bindings(), graph: new Map(), files: [{ path: "a.css", text: css }], ...(source ? { source } : {}) });

test("sourcePhrase: the default label keeps 'the export'; a stated label names it", () => {
  assert.equal(sourcePhrase(sourceOf({})), "the export");
  assert.equal(sourcePhrase(sourceOf({ source: { kind: "figma", label: "Figma" } })), "the export");
  assert.equal(sourcePhrase(sourceOf({ source: { kind: "figma", label: "House Figma file" } })), "the House Figma file export");
});

test("drift: the code-only finding names the configured source; code, severity, reads, binds stay", () => {
  const base = drift();
  const named = drift(sourceOf({ source: { kind: "figma", label: "House Figma file" } }));
  assert.equal(base.length, 1);
  assert.match(base[0].message, /a name the export never states/);
  assert.match(named[0].message, /a name the House Figma file export never states/);
  const strip = ({ message, ...rest }) => rest;
  assert.deepEqual(named.map(strip), base.map(strip));
});

test("drift: with the default source passed, output is the output with none", () => {
  assert.deepEqual(drift(sourceOf({})), drift());
});

const render = (source) => {
  const map = bindingMap([gz(layerPath)], { variables: ["color/background/default/primary"] });
  return renderBindingsMarkdown(map, { exportNames: ["a.json"], ...(source ? { source } : {}) });
};

test("bindings: the 'From' line carries a stated label; the default is unchanged", () => {
  assert.match(render(), /^From a\.json\.$/m);
  assert.equal(render(sourceOf({})), render());
  assert.match(render(sourceOf({ source: { kind: "figma", label: "House Figma file" } })), /^From a\.json \(House Figma file\)\.$/m);
});

const configWith = (source) => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-labels-"));
  const preset = pathToFileURL(path.join(root, "presets", "jhd.config.mjs")).href;
  writeFileSync(path.join(dir, "c.mjs"), `import p from ${JSON.stringify(preset)};\nexport default { ...p${source ? `, source: ${JSON.stringify(source)}` : ""} };\n`);
  return path.join(dir, "c.mjs");
};
const out = () => { const c = []; return { write: (s) => c.push(s), text: () => c.join("") }; };

test("bindings --config: default config output equals no config; a label shows; a source with no reader stops", async () => {
  const args = ["bindings", "--export", layerPath, "--variable", "color/background/default/primary"];
  const run = async (extra) => { const stdout = out(), stderr = out(); const code = await dispatch([...args, ...extra], { stdout, stderr }); return { code, so: stdout.text(), se: stderr.text() }; };
  const plain = await run([]);
  assert.equal((await run(["--config", configWith()])).so, plain.so);
  assert.match((await run(["--config", configWith({ kind: "figma", label: "House Figma file" })])).so, /\(House Figma file\)\./);
  const stopped = await run(["--config", configWith({ kind: "storybook" })]);
  assert.equal(stopped.code, 1);
  assert.match(stopped.se, /SOURCE_READER_NOT_BUILT/);
});
