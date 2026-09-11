// Byte-for-byte parity pin for schema 9, mirroring parity-v8b.test.mjs.
//
// `fixtures/jhd-v9-2026-09-11/` is the operator's newest export (schema 9,
// same design-system state as v8b: bb6a0025…7224) run through the same
// consumer config and the same hand-authored stylesheet as v8b — only the
// export moved. `expected/*` is this package's own CLI output, committed so a
// refactor in `src/` has nowhere to hide a schema-9 regression.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig, consumerCss, docV9, expectedV9 } from "./fixture.mjs";

const out = generate(docV9(), consumerConfig, { handAuthoredCss: consumerCss() });

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["report", "ds-from-handoff-report.md"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed schema-9 fixture artifact`, () => {
    assert.equal(out[field], expectedV9(file));
  });
}

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(docV9(), consumerConfig, { handAuthoredCss: consumerCss() });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});

test("the schema-9 device ramp is fractions, and aliased — same as v8b", () => {
  // A cheap guard against the expected files being regenerated from a broken
  // run and this file then happily proving the breakage. These four facts are
  // the release, stated independently of the artifacts.
  assert.match(out.tokensCss, /\n {2}--device-screen-height-full: 100dvh;/);
  assert.match(out.tokensCss, /\n {2}--device-width: 100vw;/);
  assert.match(out.tokensCss, /\n {2}--screen-height-full: var\(--device-screen-height-full\);/);
  assert.equal(out.aliasRows.length, 16);
});
