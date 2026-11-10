// P10b — `themes.variants`: a total theme can hand ONE sibling to a variant
// theme. `themes.total: ["bttf"]` makes `.bttf` claim every sibling
// (`.bttf .dark`, `.bttf.dark`), so Time Circuits overrides every dark surface
// with its light palette. With `variants: { bttf: { dark: "bttf-dark" } }`
// the `bttf-dark` mode claims `.bttf .dark` / `.bttf.dark` instead, and
// `.bttf` keeps only the siblings it was not told to hand over. Without the
// key, output is byte-identical (asserted against the unconfigured run).
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig042, consumerCssV13, docV17c } from "./fixture.mjs";

const clone = (x) => JSON.parse(JSON.stringify(x));

/** v17c's `color` collection (light, dark, bttf) plus a fourth theme mode,
    `bttf-dark`, whose values copy `dark` for every variable. */
function withBttfDark() {
  const doc = clone(docV17c());
  const color = doc.collections.find((c) => c.name === "color");
  const dark = color.modes.find((m) => m.name === "dark");
  color.modes.push({ id: "M:bttf-dark", name: "bttf-dark" });
  for (const v of color.variables) {
    const base = v.modes.find((m) => m.modeId === dark.id);
    if (!base) continue;
    v.modes.push({ ...clone(base), modeId: "M:bttf-dark", modeName: "bttf-dark" });
  }
  const entry = doc.breakpoints.entries.find((e) => e.modeId === dark.id);
  doc.breakpoints.entries.push({ ...clone(entry), modeId: "M:bttf-dark", modeName: "bttf-dark", theme: "bttf-dark" });
  return doc;
}

const run = (doc, variants) =>
  generate(
    doc,
    { ...consumerConfig042, themes: { ...consumerConfig042.themes, ...(variants ? { variants } : {}) } },
    { handAuthoredCss: consumerCssV13() },
  ).tokensCss;

const selectors = (css) => [...css.matchAll(/(?:^|\n)((?:\.[\w-]+[^{\n]*,?\n?)+)\s*\{/g)].map((m) => m[1].replace(/\s+/g, " ").trim());
const doc = withBttfDark();

test("without `themes.variants` the output is unchanged (bttf claims every sibling)", () => {
  const sels = selectors(run(doc));
  assert.ok(sels.includes(".bttf, .bttf .dark, .bttf.dark, .bttf .bttf-dark, .bttf.bttf-dark"), sels.join(" | "));
  assert.ok(sels.includes(".bttf-dark"));
});

test("a configured pairing hands `.bttf .dark` and `.bttf.dark` to the variant mode", () => {
  const sels = selectors(run(doc, { bttf: { dark: "bttf-dark" } }));
  assert.ok(sels.includes(".bttf-dark, .bttf .dark, .bttf.dark"), sels.join(" | "));
  assert.ok(!sels.some((s) => /^\.bttf,/.test(s) && /\.dark/.test(s.replace(/\.bttf-dark/g, ""))), "bttf must stop claiming dark");
});

test("a variants entry for a theme that is not total is rejected", () => {
  assert.throws(() => run(doc, { other: { dark: "bttf-dark" } }), /other/);
});

test("the generator rejects a variant that names an unknown mode", () => {
  assert.throws(() => run(doc, { bttf: { dark: "no-such-mode" } }), /no-such-mode/);
});

test("a variant that names the default mode is rejected (the sibling would be claimed by nothing)", () => {
  assert.throws(() => run(doc, { bttf: { dark: "light" } }), /themes\.variants\.bttf.*default mode of `color`/);
});

test("a sibling that names the default mode is rejected", () => {
  assert.throws(() => run(doc, { bttf: { light: "bttf-dark" } }), /themes\.variants\.bttf.*default mode of `color`/);
});
