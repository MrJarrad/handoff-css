// HT-85 (s69 X3 read-back) — a consumer with no hand-authored stylesheet (no
// `src/styles.css` yet) crashed `run()` with ENOENT. A missing file means
// "no hand declarations": it is read as empty, nothing is created in the
// consumer's tree, and the report says the file was absent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { run } from "../src/index.mjs";
import { preset, read } from "./fixture.mjs";

const consumerWithoutHandFile = () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-nohand-"));
  mkdirSync(path.join(cwd, path.dirname(preset.paths.input)), { recursive: true });
  writeFileSync(path.join(cwd, preset.paths.input), read("export.json"));
  return cwd;
};

test("run() with a missing hand-authored stylesheet generates, creates nothing, and reports it", () => {
  const cwd = consumerWithoutHandFile();
  const handFile = path.join(cwd, preset.paths.handAuthored);
  assert.equal(existsSync(handFile), false);

  const out = run([], { cwd, config: preset });

  assert.ok(readFileSync(path.join(cwd, preset.paths.out), "utf8").length > 0, "tokens are still written");
  assert.equal(existsSync(handFile), false, "the consumer's tree gains no hand-authored file");
  assert.ok(out.warnings.some((w) => w.code === "HAND_AUTHORED_MISSING"), "a HAND_AUTHORED_MISSING warning is raised");
  assert.match(readFileSync(path.join(cwd, preset.paths.report), "utf8"), /HAND_AUTHORED_MISSING/);
});
