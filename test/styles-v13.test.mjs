// P21 / P22 — the 0.5.0 lanes, against `fixtures/jhd-v13-2026-09-12`: the
// first export that states its own CSS.
//
// Everything asserted here is either a byte the EXPORT stated (so the test
// proves the generator copied it rather than composed it) or a count over the
// export. Nothing recomputes a selector, a declaration or a weight — that is
// the whole of what P21 and P22 promise not to do.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { readHandAuthored } from "../src/hand-authored.mjs";
import { indexById, webName } from "../src/schema.mjs";
import { consumerConfig042, consumerCssV13, docV13, expectedV13 } from "./fixture.mjs";

const doc = docV13();
const out = generate(doc, consumerConfig042, { handAuthoredCss: consumerCssV13() });
const style = (type, name) => doc.styles[type].find((s) => s.name === name);
const byId = indexById(doc);

/** 0.8.1 (P23) — a TEXT style's bound-but-undeclared `paragraphSpacing` emits
 * an adjacent-sibling rule, `<selector> + <selector> { margin-block-start:
 * var(<token>, <raw>px) }`, never touching the class's own declarations.
 * `null` when the style gets no such rule (unbound, or already stating
 * `margin-block*` itself). */
const paragraphSpacingSiblingRule = (s) => {
  const bound = s.properties?.boundVariables?.paragraphSpacing;
  if (!bound?.id) return null;
  if (s.cssClass.declarations.some((d) => /^margin-block/.test(d))) return null;
  const variable = byId.get(bound.id);
  if (!variable) return null;
  const raw = s.properties.paragraphSpacing;
  const fallback = typeof raw === "number" ? `${raw}px` : "0px";
  const selector = s.cssClass.selector;
  return `${selector} + ${selector} {\n  margin-block-start: var(${webName(variable)}, ${fallback});\n}`;
};

for (const [field, file] of [
  ["tokensCss", "tokens.generated.css"],
  ["stylesCss", "styles.generated.css"],
  ["themeCss", "theme.generated.css"],
  ["report", "ds-from-handoff-report.md"],
  ["exclusionsJson", "exclusions.json"],
]) {
  test(`${file} is byte-identical to the committed v13 fixture artifact`, () => {
    assert.equal(out[field], expectedV13(file));
  });
}

