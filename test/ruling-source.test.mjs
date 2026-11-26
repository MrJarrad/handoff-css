// `match`, `resolve` and `components` take `--config <mjs>` and hand `sourceOf(config)` to the
// ruling-table writers. The config is validated, then the source gated, like `bindings`; without
// `--config`, or with a default source, the output is what it always was.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

import { dispatch } from "../src/cli.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const jhdGz = path.join(root, "fixtures", "jhd-v19-2026-10-29", "design-system-handoff.json.gz");
const briefMd = gunzipSync(readFileSync(path.join(root, "fixtures", "script-2026-10-29", "navigation.md.gz"))).toString("utf8");

const configWith = (source) => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-rs-"));
  const preset = pathToFileURL(path.join(root, "presets", "jhd.config.mjs")).href;
  writeFileSync(path.join(dir, "c.mjs"), `import p from ${JSON.stringify(preset)};\nexport default { ...p${source ? `, source: ${JSON.stringify(source)}` : ""} };\n`);
  return path.join(dir, "c.mjs");
};
const run = async (args, cwd) => {
  let out = "", err = "";
  const code = await dispatch(args, { cwd, stdout: { write: (s) => (out += s) }, stderr: { write: (s) => (err += s) } });
  return { code, out, err };
};

const project = () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-rs-p-"));
  writeFileSync(path.join(cwd, "brief.md"), briefMd);
  mkdirSync(path.join(cwd, "src"));
  writeFileSync(path.join(cwd, "src", "a.css"), ":root { --x: 1; }\n");
  writeFileSync(path.join(cwd, "needs.json"), JSON.stringify([{ id: "quiet-action", name: "color/content/action/tertiary", wants: { light: "#00000078" } }]));
  writeFileSync(path.join(cwd, "cneeds.json"), JSON.stringify([{ id: "c2", name: "Tooltip" }]));
  return cwd;
};
const COMMANDS = {
  match: (cwd, extra) => run(["match", "--handoff", "brief.md", "--src", "src", ...extra], cwd),
  resolve: (cwd, extra) => run(["resolve", "--export", jhdGz, "--need", "needs.json", "--out", "out-r", ...extra], cwd),
  components: (cwd, extra) => run(["components", "--ds-export", jhdGz, "--need", "cneeds.json", "--out", "out-c", ...extra], cwd),
};

for (const [name, go] of Object.entries(COMMANDS)) {
  test(`${name}: a default or stated Figma source writes what no --config writes`, async () => {
    const cwd = project();
    const plain = await go(cwd, []);
    assert.equal(plain.out.includes("| kind | figma |") || name !== "match", true);
    for (const source of [undefined, { kind: "figma" }, { kind: "figma", label: "House Figma file" }]) {
      const withConfig = await go(cwd, ["--config", configWith(source)]);
      assert.deepEqual([withConfig.code, withConfig.out, withConfig.err], [plain.code, plain.out, plain.err]);
    }
  });

  test(`${name}: a source with no reader stops with exit 1 before reading anything`, async () => {
    const r = await go(project(), ["--config", configWith({ kind: "storybook" })]);
    assert.equal(r.code, 1);
    assert.match(r.err, /SOURCE_READER_NOT_BUILT: source kind "storybook"/);
    assert.equal(r.out, "");
  });

  test(`${name}: an unknown source kind is a schema error, and an unreadable config is named`, async () => {
    const r = await go(project(), ["--config", configWith({ kind: "sketch" })]);
    assert.equal(r.code, 1);
    assert.match(r.err, /config\.source\.kind: "sketch" is not one of/);
    assert.doesNotMatch(r.err, /undefined/);
    const gone = await go(project(), ["--config", "nope.mjs"]);
    assert.equal(gone.code, 1);
    assert.match(gone.err, /cannot load config/);
  });
}
