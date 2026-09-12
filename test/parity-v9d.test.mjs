// Byte-for-byte parity pin for the v9d export (plugin export v10), mirroring
// parity-v9c.test.mjs — and the first fixture generated under the 0.4.0
// policies (P19 motion, P20 aspect), so it is also the pin that would catch
// either policy changing what it emits.
//
// `fixtures/jhd-v9d-2026-09-11/` is the plugin's 2026-09-11T18:08:21.155Z
// export v10, run through `consumerConfig040` and the same hand-authored
// stylesheet every other fixture uses.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig040, consumerCss, docV9d, expectedV9d } from "./fixture.mjs";

const out = generate(docV9d(), consumerConfig040, { handAuthoredCss: consumerCss() });

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["report", "ds-from-handoff-report.md"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed v9d fixture artifact`, () => {
    assert.equal(out[field], expectedV9d(file));
  });
}

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(docV9d(), consumerConfig040, { handAuthoredCss: consumerCss() });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});

test("the v9d run raises exactly one warning: the `tall` group's contradictory description", () => {
  assert.deepEqual(out.warnings.map((w) => [w.code, w.name]), [["ASPECT_RATIO_MIXED", "--aspect-tall"]]);
  assert.match(out.report, /\*\*Warnings \(1\)\*\*/);
});

test("the header names the document and the export's own state hash, not the download's filename (P18)", () => {
  assert.match(out.tokensCss, /Source: {3}JHD-Spec-DesignSystem/);
  assert.match(out.tokensCss, /State: {4}9cc28d2d9faa349e5984e0430ef0e311ad32ff25bbc68f6a84b04dccc6fd96eb/);
});