test("a second generate() over the same inputs is byte-identical (deterministic)", () => {
  const again = generate(docV13(), consumerConfig042, { handAuthoredCss: consumerCssV13() });
  for (const field of ["tokensCss", "stylesCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});

// --- P21 ------------------------------------------------------------------

// 0.5.1 — house policy (`config.styles.emit: "utility"`) writes every class as
// a Tailwind v4 `@utility <name> { … }`, reachable from a consumer's own
// `@apply` and living in the utilities layer under the normal cascade, instead
// of the bare unlayered `.name { … }` of 0.5.0 (`emit: "class"`).
//
// `--family-font-sans` (`family/font-sans`, `text-primitives`) states the raw
// value `Suisse Intl` — the SAME value every TEXT class's `font-family`
// declaration freezes as a literal (a plugin gap; the plugin fix is tracked
// separately). 0.5.1's one documented substitution rebinds that literal to
// `var(--family-font-sans, "Suisse Intl")`; every other byte stays the
// export's.
test("the done-when class is emitted as a Tailwind v4 @utility with its font-family bound", () => {
  const s = style("TEXT", "title-style1/100");
  assert.equal(s.cssClass.selector, ".title-style1-100");
  assert.equal(s.cssClass.declarations.at(-1), 'font-family: "Suisse Intl"');
  assert.ok(
    out.stylesCss.includes(`@utility title-style1-100 {
  font-size: var(--text-title-font-size-100, 1rem);
  line-height: 1.1;
  letter-spacing: var(--letter-spacing-300, -0.015625em);
  font-weight: 500;
  font-family: var(--family-font-sans, "Suisse Intl");
}`),
    out.stylesCss.slice(0, 1200),
  );
});

test("every style with declarations is emitted as an @utility, verbatim (font-family bound) and in the export's order", () => {
  for (const type of ["TEXT", "EFFECT", "GRID", "PAINT"]) {
    for (const s of doc.styles[type]) {
      if (!s.cssClass?.declarations?.length) continue;
      let decls = s.cssClass.declarations.map((d) =>
        type === "TEXT" && d === 'font-family: "Suisse Intl"'
          ? 'font-family: var(--family-font-sans, "Suisse Intl")'
          : d);
      let block = `@utility ${s.cssClass.selector.slice(1)} {\n${decls.map((d) => `  ${d};`).join("\n")}\n}`;
      if (type === "TEXT") {
        const siblingRule = paragraphSpacingSiblingRule(s);
        if (siblingRule) block = `${block}\n${siblingRule}`;
      }
      assert.ok(out.stylesCss.includes(block), `missing ${s.cssClass.selector}`);
    }
  }
});

test("the emitted rule reproduces the export's own `cssClass.css` for every property but `font-family`, as an @utility", () => {
  // Two independent statements of the same class in the export. If this
  // generator ever recomposed a declaration other than the one documented
  // substitution, these would drift.
  const asUtility = (s, css) => css.replace(`${s.cssClass.selector} {`, `@utility ${s.cssClass.selector.slice(1)} {`);
  for (const type of ["EFFECT", "GRID"]) {
    for (const s of doc.styles[type]) {
      assert.ok(out.stylesCss.includes(asUtility(s, s.cssClass.css)), `${s.cssClass.selector} does not match cssClass.css`);
    }
  }
  for (const s of doc.styles.TEXT) {
    let rebound = asUtility(s, s.cssClass.css).replace(
      'font-family: "Suisse Intl";',
      'font-family: var(--family-font-sans, "Suisse Intl");',
    );
    const siblingRule = paragraphSpacingSiblingRule(s);
    if (siblingRule) rebound = `${rebound}\n${siblingRule}`;
    assert.ok(out.stylesCss.includes(rebound), `${s.cssClass.selector} does not match cssClass.css modulo font-family binding/paragraph-spacing sibling rule`);
  }
});

test("class order is TEXT, then EFFECT, then GRID", () => {
  const at = (name) => out.stylesCss.indexOf(`\n@utility ${name} {`);
  assert.ok(at("title-style1-100") < at("effect-border-border-focused"));
  assert.ok(at("effect-border-border-focused") < at("grid-default"));
});

// The done-when ask is proved with a real Tailwind v4 compile, run once by hand
// against this package's own output rather than added as a permanent
// devDependency + build step for one assertion (code-minimalism: a whole
// PostCSS pipeline is a heavier rung than this repo needs to hold):
//
//   npx @tailwindcss/cli -i input.css -o output.css
//     @import "tailwindcss";
//     @import "./styles.generated.css";     (the v13 fixture's committed output)
//     .my-heading { @apply title-style1-100; }
//
//   -> output.css:
//     .my-heading {
//       font-size: var(--text-title-font-size-100, 1rem);
//       line-height: 1.1;
//       letter-spacing: var(--letter-spacing-300, -0.015625em);
//       font-weight: 500;
//       font-family: var(--family-font-sans, "Suisse Intl");
//     }
//
// `@apply` resolved the utility with no error — the failure mode reds 1–4
// named (`Cannot apply unknown utility class title-style1-200`) does not
// reproduce against 0.5.1's `@utility` output.
test("`styles.emit: \"class\"` opts back into a bare, unlayered class — 0.5.0 behaviour", () => {
  const classConfig = { ...consumerConfig042, styles: { emit: "class" } };
  const mine = generate(docV13(), classConfig, { handAuthoredCss: consumerCssV13() });
  assert.ok(mine.stylesCss.includes(`.title-style1-100 {
  font-size: var(--text-title-font-size-100, 1rem);
  line-height: 1.1;
  letter-spacing: var(--letter-spacing-300, -0.015625em);
  font-weight: 500;
  font-family: var(--family-font-sans, "Suisse Intl");
}`));
  assert.ok(!mine.stylesCss.includes("@utility"));
});

test("every style in the export has a row, and all 74 with declarations are GENERATED", () => {
  const counted = ["PAINT", "TEXT", "EFFECT", "GRID"].reduce((n, t) => n + doc.styles[t].length, 0);
  assert.equal(out.styleRows.length, counted);
  assert.equal(out.styleRows.filter((r) => r.status === "GENERATED").length, 74);
  assert.deepEqual([...new Set(out.styleRows.map((r) => r.status))], ["GENERATED"]);
});

test("PAINT contributes no classes — the export publishes none", () => {
  assert.equal(doc.styles.PAINT.length, 0);
  assert.equal(out.styleRows.filter((r) => r.type === "PAINT").length, 0);
});

// --- P21, hand-authored wins ----------------------------------------------

test("a consumer that declares the selector by hand wins the cascade and suppresses the class", () => {
  const hand = `.title-style1-100 { font-size: 2rem; }\n`;
  const mine = generate(docV13(), consumerConfig042, { handAuthoredCss: consumerCssV13() + hand });
  const row = mine.styleRows.find((r) => r.selector === ".title-style1-100");
  assert.equal(row.status, "VALUE-DRIFT");
  assert.deepEqual(row.hand, ["font-size: 2rem"]);
  assert.ok(!mine.stylesCss.includes("\n@utility title-style1-100 {"));
});

test("a hand-authored class stating the export's own declarations is MATCH", () => {
  const s = style("GRID", "default");
  const hand = `${s.cssClass.selector} { ${s.cssClass.declarations.join("; ")}; }\n`;
  const mine = generate(docV13(), consumerConfig042, { handAuthoredCss: consumerCssV13() + hand });
  assert.equal(mine.styleRows.find((r) => r.selector === s.cssClass.selector).status, "MATCH");
});

test("`@utility foo` shadows `.foo` but does not suppress it — it is reported, not obeyed", () => {
  // The whole point of 0.5.0: styles.css hand-authors sixteen of these type
  // utilities, and the generated class is what replaces them.
  const { utilities, classes } = readHandAuthored(consumerCssV13());
  assert.ok(utilities.has("title-style1-100"));
  assert.ok(!classes.has(".title-style1-100"));
  const row = out.styleRows.find((r) => r.selector === ".title-style1-100");
  assert.equal(row.shadowed, true);
  assert.equal(row.status, "GENERATED");
  assert.equal(out.styleRows.filter((r) => r.shadowed).length, 16);
});

test("a nested class rule does not count as a hand-authored declaration", () => {
  const hand = `@media (min-width: 40rem) { .title-style1-100 { font-size: 9rem; } }\n`;
  const mine = generate(docV13(), consumerConfig042, { handAuthoredCss: consumerCssV13() + hand });
  assert.equal(mine.styleRows.find((r) => r.selector === ".title-style1-100").status, "GENERATED");
});

// --- P21, the two export findings -----------------------------------------

test("the schema 13 export raises neither structural STYLE_CLASS finding — the plugin fixed both at the source", () => {
  assert.deepEqual(
    out.warnings.filter((w) => w.code === "STYLE_CLASS_LITERAL" || w.code === "STYLE_CLASS_UNSCOPED"),
    [],
  );
});

// --- P21, font-family binding (0.5.1) --------------------------------------

test("every TEXT class's font-family literal is bound, one STYLE_CLASS_FONT_BOUND finding per class", () => {
  const hits = out.warnings.filter((w) => w.code === "STYLE_CLASS_FONT_BOUND");
  assert.equal(hits.length, doc.styles.TEXT.length);
  assert.ok(hits.every((w) => /bound to `--family-font-sans`/.test(w.detail)));
  assert.deepEqual(out.warnings.filter((w) => w.code === "STYLE_CLASS_FONT_LITERAL"), []);
});

test("a font-family literal with no matching export variable raises STYLE_CLASS_FONT_LITERAL, and is left verbatim", () => {
  const mutated = docV13();
  const s = mutated.styles.TEXT.find((x) => x.name === "title-style1/100");
  s.cssClass.declarations = s.cssClass.declarations.map((d) =>
    d.startsWith("font-family:") ? 'font-family: "Nonexistent Face"' : d);
  const mine = generate(mutated, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  const hit = mine.warnings.filter((w) => w.code === "STYLE_CLASS_FONT_LITERAL" && w.name === ".title-style1-100");
  assert.equal(hit.length, 1);
  assert.match(hit[0].detail, /"Nonexistent Face"/);
  assert.ok(mine.stylesCss.includes('font-family: "Nonexistent Face";'));
});

test("STYLE_CLASS_LITERAL fires when a class freezes a value the same style binds", () => {
  // The schema 12 export of the same design-system state stated exactly this:
  // `box-shadow: 0px 0px 0px 2px #3A96CFFF` on a style bound to
  // `color/border/focused/dark`. Reconstructed here rather than vendoring a
  // second 7 MB export for one declaration.
  const mutated = docV13();
  const s = mutated.styles.EFFECT.find((x) => x.name === "border/border-focused");
  s.cssClass.declarations = ["box-shadow: 0px 0px 0px 2px #3A96CFFF"];
  const mine = generate(mutated, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  const hit = mine.warnings.filter((w) => w.code === "STYLE_CLASS_LITERAL");
  assert.equal(hit.length, 1);
  assert.equal(hit[0].name, ".effect-border-border-focused");
  assert.match(hit[0].detail, /#3A96CFFF/);
  assert.match(hit[0].detail, /--border-focused-dark/);
});

test("a literal inside a `var()` fallback is the binding, not a frozen value", () => {
  // `column-gap: var(--grid-gap, 48px)` states 48 twice over; only the
  // fallback, which is what the binding is FOR. Zero findings above proves it.
  const s = style("GRID", "default");
  assert.deepEqual(s.cssClass.declarations.at(-1), "column-gap: var(--grid-gap, 48px)");
});

test("STYLE_CLASS_UNSCOPED fires when a selector is the style's bare leaf name", () => {
  // Schema 12 published `.default` / `.flush` for the grid styles; schema 13
  // prefixes them `.grid-*`.
  const mutated = docV13();
  for (const s of mutated.styles.GRID) {
    s.cssClass.selector = `.${s.leafName}`;
    s.cssClass.declarations = ["display: grid"];
  }
  const mine = generate(mutated, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  assert.deepEqual(
    mine.warnings.filter((w) => w.code === "STYLE_CLASS_UNSCOPED").map((w) => w.name).sort(),
    [".default", ".default-margin-sm", ".default-xl", ".default-xl-margin-sm", ".flush",
     ".sidebar-aside", ".sidebar-main"],
  );
});

// --- P22 ------------------------------------------------------------------

test("a STRING variable with fontWeightNumeric emits the number, not the quoted style name", () => {
  const v = doc.collections.find((c) => c.name === "text-primitives")
    .variables.find((x) => x.name === "weight/strong");
  assert.equal(v.type, "STRING");
  assert.equal(v.modes[0].raw, "Medium");
  assert.equal(v.fontWeightNumeric.css, "500");
  assert.ok(out.tokensCss.includes("--weight-strong: 500;"));
  assert.ok(!out.tokensCss.includes('--weight-strong: "Medium"'));
});

test("the weight row names the export's own style name and confidence", () => {
  assert.deepEqual(out.fontWeightRows, [{
    collection: "text-primitives",
    name: "--weight-strong",
    value: "500",
    sourceStyleName: "Medium",
    confidence: "high",
    emitted: true,
  }]);
});

test("without fontWeightNumeric the STRING stays quoted — nothing maps a style name to a number", () => {
  const mutated = docV13();
  const v = mutated.collections.find((c) => c.name === "text-primitives")
    .variables.find((x) => x.name === "weight/strong");
  delete v.fontWeightNumeric;
  const mine = generate(mutated, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  assert.ok(mine.tokensCss.includes('--weight-strong: "Medium";'));
  assert.deepEqual(mine.fontWeightRows, []);
});

// --- cssCustomPropertySheets ----------------------------------------------

test("the export's own sheets are cross-checked and never emitted", () => {
  assert.ok(doc.cssCustomPropertySheets.length > 0);
  // The sheets state values this consumer's policies do not: 8-digit hex
  // (P4 emits `#000000`), and a TIMING the plugin stringified an object into.
  // Neither reaches the stylesheet, which is what "informational" means.
  assert.ok(doc.cssCustomPropertySheets.some((s) => s.declarations.some((d) => d.includes("#000000FF"))));
  assert.ok(!out.tokensCss.includes("#000000FF"));
  assert.ok(!out.tokensCss.includes("[object Object]"));
  // Nor is a whole sheet block copied in: its `/* mode: sm */` pseudo-selector
  // is not a selector at all, and the generator emits real media queries.
  assert.ok(!out.tokensCss.includes("/* mode: sm */ {"));
});

test("every sheet difference is reported, and each row states both values", () => {
  assert.equal(out.sheetRows.length, 653);
  for (const r of out.sheetRows) {
    assert.notEqual(r.sheet, r.generated);
    assert.ok(r.name.startsWith("--") && r.collection && r.mode);
  }
  // The export defect the cross-check exists to catch: 101 motion declarations
  // the plugin stringified an object into.
  assert.equal(out.sheetRows.filter((r) => r.sheet === "[object Object]").length, 101);
});

test("a sheet value equal to the generated one is not a finding", () => {
  const mutated = docV13();
  const sheet = mutated.cssCustomPropertySheets.find((s) => s.collectionName === "text-primitives");
  const before = generate(mutated, consumerConfig042, { handAuthoredCss: consumerCssV13() })
    .sheetRows.filter((r) => r.name === "--family-font-sans");
  assert.equal(before.length, 1);
  sheet.declarations = sheet.declarations.map((d) =>
    d.startsWith("--family-font-sans:") ? '--family-font-sans: "Suisse Intl"' : d);
  const after = generate(mutated, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  assert.deepEqual(after.sheetRows.filter((r) => r.name === "--family-font-sans"), []);
});

// --- no file when the export publishes no classes -------------------------

test("an export with no cssClass writes no styles stylesheet", () => {
  const mutated = docV13();
  // A schema 8-11 export: styles are published, with no class on them.
  for (const type of ["TEXT", "EFFECT", "GRID", "PAINT"]) {
    for (const s of mutated.styles[type]) {
      delete s.cssClass;
      delete s.codeSyntax;
    }
  }
  const mine = generate(mutated, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  assert.equal(mine.stylesCss, null);
  assert.deepEqual([...new Set(mine.styleRows.map((r) => r.status))], ["NO-DECLARATIONS"]);
  assert.ok(!mine.report.includes("## 11. Styles"));
});
