// P20 — ASPECT RATIOS. Operator rulings 2026-09-12 rows 5 and 6: *"all of them
// have a description with the ratio"*, and *"figma has no concept of aspect
// ratios, I tend to just use the col-span as the height"*. So the ratio is
// derived from the descriptions of an EXCLUDED group, once per leaf group, and
// no ratio is hand-authored a second time.
//
// The expected ratios below are literals read off the export's descriptions
// ("Ratio – 3/2, 3:2"), which are also what the consumer's own stylesheet has
// declared by hand since before this policy existed — two independent sources
// that happen to agree, which is the point of the MATCH rows.
import { test } from "node:test";
import assert from "node:assert/strict";

import { aspectGroups, aspectTokens } from "../src/aspect.mjs";
import { generate } from "../src/index.mjs";
import { consumerConfig040, consumerCss, docV9d, preset } from "./fixture.mjs";

const out = generate(docV9d(), consumerConfig040, { handAuthoredCss: consumerCss() });
const row = (name) => out.aspectRows.find((r) => r.name === name);
const warning = (code) => out.warnings.find((w) => w.code === code);

/**
 * The consumer's stylesheet with its four hand-authored ratio copies removed —
 * the deletion adopting P20 requires, since a global hand-authored declaration
 * suppresses the generated token (P2) and ruling row 5 is explicit that there
 * are to be *"no hand-authored copies"*. Filtered here rather than vendored as
 * a second styles.css, because `jhd-design-system` has not landed the deletion
 * yet and a fixture stylesheet no repo ships would prove nothing.
 */
const cssWithoutHandAuthoredRatios = () =>
  consumerCss().split("\n").filter((l) => !/^\s*--aspect-[a-z]+:/.test(l)).join("\n");

const adopted = generate(docV9d(), consumerConfig040,
  { handAuthoredCss: cssWithoutHandAuthoredRatios() });

const declarations = (css) => {
  const found = new Map();
  for (const line of css.split("\n")) {
    const m = /^\s*(--[a-z0-9-]+):\s*([^;]+);/.exec(line);
    if (m && !found.has(m[1])) found.set(m[1], m[2].trim());
  }
  return found;
};

// --- reading the group -----------------------------------------------------

test("the leaf groups under `layout/grid/aspect/` are found, each with every member", () => {
  const groups = aspectGroups(docV9d(), preset);
  assert.deepEqual(groups.map((g) => [g.group, g.members.length]),
    [["landscape", 13], ["portrait", 13], ["tall", 13]]);
});

test("`square` is not among them — the group does not exist in this export yet", () => {
  assert.deepEqual(aspectGroups(docV9d(), preset).map((g) => g.group).includes("square"), false);
});

test("the descriptionPattern reads the fraction, not the `a:b` restatement after the comma", () => {
  const landscape = aspectGroups(docV9d(), preset).find((g) => g.group === "landscape");
  assert.equal(landscape.members[0].description, "Ratio – 3/2, 3:2");
  assert.equal(landscape.members[0].ratio, "3 / 2");
});

// --- the derived tokens ----------------------------------------------------

for (const [name, ratio, group] of [
  ["--aspect-landscape", "3 / 2", "layout/grid/aspect/landscape"],
  ["--aspect-portrait", "4 / 5", "layout/grid/aspect/portrait"],
]) {
  test(`${name} is derived as ${ratio} from every member of ${group}`, () => {
    assert.equal(row(name).ratio, ratio);
    assert.equal(row(name).group, group);
    assert.equal(row(name).members, 13);
  });

  test(`${name} is declared in the generated stylesheet once the hand-authored copy is deleted`, () => {
    assert.equal(declarations(adopted.tokensCss).get(name), ratio);
  });

  test(`${name} agrees with the value this consumer had hand-authored, so adopting it changes no computed value`, () => {
    assert.equal(row(name).status, "MATCH");
    assert.equal(row(name).hand, ratio);
  });
}

