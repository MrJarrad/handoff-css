// Byte-for-byte parity pin for the v9c export (plugin export v4), mirroring
// parity-v9b.test.mjs.
//
// `fixtures/jhd-v9c-2026-09-11/` is the plugin's 2026-09-11T09:47:02.715Z
// export v4 (schema 9, same design-system state as v9b: bb6a0025…7224) run
// through the same consumer config and the same hand-authored stylesheet —
// only the export moved. Expected diff vs `jhd-v9b`'s committed artifacts is
// HEADER ONLY (Source/Exported/generatedAt lines): the design-system state,
// tokens and responsive behaviour are unchanged between the two exports.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig, consumerCss, docV9c, expectedV9b } from "./fixture.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const V9C = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "jhd-v9c-2026-09-11");
const expectedV9c = (file) => readFileSync(path.join(V9C, "expected", file), "utf8");

const out = generate(docV9c(), consumerConfig, { handAuthoredCss: consumerCss() });

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["report", "ds-from-handoff-report.md"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed v9c fixture artifact`, () => {
    assert.equal(out[field], expectedV9c(file));
  });
}

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(docV9c(), consumerConfig, { handAuthoredCss: consumerCss() });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});

test("the v9c run raises NO warnings at all", () => {
  assert.deepEqual(out.warnings, []);
  assert.match(out.report, /\*\*Warnings \(0\)\*\*/);
});

test("v9c vs v9b's committed artifacts: the ONLY difference is the header (Source/Exported/generatedAt)", () => {
  for (const file of ["tokens.generated.css", "theme.generated.css", "ds-from-handoff-report.md", "exclusions.json"]) {
    const a = expectedV9c(file).split("\n");
    const b = expectedV9b(file).split("\n");
    assert.equal(a.length, b.length, `${file}: line count differs`);
    const changed = a.map((line, i) => (line === b[i] ? null : i)).filter((i) => i != null);
    for (const i of changed) {
      assert.match(a[i], /v4|v3|09:47:02\.715Z|07:31:20\.236Z/, `${file}:${i + 1} unexpected non-header diff: ${b[i]} -> ${a[i]}`);
    }
  }
});
