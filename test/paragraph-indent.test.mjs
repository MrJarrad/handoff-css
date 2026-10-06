// `bindParagraphIndent` (`src/emit-styles.mjs`) — a TEXT style's
// `properties.paragraphIndent` is bound to a variable
// (`properties.boundVariables.paragraphIndent` -> `text/paragraph-indent`,
// WEB `--text-paragraph-indent`) on the 8 `*-style1/indent/N` styles, but the
// export's own `cssClass.declarations` states no `text-indent` (a plugin gap,
// the paragraph-indent counterpart of the P21.5 font-family and P23
// paragraph-spacing gaps).
//
// Fixture values are lifted from the real design-system export
// `jhd-spec-designsystem-design-system-handoff-2026-10-06-12-23-32.json`
// (jhd-design-system Figma export of 2026-10-06): variable
// `VariableID:5209:30539` (`text/paragraph-indent`, resolves to 308 in the
// default `lg` mode), `body-style1/indent/100` (paragraphIndent 308, bound) and
// `body-style1/100` (paragraphIndent 0, unbound).
import { test } from "node:test";
import assert from "node:assert/strict";

import { emitStyles } from "../src/emit-styles.mjs";

const INDENT = {
  id: "VariableID:5209:30539",
  name: "text/paragraph-indent",
  type: "FLOAT",
  codeSyntax: { WEB: { value: "--text-paragraph-indent", source: "derived" } },
};
const byId = new Map([[INDENT.id, INDENT]]);

const decls = (n) => [
  `font-size: var(--text-body-font-size-${n}00, 1rem)`,
  `line-height: var(--text-body-line-height-${n}00, 1.25)`,
  `letter-spacing: var(--text-body-letter-spacing-${n}00, 0em)`,
  "font-weight: 600",
  'font-family: var(--family-font-sans, "Inter Tight")',
];

const textStyle = (name, { indent, bound, declarations }) => {
  const slug = name.replace(/\//g, "-");
  return {
    name,
    leafName: name.split("/").at(-1),
    properties: {
      paragraphIndent: indent,
      boundVariables: bound ? { paragraphIndent: { type: "VARIABLE_ALIAS", id: INDENT.id } } : {},
    },
    rawStyleProperties: [],
    cssClass: { selector: `.${slug}`, declarations: declarations ?? decls(1) },
  };
};

const cfg = { paths: { handAuthored: "styles.css" }, header: { regenerateCommand: "handoff-css" } };
const docOf = (styles) => ({
  styles: { TEXT: [], EFFECT: [], GRID: [], PAINT: [], ...styles },
  documentName: "test fixture",
  schema: "design-system-handoff",
  schemaVersion: 17,
  generatedAt: "2026-10-06T12:23:32.000Z",
  fingerprint: { designSystemStateHash: "test" },
});
const run = (styles) => emitStyles(docOf({ TEXT: styles }), byId, new Map(), new Set(), cfg);
const block = (css, selector) => css.match(new RegExp(`@utility ${selector.slice(1)} \\{[^}]*\\}`))[0];

test("a bound non-zero paragraphIndent emits text-indent: var(--text-paragraph-indent, 308px) after the export's own declarations", () => {
  const out = run([textStyle("body-style1/indent/100", { indent: 308, bound: true })]);
  assert.equal(
    block(out.css, ".body-style1-indent-100"),
    `@utility body-style1-indent-100 {\n${[...decls(1), "text-indent: var(--text-paragraph-indent, 308px)"].map((d) => `  ${d};`).join("\n")}\n}`,
  );
  assert.equal(out.warnings.filter((w) => w.code === "STYLE_CLASS_PARAGRAPH_INDENT_BOUND").length, 1);
});

test("paragraphIndent: 0 (unbound) leaves the class byte-for-byte as the export stated it", () => {
  const out = run([textStyle("body-style1/100", { indent: 0, bound: false })]);
  assert.ok(!out.css.includes("text-indent"));
  assert.equal(out.warnings.filter((w) => w.code === "STYLE_CLASS_PARAGRAPH_INDENT_BOUND").length, 0);
});

test("a non-zero paragraphIndent with no variable binding emits the raw px value", () => {
  const out = run([textStyle("body-style1/indent/100", { indent: 24, bound: false })]);
  assert.match(block(out.css, ".body-style1-indent-100"), /  text-indent: 24px;\n\}/);
});

test("a class that already states text-indent keeps the export's declaration", () => {
  const own = [...decls(1), "text-indent: 2em"];
  const out = run([textStyle("body-style1/indent/100", { indent: 308, bound: true, declarations: own })]);
  assert.equal(out.css.match(/text-indent/g).length, 1);
  assert.ok(out.css.includes("text-indent: 2em;"));
});

test("only TEXT styles are touched", () => {
  const eff = { ...textStyle("effect/x/100", { indent: 308, bound: true }), };
  const out = emitStyles(docOf({ EFFECT: [eff] }), byId, new Map(), new Set(), cfg);
  assert.ok(out.css.includes("effect-x-100"));
  assert.ok(!out.css.includes("text-indent"));
});
