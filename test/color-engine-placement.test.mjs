// Placement follows the lightness ends it is given. nearestStep places a colour on a white→black ladder;
// when the caller names the ends the ramp is generated to (a fitted system's, or its own), the ladder runs
// between those same ends. With none named, the ladder and the dark cut-off are the engine's defaults.
// The real system is the JHD design-system export: a ramp's own colour at its own step is the right answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { nearestStep } from "../src/color-engine/ramp.mjs";
import { oklchToHex } from "../src/color-engine/color.mjs";
import { fitToSystem } from "../src/color-engine/fit.mjs";
import { buildProfile } from "../src/profile.mjs";
import { colourRamps } from "../src/ramp.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = JSON.parse(gunzipSync(readFileSync(path.join(root, "fixtures", "jhd-v19-2026-10-29", "design-system-handoff.json.gz"))).toString("utf8"));
const ramps = colourRamps(doc, buildProfile(doc));
const fit = fitToSystem(ramps.map((r) => ({ name: r.name, steps: r.steps })));
const ends = { lightMin: fit.lightness.min, lightMax: fit.lightness.max };
const own = ramps.flatMap((r) => r.steps.map((s) => ({ ramp: r.name, step: s.step, hex: s.hex })));

// Worked example, by hand. Steps 100–900, ends named 0.90 / 0.50, a neutral grey at OKLCH L 0.52 (placed by
// lightness alone). Ladder lightness at step s is 0.90 − t^1.4 × 0.40, t = (s − 100) / 800: step 800 gives
// 0.568, step 900 gives 0.50, so 0.52 is nearest step 900. On the default ladder (0.98 → 0.14) the same
// grey sits at t^1.4 = (0.98 − 0.52) / 0.84, t ≈ 0.65, about step 600.
const HUND = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const grey = oklchToHex({ l: 0.52, c: 0, h: 0 });

test("a neutral is placed on the ladder between the ends it is given", () => {
  assert.equal(nearestStep(grey, HUND, { lightMin: 0.5, lightMax: 0.9 }), 900);
  assert.equal(nearestStep(grey, HUND), 600);
});

test("lightMax alone, or lightMin alone, moves only its own end of the ladder", () => {
  assert.equal(nearestStep(grey, HUND, { lightMax: 0.9 }), nearestStep(grey, HUND, { lightMax: 0.9, lightMin: 0.14 }));
  assert.equal(nearestStep(grey, HUND, { lightMin: 0.5 }), nearestStep(grey, HUND, { lightMax: 0.98, lightMin: 0.5 }));
});

test("ends left undefined (as ramp() passes them) are the defaults", () => {
  for (const c of own) assert.equal(nearestStep(c.hex, fit.steps, { lightMin: undefined, lightMax: undefined }), nearestStep(c.hex, fit.steps), c.hex);
});

test("the dark cut-off is the same lightMin: above it a colour keeps a rung, at or below it the last step", () => {
  assert.notEqual(nearestStep("#0000ff", HUND), 900); // OKLCH L 0.45: above the default 0.30
  assert.equal(nearestStep("#0000ff", HUND, { lightMin: 0.5, lightMax: 0.98 }), 900);
});

const goldenPath = path.join(root, "fixtures", "color-engine", "placement-fitted.json.gz");
test("every case in the fitted-ends placement golden matches", () => {
  assert.ok(existsSync(goldenPath), "fixtures/color-engine/placement-fitted.json.gz is missing");
  const golden = JSON.parse(gunzipSync(readFileSync(goldenPath)).toString("utf8"));
  assert.deepEqual(golden.steps, fit.steps);
  assert.deepEqual(golden.lightness, fit.lightness);
  assert.equal(golden.cases.length, own.length);
  const diffs = golden.cases.filter(([hex, out]) => nearestStep(hex, fit.steps, ends) !== out);
  assert.deepEqual(diffs.slice(0, 5), [], `${diffs.length} of ${golden.cases.length} differ`);
});