test("a name derived here is a real custom property, not a comment — the block parses as CSS declarations", () => {
  assert.match(adopted.tokensCss, /\/\* --- aspect ratios -+ \*\//);
  assert.match(adopted.tokensCss, /:root \{\n {2}--aspect-landscape: 3 \/ 2;\n {2}--aspect-portrait: 4 \/ 5;\n\}/);
});

test("P2 still wins: a hand-authored global declaration suppresses the derived token", () => {
  assert.equal(declarations(out.tokensCss).has("--aspect-landscape"), false);
  assert.equal(out.tokensCss.includes("--aspect-landscape:"), false);
});

test("a hand-authored copy that DISAGREES is reported as VALUE-DRIFT, not silently overwritten", () => {
  const drifted = generate(docV9d(), consumerConfig040, {
    handAuthoredCss: consumerCss().replace("--aspect-landscape: 3 / 2;", "--aspect-landscape: 16 / 9;"),
  });
  const r = drifted.aspectRows.find((x) => x.name === "--aspect-landscape");
  assert.equal(r.status, "VALUE-DRIFT");
  assert.equal(r.hand, "16 / 9");
  assert.equal(r.ratio, "3 / 2");
});

// --- disagreement is a finding, never a pick -------------------------------

test("`tall` publishes NOTHING: twelve members say 2/3 and `full-width` says 3/4", () => {
  assert.equal(row("--aspect-tall"), undefined);
  assert.equal(declarations(adopted.tokensCss).has("--aspect-tall"), false);
});

test("the mixed group raises ASPECT_RATIO_MIXED naming both ratios and a variable that states each", () => {
  const w = warning("ASPECT_RATIO_MIXED");
  assert.equal(w.name, "--aspect-tall");
  assert.match(w.detail, /`2 \/ 3`/);
  assert.match(w.detail, /`3 \/ 4`/);
  assert.match(w.detail, /--grid-aspect-tall-full-width/);
  assert.match(w.detail, /will not pick which/);
});

test("the mixed finding reaches the report, where a human reads it", () => {
  assert.match(out.report, /`ASPECT_RATIO_MIXED` \| `--aspect-tall`/);
});

test("a leaf group whose members state no recognisable ratio raises ASPECT_RATIO_MISSING", () => {
  const doc = docV9d();
  for (const v of doc.collections.find((c) => c.name === "layout").variables) {
    if (v.name.startsWith("grid/aspect/portrait/")) v.description = "The portrait media height";
  }
  const { rows, warnings } = aspectTokens(doc, new Map(), preset);
  assert.equal(rows.some((r) => r.name === "--aspect-portrait"), false);
  const w = warnings.find((x) => x.code === "ASPECT_RATIO_MISSING");
  assert.equal(w.name, "--aspect-portrait");
  assert.match(w.detail, /nothing derived/);
});

test("a variable sitting directly in the aspect group has no leaf to name and raises ASPECT_UNGROUPED", () => {
  const doc = docV9d();
  const layout = doc.collections.find((c) => c.name === "layout");
  const clone = structuredClone(layout.variables.find((v) => v.name === "grid/aspect/portrait/col-span-1"));
  clone.name = "grid/aspect/loose";
  clone.codeSyntax.WEB.value = "--grid-aspect-loose";
  layout.variables.push(clone);
  const { warnings } = aspectTokens(doc, new Map(), preset);
  const w = warnings.find((x) => x.code === "ASPECT_UNGROUPED");
  assert.match(w.detail, /--grid-aspect-loose/);
});

// --- the excluded group it reads from --------------------------------------

test("the per-col-span heights it reads are still EXCLUDED — none of them becomes a token (P7)", () => {
  const excluded = out.excludedRows.filter((r) => r.name.startsWith("--grid-aspect-"));
  assert.equal(excluded.length, 39);
  assert.equal(/--grid-aspect-/.test(out.tokensCss), false);
});

test("the exclusions manifest still lists every one of them, so a conformance checker sees no change", () => {
  const manifest = JSON.parse(out.exclusionsJson);
  assert.equal(manifest.names.filter((n) => n.startsWith("--grid-aspect-")).length, 39);
  assert.ok(manifest.excludePaths.includes("layout/grid/aspect/"));
});

// --- the policy off --------------------------------------------------------

test("a consumer with `aspect.group: null` derives nothing and gets no report section", () => {
  const off = generate(docV9d(), { ...consumerConfig040, aspect: { group: null, prefix: null, descriptionPattern: null } },
    { handAuthoredCss: cssWithoutHandAuthoredRatios() });
  assert.deepEqual(off.aspectRows, []);
  assert.equal(off.report.includes("**Aspect ratios"), false);
  assert.equal(off.tokensCss.includes("--aspect-"), false);
});

test("with the policy on, the report carries the derivation table", () => {
  assert.match(out.report, /\*\*Aspect ratios \(2\)\*\* \(P20\)/);
  assert.match(out.report, /\| `--aspect-landscape` \| `3 \/ 2` \| `layout\/grid\/aspect\/landscape` \| 13 \| MATCH \|/);
});

// --- collisions and determinism --------------------------------------------

test("a derived name that collides with an export-backed token is a hard failure, never resolved by ordering", () => {
  const doc = docV9d();
  const core = doc.collections.find((c) => c.name === "core");
  const clone = structuredClone(core.variables[0]);
  clone.id = "VariableID:99:99";
  clone.name = "aspect/landscape";
  clone.codeSyntax.WEB.value = "--aspect-landscape";
  core.variables.push(clone);
  assert.throws(
    () => generate(doc, consumerConfig040, { handAuthoredCss: cssWithoutHandAuthoredRatios() }),
    /aspect token `--aspect-landscape`.*collides/s,
  );
});

test("the derivation is deterministic — a second run is byte-identical", () => {
  const again = generate(docV9d(), consumerConfig040, { handAuthoredCss: consumerCss() });
  assert.equal(again.tokensCss, out.tokensCss);
  assert.equal(again.report, out.report);
  assert.deepEqual(again.aspectRows, out.aspectRows);
});

test("the shipped house preset points P20 at the group the operator's ruling names", () => {
  assert.equal(preset.aspect.group, "layout/grid/aspect/");
  assert.equal(preset.aspect.prefix, "--aspect-");
  assert.ok(preset.exclude.paths.includes(preset.aspect.group),
    "the group P20 reads is also the group P7 excludes — reading it is deliberate");
});
