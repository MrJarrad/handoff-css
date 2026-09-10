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

/**
 * The report gained §10 (responsive classes and aliases) in 0.2.0, so it is
 * compared with that section spliced out. The expected file stays the
 * untouched 0.1.0 artifact — re-generating it would throw away the one thing
 * it is here for — and this proves nothing ELSE in the report moved.
 */
const withoutSection10 = (md) => {
  const start = md.indexOf("## 10. Responsive classes");
  const end = md.indexOf("## Appendix A —");
  assert.ok(start > 0 && end > start, "§10 must be present, ahead of Appendix A");
  return md.slice(0, start) + md.slice(end);
};

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed jhd-design-system artifact`, () => {
    assert.equal(out[field], expected(file));
  });
}

test("ds-from-handoff-report.md is byte-identical outside the new §10", () => {
  assert.equal(withoutSection10(out.report), expected("ds-from-handoff-report.md"));
});

test("with every class pinned off, §10 says so and reports no change", () => {
  const section = out.report.slice(
    out.report.indexOf("## 10. Responsive classes"),
    out.report.indexOf("## Appendix A —"),
  );
  assert.match(section, /Honoured this run: none — every class takes the per-mode path\./);
  assert.match(section, /\*\*Aliases \(0\)\*\*/);
});

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(doc(), config, { handAuthoredCss: handAuthoredCss() });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});
