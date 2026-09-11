// The filesystem boundary — `run`, which is what `bin/handoff-css.mjs` and a
// consumer's `pnpm tokens` / `pnpm tokens:check` scripts call. The library is
// covered everywhere else; this covers writing the four artifacts, `--check`
// exit behaviour, and the fields the CLI's own summary reads (a field renamed
// out from under it prints `undefined` rather than failing).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { dispatch } from "../src/cli.mjs";
import { run } from "../src/index.mjs";
import { handAuthoredCss, preset, read } from "./fixture.mjs";

/** A consuming repo, laid out at the preset's own `paths.*`. */
const consumer = () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-"));
  for (const p of [preset.paths.input, preset.paths.handAuthored]) {
    mkdirSync(path.join(cwd, path.dirname(p)), { recursive: true });
  }
  writeFileSync(path.join(cwd, preset.paths.input), read("export.json"));
  writeFileSync(
    path.join(cwd, preset.paths.handAuthored),
    handAuthoredCss().split("\n")
      .filter((l) => !/^\s*--(?:screen-height|height-screen)-[a-z0-9]+:/.test(l))
      .join("\n"),
  );
  return cwd;
};

test("run() writes the four artifacts, and --check then passes over its own output", () => {
  const cwd = consumer();
  const out = run([], { cwd, config: preset });

  for (const p of [preset.paths.out, preset.paths.theme, preset.paths.report, preset.paths.exclusions]) {
    assert.ok(readFileSync(path.join(cwd, p), "utf8").length > 0, `${p} must be written`);
  }
  assert.match(readFileSync(path.join(cwd, preset.paths.out), "utf8"),
    /--device-screen-height-100: 20dvh;/);

  // Every field the CLI summary prints must exist and be countable.
  for (const field of ["rows", "privateRows", "hiddenRows", "excludedRows", "responsiveRows", "aliasRows", "warnings"]) {
    assert.ok(Array.isArray(out[field]), `${field} must be an array`);
  }
  assert.deepEqual(out.warnings.map((w) => [w.code, w.name]).sort(), [
    ["VIEWPORT_UNFLAGGED", "--device-container-max-width"],
    ["VIEWPORT_UNFLAGGED", "--device-screen-height-full"],
    ["VIEWPORT_UNFLAGGED", "--device-width"],
  ]);

  const before = process.exitCode;
  run(["--check"], { cwd, config: preset });
  assert.equal(process.exitCode, before, "--check must not flag its own fresh output");
});

test("--check flags a committed artifact that would change, and writes nothing", () => {
  const cwd = consumer();
  run([], { cwd, config: preset });
  const target = path.join(cwd, preset.paths.out);
  writeFileSync(target, "/* edited by hand */\n");

  const before = process.exitCode;
  try {
    run(["--check"], { cwd, config: preset });
    assert.equal(process.exitCode, 1);
    assert.equal(readFileSync(target, "utf8"), "/* edited by hand */\n");
  } finally {
    process.exitCode = before;
  }
});

// --- 0.3.0: `dispatch` and the `validate` subcommand ------------------------
// The fence: a first argument that is not a subcommand falls through to the
// generator path unchanged, so `--config`/`--check` behave exactly as before.

/** A writable that collects, so a command's own output is assertable. */
const sink = () => {
  const chunks = [];
  return { write: (s) => chunks.push(s), get text() { return chunks.join(""); } };
};
const FIXTURES = new URL("../fixtures/jhd-v8b-2026-09-10/", import.meta.url).pathname;

test("dispatch routes `validate` and prints ✓ per file, with the one real warning", async () => {
  const stdout = sink();
  const code = await dispatch(
    ["validate", path.join(FIXTURES, "export.json"), path.join(FIXTURES, "design-handoff-block-navigation.md")],
    { stdout, stderr: sink() },
  );
  assert.equal(code, 0);
  const lines = stdout.text.split("\n").filter(Boolean);
  assert.equal(lines.filter((l) => l.startsWith("✓")).length, 2, stdout.text);
  assert.equal(lines.filter((l) => l.startsWith("✗")).length, 0);
  assert.equal(stdout.text.match(/POLICY_VERSION_MISMATCH/g).length, 1);
  assert.match(stdout.text, /line 27/);
});

test("`validate --json` is machine-readable and `validate` exits 1 on an error", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-val-"));
  const bad = path.join(cwd, "export.json");
  const doc = JSON.parse(readFileSync(path.join(FIXTURES, "export.json"), "utf8"));
  doc.contentHash = "nope";
  writeFileSync(bad, JSON.stringify(doc));

  const stdout = sink();
  const code = await dispatch(["validate", bad, "--json"], { stdout, stderr: sink() });
  assert.equal(code, 1);
  const parsed = JSON.parse(stdout.text);
  assert.equal(parsed.results[0].ok, false);
  assert.equal(parsed.results[0].findings[0].path, "/contentHash");
});

test("`validate` with no files is a usage error, not a silent pass", async () => {
  const stderr = sink();
  assert.equal(await dispatch(["validate"], { stdout: sink(), stderr }), 1);
  assert.match(stderr.text, /name at least one/);
});

test("a first argument that is not a subcommand still runs the generator", async () => {
  const cwd = consumer();
  writeFileSync(path.join(cwd, "handoff.config.mjs"),
    `export default ${JSON.stringify(preset, null, 2)};\n`);
  const stdout = sink();
  const code = await dispatch(["--config", "handoff.config.mjs"], { cwd, stdout, stderr: sink() });
  assert.equal(code, 0);
  assert.match(stdout.text, /^handoff-css \(write\)/);
  assert.ok(readFileSync(path.join(cwd, preset.paths.out), "utf8").length > 0);

  // …and `--check` over that fresh output stays green, through dispatch too.
  assert.equal(await dispatch(["--config", "handoff.config.mjs", "--check"], { cwd, stdout: sink(), stderr: sink() }), 0);
});

test("a missing --config path is an error the CLI reports, not a stack trace", async () => {
  const stderr = sink();
  assert.equal(await dispatch(["--config"], { stdout: sink(), stderr }), 1);
  assert.match(stderr.text, /--config needs a path/);
});
