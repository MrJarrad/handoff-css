// Byte-for-byte parity pin for the v10 export (plugin export v11), mirroring
// parity-v9c.test.mjs — and the first fixture generated under the 0.4.0
// policies (P19 motion, P20 aspect), so it is also the pin that would catch
// either policy changing what it emits.
//
// `fixtures/jhd-v10-2026-09-12/` is the plugin's 2026-09-12T07:11:41.254Z
// export v11, run through `consumerConfig040` and the same hand-authored
// stylesheet every other fixture uses.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig040, consumerCss, docV10, expectedV10 } from "./fixture.mjs";

const out = generate(docV10(), consumerConfig040, { handAuthoredCss: consumerCss() });

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["report", "ds-from-handoff-report.md"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed v10 fixture artifact`, () => {
    assert.equal(out[field], expectedV10(file));
  });
}

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(docV10(), consumerConfig040, { handAuthoredCss: consumerCss() });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});

test("the v10 run's only warnings are the thirteen delay steps Figma authored as literals instead of aliases", () => {
  assert.deepEqual([...new Set(out.warnings.map((w) => w.code))], ["DELAY_NOT_ALIASED"]);
  assert.equal(out.warnings.length, 13);
  assert.match(out.report, /\*\*Warnings \(13\)\*\*/);
});

test("the header names the document and the export's own state hash, not the download's filename (P18)", () => {
  assert.match(out.tokensCss, /Source: {3}JHD-Spec-DesignSystem/);
  assert.match(out.tokensCss, /State: {4}26351f7a09758f626996439752be73090a54f3ec5e5fa371edd44b716e07defc/);
});
