// Byte-for-byte parity against what jhd-design-system SHIPS on 0.2.0.
//
// `test/parity.test.mjs` is the extraction's safety net, and it must stay that:
// its expectations are the artifacts that repo committed from its own in-repo
// generator, so it runs with every 0.2.0 behaviour pinned off, and
// regenerating those files would throw away the only thing they are for.
//
// This file is the other end of the same rope. `fixtures/jhd-v8b-2026-09-10/`
// is a real consumer at its real config: the schema-8 export it vendored, the
// stylesheet it ships after deleting the hand-written ramp, and the four
// artifacts `pnpm run tokens` wrote and it committed. Nothing here recomputes
// an expectation — each one is a file, produced by the CLI in another repo and
// read off disk.
//
// So: 0.1.0 output cannot move (parity.test.mjs) AND 0.2.0 output cannot move
// (this file). Between them, a refactor in `src/` has nowhere to hide.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig, consumerCss, docV8b, expectedV8b } from "./fixture.mjs";

const out = generate(docV8b(), consumerConfig, { handAuthoredCss: consumerCss() });

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["report", "ds-from-handoff-report.md"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed jhd-design-system 0.2.0 artifact`, () => {
    assert.equal(out[field], expectedV8b(file));
  });
}

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(docV8b(), consumerConfig, { handAuthoredCss: consumerCss() });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});

test("the shipped artifact is the 0.2.0 one: the ramp is fractions, and aliased", () => {
  // A cheap guard against the expected files being regenerated from a broken
  // run and this file then happily proving the breakage. These four facts are
  // the release, stated independently of the artifacts.
  assert.match(out.tokensCss, /\n {2}--device-screen-height-full: 100dvh;/);
  assert.match(out.tokensCss, /\n {2}--device-width: 100vw;/);
  assert.match(out.tokensCss, /\n {2}--screen-height-full: var\(--device-screen-height-full\);/);
  assert.equal(out.aliasRows.length, 16);
});
