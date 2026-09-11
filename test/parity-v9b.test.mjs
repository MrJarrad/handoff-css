// Byte-for-byte parity pin for the v9b export, mirroring parity-v9.test.mjs.
//
// `fixtures/jhd-v9b-2026-09-11/` is the operator's 2026-09-11T07:31Z re-export
// (schema 9, same design-system state as v9 and v8b: bb6a0025…7224) run
// through the same consumer config and the same hand-authored stylesheet —
// only the export moved. It is the release's headline: the last warning this
// consumer raised against the house export is gone, because the export now
// STATES `fixed` on `device/container-max-width` instead of leaving the
// generator to guess a fraction it never had.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig, consumerCss, docV9b, expectedV9b } from "./fixture.mjs";

const out = generate(docV9b(), consumerConfig, { handAuthoredCss: consumerCss() });

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["report", "ds-from-handoff-report.md"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed v9b fixture artifact`, () => {
    assert.equal(out[field], expectedV9b(file));
  });
}

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(docV9b(), consumerConfig, { handAuthoredCss: consumerCss() });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});

test("the v9b run raises NO warnings at all", () => {
  // Stated independently of the artifacts, so regenerating `expected/*` from a
  // broken run cannot make this file agree with the breakage.
  assert.deepEqual(out.warnings, []);
  assert.match(out.report, /\*\*Warnings \(0\)\*\*/);
});

test("`--device-container-max-width` is declared exactly once, at the export's own css", () => {
  const decls = out.tokensCss.split("\n").map((l) => l.trim())
    .filter((l) => l.startsWith("--device-container-max-width:"));
  assert.deepEqual(decls, ["--device-container-max-width: 2156px;"]);
});

test("the v9b device ramp is fractions, and aliased — same as v9", () => {
  assert.match(out.tokensCss, /\n {2}--device-screen-height-full: 100dvh;/);
  assert.match(out.tokensCss, /\n {2}--device-width: 100vw;/);
  assert.match(out.tokensCss, /\n {2}--screen-height-full: var\(--device-screen-height-full\);/);
  assert.equal(out.aliasRows.length, 16);
});
