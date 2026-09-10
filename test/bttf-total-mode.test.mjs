// bttf is a total mode (lock rows 3 & 7): while `.bttf` is on the document
// root, a nested `.dark` (art-direction ground mode) must not re-point
// tokens, and `dark:` utilities must go inert. This resolves the REAL
// shipped CSS (the generated token file plus the hand-authored stylesheet) against a small,
// generic, independently-written CSS cascade resolver (specificity +
// descendant-combinator :is()/:not() matching) — not a re-implementation of
// the generator's own selector-building code, so a regression in either side
// still surfaces here.
import { test } from "node:test";
import assert from "node:assert/strict";

import { expected, handAuthoredCss } from "./fixture.mjs";

// The two halves a consumer actually ships: the generated token file and the
// hand-authored stylesheet whose `.dark` block the total mode has to outrank.
const tokensCss = expected("tokens.generated.css");
const stylesCss = handAuthoredCss();

// --- minimal generic CSS selector matcher (test-only) ----------------------
// Supports what the shipped selectors actually use: `.class`, `*`,
// descendant combinator (space), and `:is(list)` / `:not(list)` evaluated
// against the SAME element per CSS4 semantics. Not tautological: it
// implements general selector-matching rules, not the generator's logic.

function topLevelSplit(str, sep) {
  const parts = [];
  let depth = 0;
  let buf = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && ch === sep) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  parts.push(buf);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function parseComplex(sel) {
  return topLevelSplit(sel, " ");
}

function compoundMatches(compound, el) {
  let i = 0;
  while (i < compound.length) {
    if (compound[i] === "*") {
      i++;
      continue;
    }
    // :root always names the document root element — in this test's element
    // model, the topmost node in the ancestor chain (no parent), whatever
    // classes it carries (an undecorated :root, a `.dark`-classed root, or a
    // `.bttf`-classed root are all still :root).
    if (compound.startsWith(":root", i)) {
      if (el.parent !== null) return false;
      i += 5;
      continue;
    }
    if (compound[i] === ".") {
      const m = /^\.([A-Za-z0-9_-]+)/.exec(compound.slice(i));
      if (!m) throw new Error(`bad class token in ${compound}`);
      if (!el.classes.has(m[1])) return false;
      i += m[0].length;
      continue;
    }
    if (compound.startsWith(":is(", i) || compound.startsWith(":not(", i)) {
      const isNot = compound[i + 1] === "n";
      const open = compound.indexOf("(", i);
      let depth = 1;
      let j = open + 1;
      while (depth > 0) {
        if (compound[j] === "(") depth++;
        if (compound[j] === ")") depth--;
        j++;
      }
      const inner = compound.slice(open + 1, j - 1);
      const anyMatch = topLevelSplit(inner, ",").some((s) => complexMatches(s, el));
      if (isNot ? anyMatch : !anyMatch) return false;
      i = j;
      continue;
    }
    throw new Error(`unrecognized selector token at "${compound.slice(i)}"`);
  }
  return true;
}

function complexMatches(sel, el) {
  const compounds = parseComplex(sel);
  const last = compounds[compounds.length - 1];
  if (!compoundMatches(last, el)) return false;
  if (compounds.length === 1) return true;
  const rest = compounds.slice(0, -1).join(" ");
  let anc = el.parent;
  while (anc) {
    if (complexMatches(rest, anc)) return true;
    anc = anc.parent;
  }
  return false;
}

// Specificity: count of class tokens + pseudo-class tokens at the top level
// (sufficient for the plain-class selectors under test: `:root`, `.dark`,
// `.bttf, .bttf .dark`).
function specificity(sel) {
  return (sel.match(/\.[A-Za-z0-9_-]+/g) || []).length + (sel.match(/:[a-z-]+\(/g) ? 0 : (sel.match(/:root/g) || []).length);
}

function el(classes, parent = null) {
  return { classes: new Set(classes), parent };
}

// --- extract EVERY top-level occurrence of a rule, across BOTH real
// stylesheets (generated + hand-authored) ----------------------------------
// styles.css declares its own global `:root` / `.dark` / `.bttf, .bttf
// .dark` blocks (colour tokens) in addition to tokens.generated.css's — a
// real browser cascades both files together, last declaration of a prop at
// equal specificity wins (tokens.generated.css is @imported first, so its
// declarations are earlier in source order than styles.css's own). Matching
// on `styles.css alone` or `tokens.generated.css alone` is exactly the gap
// reviewer round-1 red 3 flagged: it cannot see a value hand-declared only
// in styles.css's `.dark` block leaking into `.bttf .dark`.
function extractAllBodies(css, re) {
  const bodies = [];
  let m;
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = g.exec(css))) bodies.push(m[1]);
  return bodies;
}

