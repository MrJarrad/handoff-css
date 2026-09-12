// P20 — ASPECT RATIOS, as the design system authors them from export v11:
// `core/aspect/{landscape, portrait, square, tall}` are STRING variables
// holding "3:2" / "4:5" / "1:1" / "2:3", with their own `--aspect-<name>` WEB
// names. Nothing is derived — the one job is rendering `a:b` as the CSS ratio
// `a / b`, because `aspect-ratio: "3:2"` is not a value CSS accepts.
//
// The expected ratios are literals read off the export's own STRING values and
// off `2026-09-12-motion-token-naming.md`, which are also what this consumer's
// stylesheet has declared by hand since before the variables existed — three
// sources that agree, which is what the MATCH rows record.
import { test } from "node:test";
import assert from "node:assert/strict";

import { aspectDescriptionFindings, isRatioVariable, ratioValue } from "../src/aspect.mjs";
import { generate } from "../src/index.mjs";
import { consumerConfig040, consumerCss, consumerCss040, docV10, preset } from "./fixture.mjs";

const out = generate(docV10(), consumerConfig040, { handAuthoredCss: consumerCss() });

// `consumerCss040` is the consumer's stylesheet after the deletion adopting
// 0.4.0 requires — see its note in `fixture.mjs`.
const adopted = generate(docV10(), consumerConfig040, { handAuthoredCss: consumerCss040() });

const declarations = (css) => {
  const found = new Map();
  for (const line of css.split("\n")) {
    const m = /^\s*(--[a-z0-9-]+):\s*([^;]+);/.exec(line);
    if (m && !found.has(m[1])) found.set(m[1], m[2].trim());
  }
  return found;
};

// --- the four authored ratios ----------------------------------------------

const RATIOS = [
  ["--aspect-landscape", "3:2", "3 / 2"],
  ["--aspect-portrait", "4:5", "4 / 5"],
  ["--aspect-square", "1:1", "1 / 1"],
  ["--aspect-tall", "2:3", "2 / 3"],
];

for (const [name, authored, css] of RATIOS) {
  test(`${name} is authored "${authored}" in Figma and published as ${css}`, () => {
    const core = docV10().collections.find((c) => c.name === "core");
    const v = core.variables.find((x) => x.codeSyntax.WEB.value === name);
    assert.equal(v.type, "STRING");
    assert.equal(v.modes[0].raw, authored);
    assert.equal(declarations(adopted.tokensCss).get(name), css);
  });

  test(`${name} is named by P1, from codeSyntax.WEB — not by a config prefix`, () => {
    const core = docV10().collections.find((c) => c.name === "core");
    const v = core.variables.find((x) => x.codeSyntax.WEB.value === name);
    assert.equal(v.name, `aspect/${name.slice("--aspect-".length)}`);
  });

  test(`${name} matches the value this consumer had hand-authored, so adopting it changes nothing`, () => {
    const r = out.rows.find((x) => x.name === name);
    assert.equal(r.status, "MATCH");
    assert.equal(r.generated, css);
  });
}

test("all four land in the `core` block on :root, in one place", () => {
  assert.match(adopted.tokensCss,
    /--aspect-landscape: 3 \/ 2;[\s\S]{0,200}--aspect-portrait: 4 \/ 5;[\s\S]{0,200}--aspect-square: 1 \/ 1;[\s\S]{0,200}--aspect-tall: 2 \/ 3;/);
});

test("a ratio is NOT emitted as a quoted string — every other STRING variable still is", () => {
  assert.equal(adopted.tokensCss.includes('"3:2"'), false);
  assert.equal(declarations(adopted.tokensCss).get("--family-font-sans"), '"Suisse Intl"');
  assert.equal(declarations(adopted.tokensCss).get("--weight-strong"), '"Medium"');
});

test("P2 still wins: a hand-authored global declaration suppresses the generated ratio", () => {
  assert.equal(declarations(out.tokensCss).has("--aspect-landscape"), false);
  assert.equal(out.tokensCss.includes("--aspect-landscape:"), false);
});

// --- the renderer itself ---------------------------------------------------

const named = (name) => ({ codeSyntax: { WEB: { value: name } } });

test("both ratio spellings render the same, and decimals survive", () => {
  assert.equal(ratioValue(named("--x"), "3:2"), "3 / 2");
  assert.equal(ratioValue(named("--x"), "3/2"), "3 / 2");
  assert.equal(ratioValue(named("--x"), " 16 : 9 "), "16 / 9");
  assert.equal(ratioValue(named("--x"), "1.85:1"), "1.85 / 1");
});

test("a declared ratio variable holding something that is not a ratio is a hard failure, not a quoted passthrough", () => {
  assert.throws(() => ratioValue(named("--aspect-wide"), "wide-ish"),
    /--aspect-wide.*is not `a:b` or `a\/b`/s);
});

