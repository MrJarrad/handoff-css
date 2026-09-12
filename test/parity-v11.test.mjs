// Byte-for-byte parity pin for the v11 fixture — mirroring parity-v10.test.mjs,
// and the DS parity test this package's own suite should point at going
// forward: `fixtures/jhd-v11-2026-09-12/` carries the brief JSON companion
// (schema `design-handoff` v10, see `src/brief.mjs`) alongside the tokens
// export, and vendors its OWN hand-authored stylesheet rather than borrowing
// v8b's — `consumerCss("v11")`, not `consumerCss()`.
//
// 0.4.2 — this is the first fixture run through `consumerConfig042`: the
// operator ruling "let's follow what the plugin suggests" un-holds
// `fluid-clamp` and `fixed` (P11), so this run honours every
// `responsiveBehavior` strategy the export states, per `layoutVariant`, using
// the export's own `css` verbatim. `test/parity-v10.test.mjs` stays on
// `consumerConfig040` and stays byte-stable, proving the older fixture is
// unaffected by the preset change.
//
// Same design-system state as `docV10()` re-exported later
// (`eab3d422…498cc`, plugin export v15): every delay step Figma authored as a
// literal in the v10 export is now an alias of its matching duration step, so
// unlike v10 this run raises zero warnings — the known gap `test/motion-v10`
// pins is closed by the time of this export.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig042, consumerCss, docV11, expectedV11 } from "./fixture.mjs";

const out = generate(docV11(), consumerConfig042, { handAuthoredCss: consumerCss("v11") });

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
  const again = generate(docV11(), consumerConfig042, { handAuthoredCss: consumerCss("v11") });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});

test("motion raises no warnings — every delay step is aliased to its duration step", () => {
  assert.deepEqual(out.warnings.filter((w) => w.code === "DELAY_NOT_ALIASED"), []);
});

// 0.4.2 — three `text/*/letter-spacing` variables carry an all-`fixed`
// `responsiveBehavior`, but their `sm`/`md` samples genuinely disagree: the
// export's claim is checked before it is collapsed (P11), and a false claim
// falls back to the per-mode path with `FIXED_VARIES_BY_MODE`, one per
// variable (not one per width sample — see the dedupe in `emit-tokens.mjs`).
test("an honoured `fixed` rule whose modes disagree raises FIXED_VARIES_BY_MODE once per variable, not per width", () => {
  const fixedVaries = out.warnings.filter((w) => w.code === "FIXED_VARIES_BY_MODE");
  assert.deepEqual(fixedVaries.map((w) => w.name).sort(), [
    "--text-body-letter-spacing-100",
    "--text-body-letter-spacing-300",
    "--text-title-letter-spacing-200",
  ]);
});
