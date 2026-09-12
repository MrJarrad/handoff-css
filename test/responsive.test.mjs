// Policy P11 — the responsive classes, and the 0.2.0 behavioural change they
// carry: a variable whose size is a fraction of the screen is emitted ONCE, in
// viewport units, instead of as four per-breakpoint pixel samples.
//
// Two real exports of the same design system are the fixtures. `jhd-v7b` has
// the fraction stated on `device/screen-height/100`…`700` only; `jhd-v7c`
// (re-exported after the operator filled three blank descriptions) also has it
// on `screen-height/full`, and has a WRONG one on `device/width`. Both cases
// are asserted: the generator honours what the export says, and reports what
// the export does not say. It never guesses a unit.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { classify, honours, percentFromFraction, VIEWPORT_FRACTION_TOLERANCE } from "../src/responsive.mjs";
import { config, consumerCss, doc as exportDoc, docV7c, docV8b, docV9b, preset } from "./fixture.mjs";

const emit = (doc, cfg = preset) => generate(doc, cfg, { handAuthoredCss: consumerCss() });

/** Every line declaring `name`, trimmed, in source order. */
const declarations = (css, name) =>
  css.split("\n").map((l) => l.trim()).filter((l) => l.startsWith(`${name}:`));

/** The `@media` blocks' contents, so "not in any media block" is checkable. */
const insideMedia = (css, name) => {
  let depth = 0;
  let inMedia = false;
  const hits = [];
  for (const line of css.split("\n")) {
    if (line.startsWith("@media")) { inMedia = true; depth = 0; }
    if (inMedia && line.trim().startsWith(`${name}:`)) hits.push(line.trim());
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (inMedia && depth <= 0) inMedia = false;
  }
  return hits;
};

// --- the viewport rule -----------------------------------------------------

test("a stated screen-height fraction is emitted once, in dvh, on the base scope", () => {
  const { tokensCss } = emit(exportDoc());
  for (const [leaf, value] of [
    ["100", "20dvh"], ["200", "30dvh"], ["300", "40dvh"], ["400", "50dvh"],
    ["500", "70dvh"], ["600", "80dvh"], ["700", "90dvh"],
  ]) {
    const name = `--device-screen-height-${leaf}`;
    assert.deepEqual(declarations(tokensCss, name), [`${name}: ${value};`],
      `${name} must be declared exactly once, as ${value}`);
    assert.deepEqual(insideMedia(tokensCss, name), [],
      `${name} must not appear in any @media block`);
  }
});

test("the per-breakpoint px samples of a viewport variable are dropped, not kept alongside", () => {
  // 10 layout modes, 11 placements: the narrowest default-variant mode seeds
  // the unconditional base AND keeps its own media block (P6).
  const pinned = generate(exportDoc(), config, { handAuthoredCss: consumerCss() });
  assert.equal(declarations(pinned.tokensCss, "--device-screen-height-100").length, 11);
  assert.match(pinned.tokensCss, /--device-screen-height-100: 162\.399994px;/);

  const { tokensCss } = emit(exportDoc());
  assert.equal(declarations(tokensCss, "--device-screen-height-100").length, 1);
  assert.doesNotMatch(tokensCss, /--device-screen-height-100: 162\.399994px;/);
});

test("a viewport-relative variable with no stated fraction stays px and is reported", () => {
  // v7b has a BLANK description on both, so there is nothing to honour.
  const out = emit(exportDoc());
  for (const name of ["--device-screen-height-full", "--device-width"]) {
    assert.ok(declarations(out.tokensCss, name).length > 1, `${name} keeps its per-mode samples`);
    assert.ok(out.warnings.some((w) => w.code === "VIEWPORT_UNFLAGGED" && w.name === name),
      `${name} must be reported as VIEWPORT_UNFLAGGED`);
  }
  assert.match(out.report, /VIEWPORT_UNFLAGGED/);
});

