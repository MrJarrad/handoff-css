// Byte-for-byte parity pin for the v11 fixture — mirroring parity-v10.test.mjs,
// and the DS parity test this package's own suite should point at going
// forward: `fixtures/jhd-v11-2026-09-12/` carries the brief JSON companion
// (schema `design-handoff` v10, see `src/brief.mjs`) alongside the tokens
// export, and vendors its OWN hand-authored stylesheet rather than borrowing
// v8b's — `consumerCss("v11")`, not `consumerCss()`.
//
// Same design-system state as `docV10()` re-exported later
// (`eab3d422…498cc`, plugin export v15): every delay step Figma authored as a
// literal in the v10 export is now an alias of its matching duration step, so
// unlike v10 this run raises zero warnings — the known gap `test/motion-v10`
// pins is closed by the time of this export.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig040, consumerCss, docV11, expectedV11 } from "./fixture.mjs";

const out = generate(docV11(), consumerConfig040, { handAuthoredCss: consumerCss("v11") });

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["report", "ds-from-handoff-report.md"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed v11 fixture artifact`, () => {
    assert.equal(out[field], expectedV11(file));
  });
}

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(docV11(), consumerConfig040, { handAuthoredCss: consumerCss("v11") });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});

test("the v11 run raises no warnings — every delay step is aliased to its duration step", () => {
  assert.deepEqual(out.warnings, []);
});
