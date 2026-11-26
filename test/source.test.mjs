// The design system's source is a config statement: `source: { kind, label? }`.
// Absent means the Design Handoff export read from Figma, the one reader built,
// and a consumer that never writes the field must see no change at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { generate, validateConfig, sourceOf, assertSourceBuilt } from "../src/index.mjs";
import { dispatch } from "../src/cli.mjs";
import { config, doc, handAuthoredCss } from "./fixture.mjs";

const withSource = (source) => ({ ...structuredClone(config), source });
const capture = () => {
  const chunks = [];
  return { write: (s) => chunks.push(s), text: () => chunks.join("") };
};

test("no source field: the source is Figma, and its reader is built", () => {
  assert.deepEqual(sourceOf(config), { kind: "figma", label: "Figma", built: true });
});

test("each kind has a default label; only figma has a reader", () => {
  assert.deepEqual(sourceOf(withSource({ kind: "tokens-code" })), { kind: "tokens-code", label: "Design tokens (code)", built: false });
  assert.deepEqual(sourceOf(withSource({ kind: "storybook" })), { kind: "storybook", label: "Storybook", built: false });
  assert.deepEqual(sourceOf(withSource({ kind: "other", label: "Penpot" })), { kind: "other", label: "Penpot", built: false });
});

test("a stated label replaces the default", () => {
  assert.equal(sourceOf(withSource({ kind: "figma", label: "Figma (house file)" })).label, "Figma (house file)");
});

test("kind other names its source: no label is an error", () => {
  assert.throws(() => sourceOf(withSource({ kind: "other" })), /source\.kind "other" needs a label/);
});

test("the schema accepts every kind and rejects an unknown kind, a missing kind and a stray key", () => {
  for (const kind of ["figma", "tokens-code", "storybook"]) assert.deepEqual(validateConfig(withSource({ kind })), []);
  assert.deepEqual(validateConfig(withSource({ kind: "other", label: "Penpot" })), []);
  assert.match(validateConfig(withSource({ kind: "sketch" })).join("\n"), /config\.source\.kind: "sketch" is not one of/);
  assert.match(validateConfig(withSource({ label: "x" })).join("\n"), /config\.source: missing required key `kind`/);
  assert.match(validateConfig(withSource({ kind: "figma", url: "x" })).join("\n"), /config\.source: unknown key `url`/);
});

test("source is optional: the preset without it still validates", () => {
  assert.deepEqual(validateConfig(config), []);
});

test("stating the figma source changes no output byte", () => {
  const run = (cfg) => generate(doc(), cfg, { handAuthoredCss: handAuthoredCss() });
  const base = run(config);
  for (const source of [{ kind: "figma" }, { kind: "figma", label: "Figma" }, { kind: "figma", label: "Another label" }]) {
    assert.deepEqual(run(withSource(source)), base);
  }
});

test("a source with no reader fails before any read, naming the kind and the one reader built", () => {
  const cfg = withSource({ kind: "storybook" });
  assert.throws(() => assertSourceBuilt(cfg), /SOURCE_READER_NOT_BUILT: source kind "storybook" \(Storybook\) has no reader/);
  assert.throws(() => generate(doc(), cfg, { handAuthoredCss: handAuthoredCss() }), /SOURCE_READER_NOT_BUILT/);
  assert.doesNotThrow(() => assertSourceBuilt(config));
});

const configFile = (source) => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-source-"));
  writeFileSync(path.join(dir, "handoff.config.mjs"), `export default ${JSON.stringify(withSource(source))};\n`);
  return dir;
};

test("the generate command reports the not-built source and exits 1, writing nothing", async () => {
  const cwd = configFile({ kind: "tokens-code" });
  const stdout = capture(), stderr = capture();
  assert.equal(await dispatch([], { cwd, stdout, stderr }), 1);
  assert.match(stderr.text(), /SOURCE_READER_NOT_BUILT: source kind "tokens-code"/);
  assert.equal(stdout.text(), "");
});

test("conform --config reports the not-built source and exits 1", async () => {
  const cwd = configFile({ kind: "storybook" });
  const stdout = capture(), stderr = capture();
  const code = await dispatch(["conform", "--export", "x.json", "--handoff", "x.md", "--tokens", "x.css", "--css", "x.css", "--config", "handoff.config.mjs"], { cwd, stdout, stderr });
  assert.equal(code, 1);
  assert.match(stderr.text(), /SOURCE_READER_NOT_BUILT: source kind "storybook"/);
});