test("a viewport-group member that is genuinely fixed is left exactly as it was", () => {
  const pinned = generate(exportDoc(), config, { handAuthoredCss: consumerCss() });
  const out = emit(exportDoc());
  const name = "--device-container-max-width";
  assert.deepEqual(declarations(out.tokensCss, name), declarations(pinned.tokensCss, name));
  assert.deepEqual(new Set(declarations(out.tokensCss, name)), new Set([`${name}: 2156px;`]));
});

test("`viewport.groups` is what makes an unstated fraction a warning at all", () => {
  const cfg = { ...preset, viewport: { ...preset.viewport, groups: [] } };
  const out = emit(exportDoc(), cfg);
  assert.deepEqual(out.warnings.filter((w) => w.code === "VIEWPORT_UNFLAGGED"), []);
  // …and the stated fractions are still honoured: the group list reports the
  // silence, it does not authorise the emission.
  assert.deepEqual(declarations(out.tokensCss, "--device-screen-height-100"),
    ["--device-screen-height-100: 20dvh;"]);
});

test("`responsive.honourClasses` pins the output: drop the class, keep the px", () => {
  const cfg = { ...preset, responsive: { honourClasses: ["viewport-width"] } };
  const out = emit(exportDoc(), cfg);
  assert.equal(declarations(out.tokensCss, "--device-screen-height-100").length, 11);
  assert.equal(honours(cfg, "viewport-height"), false);
});

// --- the description convention --------------------------------------------

test("the description convention beats the export's own `mode-stepped` strategy", () => {
  // Both signals are present on every screen-height variable: the
  // responsiveBehavior rules say `mode-stepped` (they ARE four samples), while
  // the description states the fraction those samples are samples of. Only the
  // fraction can be emitted as one declaration that holds at every viewport.
  const v = exportDoc().collections
    .find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/screen-height/100");
  assert.equal(v.responsiveBehavior.rules[0].strategy, "mode-stepped");
  assert.equal(v.description, "20% of screen height");
  const c = classify(v, preset);
  assert.equal(c.cls, "viewport-height");
  assert.equal(c.source, "description");
  assert.equal(c.value, "20dvh");
  assert.equal(c.warning, null);
  assert.equal(c.rules.get("default").cls, "mode-stepped");
});

test("the convention is anchored — prose that merely mentions a percentage is not a signal", () => {
  const doc = exportDoc();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/screen-height/100");
  v.description = "roughly 20% of screen height on mobile";
  assert.equal(classify(v, preset).cls, "mode-stepped");
  assert.equal(declarations(emit(doc).tokensCss, "--device-screen-height-100").length, 11);
});

test("`viewport.descriptionFallback: false` turns the convention off", () => {
  const cfg = { ...preset, viewport: { ...preset.viewport, descriptionFallback: false } };
  assert.equal(declarations(emit(exportDoc(), cfg).tokensCss, "--device-screen-height-100").length, 11);
});

test("a wrong description yields a wrong token — the generator does not second-guess it", () => {
  // `device/width` is full-bleed; the 2026-09-10 export describes it as "20% of
  // screen width", which the operator is correcting in Figma. handoff-css
  // emits 20vw: the export is the contract, and a plausibility heuristic here
  // would make it stop being one. The report's §10 names the source.
  const out = emit(docV7c());
  assert.deepEqual(declarations(out.tokensCss, "--device-width"), ["--device-width: 20vw;"]);
  assert.match(out.report, /\| `--device-width` \| layout \| viewport-width \| description \|/);
});

test("the second export's filled-in description gives `screen-height/full: 100dvh`", () => {
  const out = emit(docV7c());
  assert.deepEqual(declarations(out.tokensCss, "--device-screen-height-full"),
    ["--device-screen-height-full: 100dvh;"]);
  assert.deepEqual(insideMedia(out.tokensCss, "--device-screen-height-full"), []);
  assert.deepEqual(out.warnings.filter((w) => w.code === "VIEWPORT_UNFLAGGED").map((w) => w.name),
    ["--device-container-max-width"]);
});

// --- the explicit field (schema 9's ask) -----------------------------------

test("an explicit `responsive` field wins over a description, and needs no description", () => {
  const doc = docV7c();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/width");
  v.responsive = { kind: "viewport", viewport: { axis: "width", fraction: 1 } };
  const out = emit(doc);
  assert.deepEqual(declarations(out.tokensCss, "--device-width"), ["--device-width: 100vw;"]);
  assert.match(out.report, /\| `--device-width` \| layout \| viewport-width \| field \|/);
});