// `:root {` — only the FIRST occurrence in each file carries colour tokens,
// but concatenating every occurrence (source order) is still correct: later
// bodies simply don't redeclare the colour props under test, and declValue
// below takes the LAST declaration of a prop, matching cascade semantics.
const rootRe = /(?:^|\n):root\s*\{([^}]*)\}/gs;
const darkRe = /(?:^|\n)\.dark\s*\{([^}]*)\}/gs;
const bttfRe = /(?:^|\n)\.bttf\s*,\s*\n?\s*\.bttf \.dark\s*,\s*\n?\s*\.bttf\.dark\s*\{([^}]*)\}/gs;

const rootBody = [...extractAllBodies(tokensCss, rootRe), ...extractAllBodies(stylesCss, rootRe)].join("\n");
const darkBody = [...extractAllBodies(tokensCss, darkRe), ...extractAllBodies(stylesCss, darkRe)].join("\n");
const bttfBody = [...extractAllBodies(tokensCss, bttfRe), ...extractAllBodies(stylesCss, bttfRe)].join("\n");

// Cascade tie-break: same selector, same specificity, later declaration in
// source order wins — so take the LAST match of `prop:` in the merged body,
// not the first.
function declValue(body, prop) {
  const re = new RegExp(`(?:^|;|\\n|\\{)\\s*${prop.replace(/-/g, "\\-")}:\\s*([^;]+);`, "gm");
  let m;
  let last = null;
  while ((m = re.exec(body))) last = m[1].trim();
  return last;
}

test("the generated bttf rule is selected by `.bttf, .bttf .dark, .bttf.dark`", () => {
  assert.ok(bttfBody.trim(), "expected a `.bttf, .bttf .dark, .bttf.dark` rule in tokens.generated.css or styles.css");
});

// Resolve a custom property for an element against the three real rules,
// each carrying its own selector list (comma-separated) and specificity,
// mirroring what a browser does: highest specificity among matching rules
// wins.
function resolve(prop, targetEl) {
  const rules = [
    { selectors: [":root"], body: rootBody },
    { selectors: [".dark"], body: darkBody },
    { selectors: [".bttf", ".bttf .dark", ".bttf.dark"], body: bttfBody },
  ];
  let best = null;
  for (const rule of rules) {
    const value = declValue(rule.body, prop);
    if (value == null) continue;
    for (const sel of rule.selectors) {
      if (!complexMatches(sel, targetEl)) continue;
      const spec = specificity(sel);
      if (!best || spec >= best.spec) best = { spec, value };
    }
  }
  return best?.value ?? null;
}

// --- the 11 tokens reviewer round-1 red 1 flagged as leaking under
// `.bttf .dark` ------------------------------------------------------------
const RED1_TOKENS = [
  "--background-default-primary",
  "--background-default-secondary",
  "--background-default-tertiary",
  "--content-default-primary",
  "--content-default-secondary",
  "--border-default-primary",
  "--state-focused",
  "--state-negative",
  "--state-positive",
  "--state-warning",
  "--brand",
];

