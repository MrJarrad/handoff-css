// A collection mode that is neither a theme nor a layout width (Figma's
// `text-primitives` "outatime" mode) is published as a data attribute that
// re-points the collection's own variables. Three things must follow from it,
// all derived from the export, none listed here:
//
//   1. Variables of OTHER collections that alias a variable the mode changes
//      (the layout role tokens, `--text-title-letter-spacing-200:
//      var(--letter-spacing-400)`) are re-declared under the mode attribute, in
//      every media wrapper they are declared in. A custom property that
//      contains `var()` is resolved where it is declared, so an alias declared
//      only on `:root` never sees the mode set on a descendant.
//   2. A STRING font-style variable (`weight/600`: "Semi Bold" | "Regular") is a
//      numeric font weight in EVERY mode, read off the export's own
//      style-name -> number table, not the default mode's number repeated.
//   3. A text style that binds a font-style variable emits
//      `font-weight: var(<token>, <numeric>)`, so the mode can re-point it.
//
// And nothing the single-mode export emitted may change.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig042, consumerCssV13, docV17c } from "./fixture.mjs";

const MODE = "alt";
const ATTR = `[data-jhd-text-primitives-mode="${MODE}"]`;

const run = (doc) => generate(doc, consumerConfig042, { handAuthoredCss: consumerCssV13() });
const webName = (v) => v.codeSyntax.WEB.value;

/** The fixture with a second `text-primitives` mode whose values differ where a
    real export's would: the letter-spacing steps and the font-style strings. */
function withMode(doc, { weightRaw = "Regular" } = {}) {
  const tp = doc.collections.find((c) => c.name === "text-primitives");
  tp.modes.push({ id: "M:alt", name: MODE });
  // The export's own style-name -> number table: another weight variable.
  const strong = tp.variables.find((v) => v.fontWeightNumeric);
  const regular = JSON.parse(JSON.stringify(strong));
  Object.assign(regular, { id: "VariableID:T:regular", key: "t-regular", name: "weight/regular" });
  regular.codeSyntax.WEB.value = "--weight-regular";
  regular.fontWeightNumeric = { numeric: 400, confidence: "high", sourceStyleName: "Regular", css: "400", cssProperty: "font-weight" };
  regular.modes[0].raw = "Regular";
  regular.modes[0].build.raw = "Regular";
  tp.variables.push(regular);
  for (const v of tp.variables) {
    const base = v.modes[0];
    const alt = JSON.parse(JSON.stringify(base));
    alt.modeId = "M:alt";
    alt.modeName = MODE;
    if (v.name === "letter-spacing/400") {
      alt.raw = -1.6;
      alt.build = { ...alt.build, raw: -1.6, value: -0.08, css: "-0.08em" };
    }
    if (v.id === strong.id) {
      alt.raw = weightRaw;
      alt.build = { ...alt.build, raw: weightRaw };
    }
    v.modes.push(alt);
  }
  return { doc, strong, tp };
}

/** Top-level rules of a CSS text, as [wrapper|"", selector, body] triples. */
function rules(css) {
  const out = [];
  const walk = (text, wrapper) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open < 0) break;
      let depth = 0;
      let j = open;
      for (; j < text.length; j++) {
        if (text[j] === "{") depth++;
        if (text[j] === "}" && --depth === 0) break;
      }
      const head = text.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, "").trim();
      const body = text.slice(open + 1, j);
      if (head.startsWith("@media")) walk(body, head);
      else out.push([wrapper, head, body]);
      i = j + 1;
    }
  };
  walk(css, "");
  return out;
}
const declares = (body, name) => new RegExp(`(^|[\\s;])${name}:\\s*([^;]+);`).exec(body)?.[2].trim();

const dependentsOf = (doc, changedName) => {
  const changed = new Set();
  for (const c of doc.collections) for (const v of c.variables) if (v.name === changedName) changed.add(v.id);
  const out = [];
  for (const c of doc.collections) {
    if (c.name === "text-primitives") continue;
    for (const v of c.variables) {
      const hops = v.modes.flatMap((m) => (m.alias?.chain ?? []).map((h) => h.variableId));
      if (hops.some((id) => changed.has(id))) out.push(webName(v));
    }
  }
  return out;
};

test("the mode block carries the collection's own changed variable", () => {
  const { doc } = withMode(docV17c());
  const css = run(doc).tokensCss;
  const bodies = rules(css).filter(([w, sel]) => w === "" && sel === ATTR).map(([, , b]) => b);
  assert.ok(bodies.length, `${ATTR} block missing`);
  assert.equal(declares(bodies.join("\n"), "--letter-spacing-400"), "-0.08em");
});