test("a `responsive` field naming a plain class overrides the export's per-variant rules", () => {
  const doc = exportDoc();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/container-max-width");
  v.responsive = { strategy: "fixed" };
  const cfg = { ...preset, responsive: { honourClasses: ["fixed"] } };
  // One declaration per layout variant: `:root` plus the three variant
  // selectors, instead of eleven placements.
  assert.equal(declarations(emit(doc, cfg).tokensCss, "--device-container-max-width").length, 4);
});

test("a `responsive` block this version half-understands stops the run", () => {
  const doc = exportDoc();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/width");
  for (const [block, message] of [
    [{ kind: "viewport", viewport: { axis: "diagonal", fraction: 1 } }, /axis is "diagonal"/],
    [{ kind: "viewport", viewport: { axis: "width" } }, /fraction is undefined/],
    [{ kind: "viewport-height" }, /carries no fraction/],
    [{ kind: "elastic" }, /unrecognised responsive block/],
  ]) {
    v.responsive = block;
    assert.throws(() => emit(doc), message);
  }
});

// --- fluid-clamp and fixed --------------------------------------------------

test("an honoured `fluid-clamp` emits the export's own clamp() once per layout variant", () => {
  const cfg = { ...preset, responsive: { honourClasses: ["fluid-clamp"] } };
  const doc = exportDoc();
  const rule = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "grid/col-span/col-span-1")
    .responsiveBehavior.rules.find((r) => r.layoutVariant === "flush");
  assert.equal(rule.strategy, "fluid-clamp");

  const { tokensCss } = emit(doc, cfg);
  const lines = declarations(tokensCss, "--grid-col-span-1");
  // The default variant is still `mode-stepped`, so its media samples stay;
  // the flush variant collapses to the one clamp the export published.
  assert.ok(lines.includes(`--grid-col-span-1: ${rule.css};`), lines.join(" | "));
  assert.equal(lines.filter((l) => l.includes("clamp(")).length, 1);
  assert.match(tokensCss, /\[data-jhd-layout-variant="flush"\] \{\n {2}--grid-col-span-1: clamp\(/);
});

test("a `fluid-clamp` with no expression falls back to the samples and says so", () => {
  const cfg = { ...preset, responsive: { honourClasses: ["fluid-clamp"] } };
  const doc = exportDoc();
  const rule = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "grid/col-span/col-span-1")
    .responsiveBehavior.rules.find((r) => r.layoutVariant === "flush");
  delete rule.css;

  const out = emit(doc, cfg);
  assert.doesNotMatch(out.tokensCss, /--grid-col-span-1: clamp\(/);
  assert.ok(out.warnings.some(
    (w) => w.code === "CLAMP_WITHOUT_EXPRESSION" && w.name === "--grid-col-span-1"));
});

test("an honoured `fixed` collapses ten equal declarations into one", () => {
  const cfg = { ...preset, responsive: { honourClasses: ["fixed"] } };
  const pinned = generate(exportDoc(), config, { handAuthoredCss: consumerCss() });
  assert.equal(declarations(pinned.tokensCss, "--grid-columns").length, 11);
  // `fixed` is per layout VARIANT, as the export publishes it: one declaration
  // each for default, flush, sidebar-main and sidebar-main-flush.
  assert.deepEqual(declarations(emit(exportDoc(), cfg).tokensCss, "--grid-columns"),
    Array.from({ length: 4 }, () => "--grid-columns: 12;"));
});

test("a `fixed` whose modes disagree is not collapsed — the export is wrong, not the samples", () => {
  const cfg = { ...preset, responsive: { honourClasses: ["fixed"] } };
  const doc = exportDoc();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "grid/columns");
  const mode = v.modes.find((m) => m.modeId === "26:1");
  mode.raw = 6;
  mode.build.raw = 6;
  mode.build.value = 6;
  mode.build.css = "6";

  const out = emit(doc, cfg);
  // The default variant keeps all five of its placements (four modes, the
  // narrowest also seeding the base); the three variants that DO agree still
  // collapse to one each.
  assert.equal(declarations(out.tokensCss, "--grid-columns").length, 8);
  assert.match(out.tokensCss, /--grid-columns: 6;/);
  assert.ok(out.warnings.some(
    (w) => w.code === "FIXED_VARIES_BY_MODE" && w.name === "--grid-columns"));
});

