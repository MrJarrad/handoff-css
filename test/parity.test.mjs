// Byte-for-byte parity against the artifacts jhd-design-system committed from
// its own in-repo generator, before this package existed.
//
// This is the extraction's only real safety net: the four expected files under
// `fixtures/jhd-v7b/expected/` are unmodified copies of that repo's committed
// output, so any divergence — a lifted constant that changed value, a config
// key wired to the wrong string, a reordered emit — fails here rather than
// landing silently in a design system. Nothing in this file recomputes an
// expected value; every expectation is a committed file read off disk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generate } from "../src/index.mjs";
import { config, doc, expected, handAuthoredCss } from "./fixture.mjs";

const out = generate(doc(), config, { handAuthoredCss: handAuthoredCss() });

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["report", "ds-from-handoff-report.md"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed jhd-design-system artifact`, () => {
    assert.equal(out[field], expected(file));
  });
}

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(doc(), config, { handAuthoredCss: handAuthoredCss() });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});