test("a non-ratio value in a declared path stops the run rather than shipping `aspect-ratio: \"…\"`", () => {
  const doc = docV10();
  doc.collections.find((c) => c.name === "core").variables
    .find((v) => v.name === "aspect/square").modes[0].raw = "1x1";
  assert.throws(() => generate(doc, consumerConfig040, { handAuthoredCss: consumerCss040() }),
    /--aspect-square.*is not `a:b`/s);
});

test("`ratioPaths` decides, not the name: only a declared path is treated as a ratio", () => {
  const doc = docV10();
  const core = doc.collections.find((c) => c.name === "core");
  const text = doc.collections.find((c) => c.name === "text-primitives");
  assert.equal(isRatioVariable(core, core.variables.find((v) => v.name === "aspect/square"), preset), true);
  assert.equal(isRatioVariable(text, text.variables.find((v) => v.name === "weight/strong"), preset), false);
});

test("a consumer with no `ratioPaths` leaves every STRING quoted, exactly as 0.3.4 did", () => {
  const off = generate(docV10(), { ...consumerConfig040, aspect: { ratioPaths: [], descriptionGroup: null, descriptionPattern: null } },
    { handAuthoredCss: consumerCss040() });
  assert.equal(declarations(off.tokensCss).get("--aspect-square"), '"1:1"');
});

// --- the cross-check (a note about the design file, never a value) ---------

test("the excluded height groups' descriptions now AGREE with the authored variables — no finding", () => {
  assert.deepEqual(aspectDescriptionFindings(docV10(), preset), []);
  assert.equal(out.warnings.some((w) => w.code === "ASPECT_DESCRIPTION_DISAGREES"), false);
});

test("a description that contradicts the authored variable raises ASPECT_DESCRIPTION_DISAGREES", () => {
  const doc = docV10();
  doc.collections.find((c) => c.name === "layout").variables
    .find((v) => v.name === "grid/aspect/tall/full-width").description = "Ratio – 3/4, 3:4";
  const findings = aspectDescriptionFindings(doc, preset);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].name, "--aspect-tall");
  assert.match(findings[0].detail, /authored `2 \/ 3`/);
  assert.match(findings[0].detail, /--grid-aspect-tall-full-width` describes `3 \/ 4`/);
  assert.match(findings[0].detail, /The authored variable is the value/);
});

test("a contradicting description changes NOTHING about what is emitted — it is a note, not a source", () => {
  const doc = docV10();
  doc.collections.find((c) => c.name === "layout").variables
    .find((v) => v.name === "grid/aspect/tall/full-width").description = "Ratio – 3/4, 3:4";
  const noisy = generate(doc, consumerConfig040, { handAuthoredCss: consumerCss040() });
  assert.equal(declarations(noisy.tokensCss).get("--aspect-tall"), "2 / 3");
  assert.equal(noisy.warnings.filter((w) => w.code === "ASPECT_DESCRIPTION_DISAGREES").length, 1);
  assert.match(noisy.report, /`ASPECT_DESCRIPTION_DISAGREES` \| `--aspect-tall`/);
});

test("`descriptionGroup: null` skips the cross-check entirely", () => {
  const doc = docV10();
  doc.collections.find((c) => c.name === "layout").variables
    .find((v) => v.name === "grid/aspect/tall/full-width").description = "Ratio – 3/4, 3:4";
  assert.deepEqual(
    aspectDescriptionFindings(doc, { ...preset, aspect: { ...preset.aspect, descriptionGroup: null } }), []);
});

// --- the excluded group it cross-checks against ----------------------------

test("the per-col-span heights are still EXCLUDED — none of them becomes a token (P7)", () => {
  assert.equal(out.excludedRows.filter((r) => r.name.startsWith("--grid-aspect-")).length, 39);
  assert.equal(/--grid-aspect-/.test(out.tokensCss), false);
});

test("the exclusions manifest still lists every one of them", () => {
  const manifest = JSON.parse(out.exclusionsJson);
  assert.equal(manifest.names.filter((n) => n.startsWith("--grid-aspect-")).length, 39);
  assert.ok(manifest.excludePaths.includes("layout/grid/aspect/"));
});

test("the shipped house preset points P20 at the collection the operator authored", () => {
  assert.deepEqual(preset.aspect.ratioPaths, ["core/aspect/"]);
  assert.equal(preset.aspect.descriptionGroup, "layout/grid/aspect/");
  assert.ok(preset.exclude.paths.includes(preset.aspect.descriptionGroup),
    "the group P20 cross-checks is the group P7 excludes — reading it is deliberate");
});