test("variables aliasing a variable the mode changes are re-declared under the mode, in every wrapper they are declared in", () => {
  const { doc } = withMode(docV17c());
  const dependents = dependentsOf(doc, "letter-spacing/400");
  assert.ok(dependents.length > 0, "fixture has no dependents of letter-spacing/400");
  const all = rules(run(doc).tokensCss);
  for (const name of dependents) {
    const wrappers = new Set(all.filter(([, sel, body]) => sel === ":root" && declares(body, name)).map(([w]) => w));
    assert.ok(wrappers.size > 0, `${name} is declared nowhere on :root`);
    for (const w of wrappers) {
      const rootValue = declares(all.find(([ww, sel, body]) => ww === w && sel === ":root" && declares(body, name))[2], name);
      const modeRule = all.find(([ww, sel, body]) => ww === w && sel === ATTR && declares(body, name));
      assert.ok(modeRule, `${name} is not re-declared under ${ATTR} inside ${w || "the base scope"}`);
      assert.equal(declares(modeRule[2], name), rootValue, `${name} must keep its alias, resolved where the mode is set`);
      // Same element as :root (the attribute on <html>): the later rule wins ties.
      const order = all.map(([ww, sel]) => `${ww}|${sel}`);
      assert.ok(order.indexOf(`${w}|${ATTR}`) > order.indexOf(`${w}|:root`), `${ATTR} must follow :root in ${w || "the base scope"}`);
    }
  }
});

test("variables that do not depend on a changed variable are not re-declared", () => {
  const { doc } = withMode(docV17c());
  const dependents = new Set(dependentsOf(doc, "letter-spacing/400"));
  const modeBodies = rules(run(doc).tokensCss).filter(([, sel]) => sel === ATTR).map(([, , b]) => b).join("\n");
  const names = [...modeBodies.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
  const tpNames = new Set(doc.collections.find((c) => c.name === "text-primitives").variables.map(webName));
  for (const n of names) assert.ok(tpNames.has(n) || dependents.has(n), `${n} is neither the collection's own nor a dependent`);
});

test("a single-mode export emits exactly what it did before (no mode block, nothing re-declared)", () => {
  const css = run(docV17c()).tokensCss;
  assert.doesNotMatch(css, /data-jhd-text-primitives-mode/);
});

test("every declaration the single-mode export emitted is still emitted unchanged", () => {
  const key = (css) => new Set(rules(css).flatMap(([w, sel, body]) => [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => `${w}|${sel}|${m[1]}|${m[2].trim()}`)));
  const before = key(run(docV17c()).tokensCss);
  const after = key(run(withMode(docV17c()).doc).tokensCss);
  const missing = [...before].filter((k) => !after.has(k));
  assert.deepEqual(missing, []);
});

test("a STRING font-style variable resolves to its numeric weight in every mode, from the export's own style-name table", () => {
  const { doc, strong } = withMode(docV17c());
  const out = run(doc);
  const rows = rules(out.tokensCss);
  const name = webName(strong);
  const base = declares(rows.filter(([w, sel]) => w === "" && sel === ":root").map(([, , b]) => b).join("\n"), name);
  assert.equal(base, strong.fontWeightNumeric.css);
  const modeBody = rows.filter(([w, sel]) => w === "" && sel === ATTR).map(([, , b]) => b).join("\n");
  assert.equal(declares(modeBody, name), "400");
});

test("a mode whose font-style string the export states no number for is left out and warned about, never guessed", () => {
  const { doc, strong } = withMode(docV17c(), { weightRaw: "Hairline" });
  const out = run(doc);
  const modeBody = rules(out.tokensCss).filter(([w, sel]) => w === "" && sel === ATTR).map(([, , b]) => b).join("\n");
  assert.equal(declares(modeBody, webName(strong)), undefined);
  assert.ok(out.warnings.some((w) => w.code === "FONT_WEIGHT_MODE_UNRESOLVED" && w.name === webName(strong)));
});

test("a text style that binds a font-style variable emits font-weight through it, with the numeric as the fallback", () => {
  const { doc, strong } = withMode(docV17c());
  const css = run(doc).stylesCss;
  const bound = doc.styles.TEXT.filter((s) => s.properties.boundVariables?.fontStyle?.id === strong.id);
  assert.ok(bound.length > 0);
  for (const s of bound) {
    const sel = s.cssClass.selector.slice(1);
    const rule = rules(css).find(([, head]) => head === `@utility ${sel}`);
    assert.ok(rule, `${sel} not emitted`);
    assert.equal(declares(rule[2], "font-weight"), `var(${webName(strong)}, ${strong.fontWeightNumeric.css})`);
  }
});