for (const prop of RED1_TOKENS) {
  test(`${prop}: resolves to the bttf value under .bttf .dark, and to the dark value under .dark alone`, () => {
    const bttfValue = declValue(bttfBody, prop);
    const darkValue = declValue(darkBody, prop);
    assert.ok(bttfValue, `expected ${prop} in a rule matching .bttf .dark (generated or hand-authored)`);
    assert.ok(darkValue, `expected ${prop} in a rule matching .dark`);

    const root = el(["bttf"]);
    const nestedDark = el(["dark"], root);
    assert.equal(resolve(prop, nestedDark), bttfValue, `${prop} must resolve to the bttf value under .bttf .dark`);

    const darkAlone = el(["dark"]);
    assert.equal(resolve(prop, darkAlone), darkValue, `${prop} must still resolve to the dark value under .dark alone`);

    // reviewer round-2 amber 1: class="bttf dark" on the SAME element must
    // also resolve to bttf, not dark.
    const sameElement = el(["bttf", "dark"]);
    assert.equal(resolve(prop, sameElement), bttfValue, `${prop} must resolve to the bttf value on an element carrying both .bttf and .dark`);
  });
}

for (const prop of ["--background-action-primary", "--content-action-primary"]) {
  test(`${prop}: resolves to the bttf value under .bttf .dark, and to the dark value under .dark alone`, () => {
    const bttfValue = declValue(bttfBody, prop);
    const darkValue = declValue(darkBody, prop);
    assert.ok(bttfValue, `expected ${prop} in the generated bttf rule`);
    assert.ok(darkValue, `expected ${prop} in the generated dark rule`);
    assert.notEqual(bttfValue, darkValue, "fixture must actually differ between modes to prove the win");

    const root = el(["bttf"]);
    const nestedDark = el(["dark"], root);
    assert.equal(resolve(prop, nestedDark), bttfValue);

    const darkAlone = el(["dark"]);
    assert.equal(resolve(prop, darkAlone), darkValue);

    const sameElement = el(["bttf", "dark"]);
    assert.equal(resolve(prop, sameElement), bttfValue, `${prop} must resolve to the bttf value on an element carrying both .bttf and .dark`);
  });
}

// --- the `dark:` custom variant goes inert under `.bttf` --------------------

function extractVariantIsArg(css) {
  const marker = "@custom-variant dark (&:is(";
  const start = css.indexOf(marker);
  if (start === -1) return null;
  const argStart = start + marker.length;
  let depth = 1;
  let j = argStart;
  while (depth > 0) {
    if (css[j] === "(") depth++;
    if (css[j] === ")") depth--;
    j++;
  }
  return css.slice(argStart, j - 1);
}

// --- guard: every token the hand-authored `.dark` block declares must also
// be declared somewhere a `.bttf .dark` element matches (generated bttf
// block or styles.css's own `.bttf, .bttf .dark` block) — otherwise it's a
// new red-1-shaped leak by construction, whatever the specificity says. ----
function declaredProps(body) {
  const re = /(?:^|;|\n|\{)\s*(--[A-Za-z0-9-]+):/g;
  const names = new Set();
  let m;
  while ((m = re.exec(body))) names.add(m[1]);
  return names;
}

test("every token in the hand-authored .dark block is also declared under .bttf, .bttf .dark", () => {
  const stylesDarkBody = extractAllBodies(stylesCss, darkRe).join("\n");
  const darkOnlyProps = declaredProps(stylesDarkBody);
  assert.ok(darkOnlyProps.size > 0, "expected the hand-authored .dark block to declare at least one token");

  const bttfProps = declaredProps(bttfBody);
  const leaking = [...darkOnlyProps].filter((p) => !bttfProps.has(p));
  assert.deepEqual(leaking, [], `these hand-authored .dark tokens are not mirrored under .bttf, .bttf .dark: ${leaking.join(", ")}`);
});

const variantInner = extractVariantIsArg(stylesCss);

test("dark: utilities do not apply under .bttf", () => {
  assert.ok(variantInner, "expected `@custom-variant dark (&:is(...))` in styles.css");
  const inner = variantInner; // e.g. .dark:not(.bttf, .bttf *) *

  const darkAlone = el(["dark"]);
  const target1 = el([], darkAlone);
  assert.equal(complexMatches(inner, target1), true, "dark: should still apply under plain .dark");

  const bttfRoot = el(["bttf"]);
  const nestedDark = el(["dark"], bttfRoot);
  const target2 = el([], nestedDark);
  assert.equal(complexMatches(inner, target2), false, "dark: must not apply under .bttf");
});
