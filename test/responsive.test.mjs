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
import { classify, honours } from "../src/responsive.mjs";
import { config, doc as exportDoc, docV7c, handAuthoredCss, preset } from "./fixture.mjs";

/**
 * The house preset, plus the deletion jhd-design-system makes in the same
 * release: `styles.css` hand-authors `--screen-height-*` / `--height-screen-*`
 * today (lines ~781-798), and a hand-authored GLOBAL declaration suppresses
 * generation (P2) and collides with the alias block (P12). Removing those
 * lines here is what the consumer does when it adopts 0.2.0.
 */
const consumerCss = () =>
  handAuthoredCss()
    .split("\n")
    .filter((l) => !/^\s*--(?:screen-height|height-screen)-[a-z0-9]+:/.test(l))
    .join("\n");

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

// --- the report -------------------------------------------------------------

test("§10 states each variable's class, where the class came from, and the effect", () => {
  const { report } = emit(exportDoc());
  const section = report.slice(report.indexOf("## 10. Responsive classes"),
                              report.indexOf("## Appendix A —"));
  assert.match(section, /Honoured this run: `viewport-height`, `viewport-width`\./);
  assert.match(section,
    /\| `--device-screen-height-100` \| layout \| viewport-height \| description \| 20dvh once on the base scope \|/);
  assert.match(section, /\| `VIEWPORT_UNFLAGGED` \| `--device-width` \|/);
});
