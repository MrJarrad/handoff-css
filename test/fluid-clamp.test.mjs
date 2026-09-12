// P11 addition (0.5.2) — a `fluid-clamp` rule's `css` is the export's OWN
// clamp() expression, verbatim (never recomputed here). But the export can
// state one that does not reproduce its own samples: the 2026-09-12 19:12
// export's `vw` coefficient is `slopeRemPerPx × 100` where it needs to be
// `× 1600` (the 16px root AND the /100 of `vw` both belong in the same step),
// so `clamp(1.953125rem, 0.5208vw + 0.000125rem, 10rem)` evaluates to 31.2px
// at every sampled width against samples 31.25 / 64 / 106.7 / 160px.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evalClampPx, fluidClampFindings, validateExport } from "../src/validate-export.mjs";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

const rule = (over = {}) => ({
  strategy: "fluid-clamp",
  layoutVariant: "flush",
  css: "clamp(1.953125rem, 0.5208vw + 0.000125rem, 10rem)",
  samples: [
    { modeName: "sm-flush", widthPx: 375, rawPx: 31.25 },
    { modeName: "md-flush", widthPx: 768, rawPx: 64 },
    { modeName: "lg-flush", widthPx: 1280, rawPx: 106.66999816894531 },
    { modeName: "xl-flush", widthPx: 1920, rawPx: 160 },
  ],
  ...over,
});

const doc = (rules) => ({
  collections: [{ name: "grid", variables: [{ name: "grid/col-span/col-span-1", responsiveBehavior: { rules } }] }],
});

test("evalClampPx reads the export's own vw + rem expression at one width — the 16× broken coefficient stays pinned to the clamp floor", () => {
  // 0.5208vw of 768px is 4.0px, plus 0.002px intercept: still under the
  // 31.25px floor (`1.953125rem`), so the clamp floors it at 31.25px — nowhere
  // near the real 64px (`4rem`) sample. This IS the reported defect: at every
  // sampled width the broken coefficient cannot even clear the minimum.
  const px = evalClampPx("clamp(1.953125rem, 0.5208vw + 0.000125rem, 10rem)", 768);
  assert.equal(px, 31.25);
});

test("evalClampPx returns null for a css string that is not a clamp() it recognises", () => {
  assert.equal(evalClampPx("3.416875rem", 768), null);
});

test("a fluid-clamp rule whose css is 16× too small (the 2026-09-12 19:12 defect) is FLUID_CLAMP_MISMATCH, naming each missed sample", () => {
  const findings = fluidClampFindings(doc([rule()]));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "FLUID_CLAMP_MISMATCH");
  assert.equal(findings[0].variable, "grid/col-span/col-span-1");
  assert.equal(findings[0].variant, "flush");
  // sm-flush's sample (31.25px) happens to equal the clamp's own floor, so
  // only the three samples ABOVE the floor (md/lg/xl) actually miss.
  assert.match(findings[0].detail, /misses 3 of its own samples/);
  assert.match(findings[0].detail, /md-flush/);
  assert.match(findings[0].detail, /lg-flush/);
  assert.match(findings[0].detail, /xl-flush/);
});

test("a hand-built clamp whose css DOES reproduce its samples raises nothing", () => {
  // The correct coefficient: slopeRemPerPx × 1600, not × 100 — 0.5208 * 16 =
  // 8.3328vw reproduces the same four samples this rule's `preferred` was fit
  // from (min/mid/mid/max all within the 0.125rem/2px tolerance).
  const good = rule({ css: "clamp(1.953125rem, 8.3328vw + 0.002rem, 10rem)" });
  const findings = fluidClampFindings(doc([good]));
  assert.deepEqual(findings, []);
});

test("validateExport surfaces fluid-clamp mismatches as a separate `clampFindings`, not the schema `errors`", () => {
  const bare = {
    schema: "design-system-handoff",
    schemaVersion: 15,
    contentHash: "a".repeat(64),
    fingerprint: { designSystemStateHash: "b".repeat(64) },
    breakpoints: { entries: [{ modeId: "1", modeName: "sm" }] },
    collections: [
      {
        name: "grid",
        modes: [{ id: "1", name: "sm" }],
        variables: [
          {
            name: "grid/col-span/col-span-1",
            type: "FLOAT",
            codeSyntax: { WEB: { value: "--grid-col-span-1" } },
            modes: [{ modeId: "1", modeName: "sm" }],
            responsiveBehavior: { rules: [rule()] },
          },
        ],
      },
    ],
    styles: { PAINT: [], TEXT: [], EFFECT: [], GRID: [] },
    cssCustomPropertySheets: [],
  };
  const res = validateExport(bare);
  assert.equal(res.errors.length, 0, "schema errors stay schema-only");
  assert.equal(res.clampFindings.length, 1);
  assert.equal(res.clampFindings[0].code, "FLUID_CLAMP_MISMATCH");
});

test("an unparseable fluid-clamp css is FLUID_CLAMP_UNPARSEABLE, not silently skipped", () => {
  const findings = fluidClampFindings(doc([rule({ css: "not a clamp" })]));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "FLUID_CLAMP_UNPARSEABLE");
});

test("a fluid-clamp rule with no samples raises nothing — there is nothing to check it against", () => {
  const findings = fluidClampFindings(doc([rule({ samples: [] })]));
  assert.deepEqual(findings, []);
});

// The finding this release exists for: the real 2026-09-12 19:12 export
// (schema 15), 53 of its 71 `fluid-clamp` rules miss their own samples.
test("the real 2026-09-12 19:12 export (schema 15) reports exactly 53 FLUID_CLAMP_MISMATCH findings", () => {
  const exportDoc = JSON.parse(readFileSync(path.join(FIXTURES, "jhd-v15-2026-09-12", "export.json"), "utf8"));
  assert.equal(exportDoc.schemaVersion, 15);
  const res = validateExport(exportDoc);
  assert.equal(res.ok, true, "schema-valid on its own — the clamp defect is separate from shape");
  const mismatches = res.clampFindings.filter((f) => f.code === "FLUID_CLAMP_MISMATCH");
  assert.equal(mismatches.length, 53);
  assert.equal(res.clampFindings.filter((f) => f.code === "FLUID_CLAMP_UNPARSEABLE").length, 0);
});

// The bug predates the 19:12 export — every committed fixture from schema 8
// on carries the same `slopeRemPerPx × 100` plugin defect, at whatever count
// its own variable set produces. Recorded here (and in CHANGELOG.md) rather
// than pinned to zero, because pinning these fixtures to "clean" would be
// asserting something false about documents this package does not control.
test("every schema 8+ fixture's own FLUID_CLAMP_MISMATCH count is pinned, not silently regenerated to zero", () => {
  const counts = {
    "jhd-v8-2026-09-10": 14,
    "jhd-v8b-2026-09-10": 3,
    "jhd-v9-2026-09-11": 53,
    "jhd-v9b-2026-09-11": 53,
    "jhd-v9c-2026-09-11": 53,
    "jhd-v10-2026-09-12": 53,
    "jhd-v11-2026-09-12": 53,
    "jhd-v13-2026-09-12": 53,
  };
  for (const [fixture, expected] of Object.entries(counts)) {
    const exportDoc = JSON.parse(readFileSync(path.join(FIXTURES, fixture, "export.json"), "utf8"));
    const res = validateExport(exportDoc);
    const mismatches = res.clampFindings.filter((f) => f.code === "FLUID_CLAMP_MISMATCH").length;
    assert.equal(mismatches, expected, `${fixture}: expected ${expected} FLUID_CLAMP_MISMATCH, got ${mismatches}`);
  }
});