// --- responsiveBehavior[].viewportFraction (P13, Workstream C) -------------
//
// `fixtures/jhd-v8b-2026-09-10` is a real export whose plugin now emits
// `viewportFraction` directly on every `responsiveBehavior` rule, alongside
// `strategy` and `css`. It carries no `responsive` field and every viewport
// variable's description agrees with the rule fraction (within tolerance) —
// so this is the fixture for the new "rule" source, not for the description
// path, which `docV7c`/`exportDoc` already cover.

test("a viewportFraction on responsiveBehavior is honoured, once, on jhd-v8b", () => {
  const { tokensCss, untrustedRows } = emit(docV8b());
  for (const [name, value] of [
    ["--device-screen-height-100", "20dvh"],
    ["--device-screen-height-200", "30dvh"],
    ["--device-screen-height-500", "70dvh"],
    ["--device-screen-height-700", "90dvh"],
    ["--device-screen-height-full", "100dvh"],
    ["--device-width", "100vw"],
  ]) {
    assert.deepEqual(declarations(tokensCss, name), [`${name}: ${value};`], name);
    assert.deepEqual(insideMedia(tokensCss, name), [], name);
  }
  // 0.3.1 — v8b is the FIRST export to state `fixed` on this token's rule, so
  // it collapses here too: eleven identical samples became one declaration,
  // and its `VIEWPORT_UNFLAGGED` went quiet because the export answered.
  assert.deepEqual(declarations(tokensCss, "--device-container-max-width"),
    ["--device-container-max-width: 2156px;"]);
  assert.equal(untrustedRows.length, 0, "§10 untrusted cells must be 0 on this export");
});

test("a rule fraction close to its description (0.300493 vs 30%) is within tolerance — no disagreement", () => {
  const doc = docV8b();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/screen-height/200");
  assert.equal(v.responsiveBehavior.rules[0].viewportFraction, 0.300493);
  assert.equal(v.description, "30% of screen height");
  const c = classify(v, preset);
  assert.equal(c.source, "description");
  assert.equal(c.value, "30dvh");
  assert.equal(c.warning, null);
});

test("a rule fraction with no description at all is used, as the `rule` source", () => {
  const doc = docV8b();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/screen-height/100");
  v.description = "";
  // Only the rule states a fraction now: 0.22.
  for (const r of v.responsiveBehavior.rules) {
    if (r.strategy === "viewport-height") { r.viewportFraction = 0.22; r.css = "22dvh"; }
  }
  const c = classify(v, preset);
  assert.equal(c.cls, "viewport-height");
  assert.equal(c.source, "rule");
  assert.equal(c.value, "22dvh");
  assert.equal(c.warning, null);
  const { tokensCss } = emit(doc);
  assert.deepEqual(declarations(tokensCss, "--device-screen-height-100"),
    ["--device-screen-height-100: 22dvh;"]);
});

test("a rule fraction that disagrees with the description by more than 0.005 yields the description, and a warning naming both", () => {
  // Export 4's `screen-height/100` carried a wrong rule fraction (0.222161)
  // alongside a correct "20% of screen height" description.
  const doc = docV8b();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/screen-height/100");
  for (const r of v.responsiveBehavior.rules) {
    if (r.strategy === "viewport-height") r.viewportFraction = 0.222161;
  }
  const c = classify(v, preset);
  assert.equal(c.source, "description");
  assert.equal(c.value, "20dvh");
  assert.equal(c.warning, "VIEWPORT_FRACTION_DISAGREES");
  assert.deepEqual(c.fractionDisagree, { rule: 0.222161, description: 0.2 });

  const out = emit(doc);
  assert.deepEqual(declarations(out.tokensCss, "--device-screen-height-100"),
    ["--device-screen-height-100: 20dvh;"]);
  const w = out.warnings.find((x) => x.code === "VIEWPORT_FRACTION_DISAGREES");
  assert.ok(w, "the warning must be reported");
  assert.equal(w.name, "--device-screen-height-100");
  assert.match(w.detail, /22\.2161%/);
  assert.match(w.detail, /20%/);
});

