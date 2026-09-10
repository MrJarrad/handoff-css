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
