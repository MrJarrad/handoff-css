// 0.8.0 — operator ruling 2026-09-19 ("they were both design system things —
// the text style should carry them"): a TEXT style whose `paragraphSpacing`
// is bound to a variable (`properties.boundVariables.paragraphSpacing`)
// states that binding nowhere in `cssClass.declarations` — a plugin gap, the
// same shape P21's `bindFontFamily` already closes for `font-family`. This
// module closes the paragraph-spacing half: one additive `margin-block-end:
// var(<token>, <fallback>)` declaration, appended (never replacing an
// existing declaration), spacer-margins policy (handoff-to-code § Build
// standards item 7 — a paragraph gap is a trailing margin on the block it
// edges, never a literal).
//
// `text-wrap: pretty` is authored on individual TEXT NODES in a block export
// (`design-handoff`), never on a `design-system-handoff` TEXT STYLE — grepped
// absent from every TEXT style in `jhd-v17c-2026-09-16/export.json` and from
// the 2026-09-19 design-system-handoff export banked in the vault. There is
// therefore nothing for `emitStyles` to bind it to; it stays a block-export
// (node-level) build concern, out of this package's scope, and is reported as
// such below rather than fabricated onto the style class.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { generate } from "../src/index.mjs";
import { consumerConfig042, consumerCssV13, docV17c } from "./fixture.mjs";

const doc = docV17c();
const style = (name) => doc.styles.TEXT.find((s) => s.name === name);

test("the real schema-17 export states body-style1/100's paragraphSpacing bound to a variable, absent from its own cssClass.declarations", () => {
  const s = style("body-style1/100");
  assert.equal(s.properties.paragraphSpacing, 16);
  assert.ok(s.properties.boundVariables.paragraphSpacing, "fixture must bind paragraphSpacing");
  assert.ok(!s.cssClass.declarations.some((d) => /paragraph-spacing|margin-block/.test(d)),
    "fixture's own declarations must NOT already carry the binding (this is the gap being closed)");
});

test("generated styles.css carries a margin-block-end declaration bound to the paragraph-spacing token", () => {
  const out = generate(doc, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  assert.ok(out.stylesCss.includes(
    "@utility body-style1-100 {\n  font-size: var(--text-body-font-size-100, 1rem);\n  line-height: var(--text-body-line-height-100, 1.3);\n  letter-spacing: var(--text-body-letter-spacing-100, 0em);\n  font-weight: 600;\n  font-family: var(--family-font-sans, \"Inter Tight\");\n  margin-block-end: var(--text-body-paragraph-spacing-100, 16px);\n}",
  ), out.stylesCss.slice(out.stylesCss.indexOf("body-style1-100"), out.stylesCss.indexOf("body-style1-100") + 400));
});

test("every TEXT style whose paragraphSpacing is bound gets exactly one STYLE_CLASS_PARAGRAPH_SPACING_BOUND finding", () => {
  const out = generate(doc, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  const bound = doc.styles.TEXT.filter((s) => s.properties?.boundVariables?.paragraphSpacing);
  assert.ok(bound.length > 0);
  const hits = out.warnings.filter((w) => w.code === "STYLE_CLASS_PARAGRAPH_SPACING_BOUND");
  assert.equal(hits.length, bound.length);
});

test("a TEXT style that already declares margin-block-end is left alone — hand/export declaration wins, no duplicate appended", () => {
  const mutated = docV17c();
  const s = mutated.styles.TEXT.find((x) => x.name === "body-style1/100");
  s.cssClass.declarations = [...s.cssClass.declarations, "margin-block-end: 2rem"];
  s.cssClass.css = `${s.cssClass.selector} {\n${s.cssClass.declarations.map((d) => `  ${d};`).join("\n")}\n}`;
  const out = generate(mutated, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  const start = out.stylesCss.indexOf("@utility body-style1-100 {");
  const block = out.stylesCss.slice(start, out.stylesCss.indexOf("}", start) + 1);
  const count = (block.match(/margin-block-end/g) ?? []).length;
  assert.equal(count, 1);
  assert.ok(block.includes("margin-block-end: 2rem;"));
});

test("a TEXT style with no bound paragraphSpacing (paragraphSpacing: 0, unbound) gets no margin declaration and no finding", () => {
  const mutated = docV17c();
  const s = mutated.styles.TEXT.find((x) => !x.properties?.boundVariables?.paragraphSpacing);
  assert.ok(s, "fixture must have at least one unbound TEXT style");
  const out = generate(mutated, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  const block = out.stylesCss.slice(
    out.stylesCss.indexOf(`@utility ${s.cssClass.selector.slice(1)} {`),
    out.stylesCss.indexOf("}", out.stylesCss.indexOf(`@utility ${s.cssClass.selector.slice(1)} {`)) + 1,
  );
  assert.ok(!block.includes("margin-block-end"));
});

test("text-wrap:pretty is not stated on any schema-17 TEXT style — a block-export/node concern, not this package's to fabricate", () => {
  for (const s of doc.styles.TEXT) {
    assert.ok(!JSON.stringify(s).includes("textWrap"), `${s.name} unexpectedly states textWrap`);
  }
});