// --- the report -------------------------------------------------------------

test("§10 states each variable's class, where the class came from, and the effect", () => {
  const { report } = emit(exportDoc());
  const section = report.slice(report.indexOf("## 10. Responsive classes"),
                              report.indexOf("## Appendix A —"));
  assert.match(section,
    /Honoured this run: `viewport-height`, `viewport-width`, `fluid-clamp`, `fixed`\./);
  assert.match(section,
    /\| `--device-screen-height-100` \| layout \| viewport-height \| description \| 20dvh once on the base scope \|/);
  assert.match(section, /\| `VIEWPORT_UNFLAGGED` \| `--device-width` \|/);
  // 0.4.2 — the house preset honours `fluid-clamp` and `fixed`: the plugin's
  // own rule is followed exactly, per layout variant, not held.
  assert.match(section, /\| `--grid-columns` \| layout \| fixed \| export \| fixed once per layout variant \|/);
  assert.match(section,
    /\| `--grid-col-start-2` \| layout \| fluid-clamp \| export \| fluid-clamp once per layout variant \|/);
});

// --- P11, the group gate ----------------------------------------------------
//
// `viewport.groups` is the consumer's declaration of WHICH variables may
// become viewport units at all — not merely which ones get a warning when they
// don't. The v8b export states a `viewportFraction` on 20-odd rules that are
// not fractions of the screen in any design sense: a title letter-spacing, a
// body font size, an icon radius, a grid column start. Honouring those turns
// type into viewport-scaled type, which no house policy ever asked for.
//
// So a rule fraction outside every declared group is a HINT, treated exactly
// as a bare class is: keep the per-mode px samples, and report it. The
// description and field paths are gated the same way, for the same reason —
// one gate, not three, or a filled-in description on a text variable would
// walk straight through the one path nobody remembered to close.

const namesIn = (css, prefix) =>
  css.split("\n").map((l) => l.trim())
    .filter((l) => l.startsWith(prefix))
    .map((l) => l.split(":")[0]);

test("a rule fraction outside every `viewport.groups` prefix does not become a viewport unit", () => {
  const { tokensCss } = emit(docV8b());

  // These four are the export's own viewport-classed rules on variables the
  // house never declared viewport-relative. Each keeps px/rem samples.
  for (const name of [
    "--text-title-font-size-100",
    "--text-title-letter-spacing-400",
    "--icon-radius-100",
    "--grid-col-start-2",
  ]) {
    const decls = declarations(tokensCss, name);
    assert.ok(decls.length > 0, `${name} must still be emitted`);
    for (const d of decls) {
      assert.doesNotMatch(d, /\d(dvh|vh|vw|dvw)\s*;/, `${name} must not carry a viewport unit: ${d}`);
    }
  }

  // And the gate is stated as a whole, not spot-checked: the ONLY tokens in
  // the shipped output carrying a viewport unit are the ten `--device-*` ones
  // the house declared, plus the aliases that point at them.
  const viewportNames = tokensCss.split("\n").map((l) => l.trim())
    .filter((l) => /^--[a-z0-9-]+:\s*[\d.]+(dvh|vh|vw|dvw)\s*;/.test(l))
    .map((l) => l.split(":")[0]);
  assert.deepEqual([...new Set(viewportNames)].sort(), [
    "--device-screen-height-100",
    "--device-screen-height-200",
    "--device-screen-height-300",
    "--device-screen-height-400",
    "--device-screen-height-500",
    "--device-screen-height-600",
    "--device-screen-height-700",
    "--device-screen-height-full",
    "--device-width",
  ]);
  assert.equal(namesIn(tokensCss, "--device-container-max-width").length > 0, true);
});

test("the gate is the group, not the source: a description outside the groups is a hint too", () => {
  const doc = docV8b();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "text/title/font-size-100");
  assert.ok(v, "the fixture must have layout/text/title/font-size-100");
  v.description = "100% of screen height";
  const c = classify(v, preset);
  assert.notEqual(c.source, "description");
  assert.equal(c.value, null);
  assert.equal(c.warning, "VIEWPORT_OUTSIDE_GROUPS");
});

test("a consumer that declares no groups is not gated — every stated fraction is honoured", () => {
  const cfg = { ...preset, viewport: { ...preset.viewport, groups: [] } };
  const { tokensCss, warnings } = generate(docV8b(), cfg, { handAuthoredCss: consumerCss() });
  // P15 — the export's 1.7241% is a DERIVED fraction no whole percent is within
  // tolerance of (the memo's own example: a title font size that is `16` in
  // Figma). It is emitted at three decimals and flagged, never rounded to 2%.
  assert.deepEqual(declarations(tokensCss, "--text-title-font-size-100"),
    ["--text-title-font-size-100: 1.724dvh;"]);
  const flagged = warnings.filter((w) => w.code === "VIEWPORT_FRACTION_UNROUNDED");
  assert.ok(flagged.some((w) => w.name === "--text-title-font-size-100"),
    "the unrounded fraction must be named in validation");
});

test("§10 reports each gated variable, so a mis-stated fraction in Figma is visible", () => {
  const { report, warnings } = emit(docV8b());
  const gated = warnings.filter((w) => w.code === "VIEWPORT_OUTSIDE_GROUPS");
  assert.ok(gated.length >= 4, `expected the gated rules to be reported, got ${gated.length}`);
  assert.ok(gated.some((w) => w.name === "--text-title-font-size-100"));
  assert.match(report, /VIEWPORT_OUTSIDE_GROUPS/);
});

// --- P15, the rounding ruling ---------------------------------------------
// Memo `2026-09-10-handoff-viewport-tokens-brief`, Addendum 2 (2026-09-11):
// the export never states a value that was not input into Figma, so a DERIVED
// fraction rounds back to the whole percent the designer typed — and says so
// when it cannot.

test("percentFromFraction rounds a derived fraction back to the designer's whole percent", () => {
  // The ruling's own numbers: 244/812, 568/812, 731/812.
  assert.deepEqual(percentFromFraction(244 / 812), { value: "30", rounded: true });
  assert.deepEqual(percentFromFraction(568 / 812), { value: "70", rounded: true });
  assert.deepEqual(percentFromFraction(731 / 812), { value: "90", rounded: true });
  assert.equal(VIEWPORT_FRACTION_TOLERANCE, 0.005);
});

test("percentFromFraction keeps three decimals when no whole percent is within tolerance", () => {
  assert.deepEqual(percentFromFraction(0.3125), { value: "31.25", rounded: false });
  assert.deepEqual(percentFromFraction(0.017241), { value: "1.724", rounded: false });
});

test("a derived fraction from the export's own rule rounds, with no warning", () => {
  const doc = docV8b();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/screen-height/100");
  v.description = "";
  for (const r of v.responsiveBehavior.rules) {
    if (r.strategy === "viewport-height") r.viewportFraction = 244 / 812;
  }
  const c = classify(v, preset);
  assert.equal(c.source, "rule");
  assert.equal(c.value, "30dvh");
  assert.equal(c.warning, null);
});

test("a rule fraction no whole percent is close to keeps three decimals and warns", () => {
  const doc = docV8b();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/screen-height/100");
  v.description = "";
  for (const r of v.responsiveBehavior.rules) {
    if (r.strategy === "viewport-height") r.viewportFraction = 0.3125;
  }
  const c = classify(v, preset);
  assert.equal(c.value, "31.25dvh");
  assert.equal(c.warning, "VIEWPORT_FRACTION_UNROUNDED");

  const { tokensCss, warnings } = emit(doc);
  assert.deepEqual(declarations(tokensCss, "--device-screen-height-100"),
    ["--device-screen-height-100: 31.25dvh;"]);
  const w = warnings.find((x) => x.code === "VIEWPORT_FRACTION_UNROUNDED");
  assert.equal(w.name, "--device-screen-height-100");
  assert.match(w.detail, /0\.3125/);
});

test("an explicit `responsive` field fraction rounds the same way, and warns the same way", () => {
  const doc = docV8b();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/screen-height/100");
  v.responsive = { kind: "viewport", viewport: { axis: "height", fraction: 244 / 812 } };
  assert.equal(classify(v, preset).value, "30dvh");
  assert.equal(classify(v, preset).warning, null);

  v.responsive = { kind: "viewport", viewport: { axis: "height", fraction: 0.3125 } };
  const c = classify(v, preset);
  assert.equal(c.value, "31.25dvh");
  assert.equal(c.warning, "VIEWPORT_FRACTION_UNROUNDED");
});

test("the description path is untouched by rounding — a stated percent is emitted verbatim", () => {
  const doc = docV8b();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/screen-height/100");
  v.description = "20.5% of screen height";
  const c = classify(v, preset);
  assert.equal(c.source, "description");
  assert.equal(c.value, "20.5dvh");
  assert.equal(c.warning, null);
});

// --- P11's third silencing source: a rule-level `fixed` (0.3.1) ------------
//
// `device/container-max-width` is the token schema 9 still could not classify:
// it sits in the declared `device/` group, so the generator asked for a
// fraction and got silence (`VIEWPORT_UNFLAGGED`). The v9b export answers the
// question instead of filling in a fraction it does not have — every
// `responsiveBehavior` rule states `strategy: "fixed"` — which is the memo's
// (`2026-09-10-handoff-viewport-tokens-brief`, addendum 1) "`fixed` -> one
// value", and is a THIRD way the warning goes quiet.

test("every rule stating `fixed` classifies the variable fixed, not unflagged", () => {
  const v = docV9b().collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/container-max-width");
  const resp = classify(v, preset);
  assert.equal(resp.cls, "fixed");
  assert.equal(resp.source, "rule");
  assert.equal(resp.warning, null);
});

test("a rule-level `fixed` emits ONE declaration, on the base scope, at the export's own css", () => {
  const out = emit(docV9b());
  const name = "--device-container-max-width";
  // `2156px` is the export's own build cell for every one of the ten layout
  // modes (`build.css`), not a number recomputed here.
  assert.deepEqual(declarations(out.tokensCss, name), [`${name}: 2156px;`]);
  assert.deepEqual(insideMedia(out.tokensCss, name), []);
  assert.deepEqual(out.warnings.filter((w) => w.name === name), []);
  assert.match(out.report, /\| `--device-container-max-width` \| layout \| fixed \| rule \|/);
});

test("a rule-level `fixed` whose modes disagree still raises FIXED_VARIES_BY_MODE", () => {
  // The same v9b export with ONE mode's build cell moved off 2156px: the
  // export's claim is now false, so nothing is collapsed and the samples stand.
  const doc = docV9b();
  const v = doc.collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/container-max-width");
  const mv = v.modes.find((m) => m.modeName === "md");
  mv.raw = 1200;
  mv.build = { ...mv.build, raw: 1200, value: 1200, css: "1200px" };
  mv.unitHint = { ...mv.unitHint, rawValue: 1200, convertedValue: 1200 };

  const out = emit(doc);
  const name = "--device-container-max-width";
  assert.ok(declarations(out.tokensCss, name).length > 1, "the per-mode samples are emitted instead");
  assert.deepEqual(out.warnings.filter((w) => w.name === name).map((w) => w.code),
    ["FIXED_VARIES_BY_MODE"]);
});

test("a declared viewport-group variable with NO rules is still VIEWPORT_UNFLAGGED", () => {
  // The silencing source is the export STATING `fixed`, not the absence of a
  // fraction: v7b publishes no `responsiveBehavior` at all for this token.
  const v = exportDoc().collections.find((c) => c.name === "layout").variables
    .find((x) => x.name === "device/container-max-width");
  assert.deepEqual(v.responsiveBehavior?.rules ?? [], []);
  assert.equal(classify(v, preset).warning, "VIEWPORT_UNFLAGGED");
});
