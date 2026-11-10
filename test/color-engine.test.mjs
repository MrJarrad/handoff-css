// The color engine's public entry: ramp, mergeVerdict, fitToSystem, nameColor, auditRamp, DEFAULTS.
import { test } from "node:test";
import assert from "node:assert/strict";

import * as engine from "../src/color-engine/index.mjs";
import { generateRamp, nearestStep, auditRamp } from "../src/color-engine/ramp.mjs";
import { hexToOklch } from "../src/color-engine/color.mjs";

const { ramp, DEFAULTS } = engine;
const HUND = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const FIFTY = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const hexes = (r) => r.steps.map((s) => s.hex);

// ── ramp ──────────────────────────────────────────────────────────────────────────────────────────
test("cyan at 300 and blue at 700 merge into the approved 50–950 ramp", () => {
  const r = ramp({ anchors: [{ hex: "#14d7fb", step: 300 }, { hex: "#2b67b9", step: 700 }], steps: FIFTY });
  assert.deepEqual(hexes(r), ["#e9faff", "#ccf4ff", "#87e7ff", "#14d7fb", "#21baeb", "#289eda", "#2b83c8", "#2b67b9", "#194e95", "#073672", "#012b61"]);
  assert.deepEqual(r.steps.filter((s) => s.anchor).map((s) => s.step), [300, 700]);
  assert.deepEqual(r.placement, [{ hex: "#14d7fb", step: 300, given: true }, { hex: "#2b67b9", step: 700, given: true }]);
});

test("one anchor is the single-anchor generator, with the anchor's own hex at its step", () => {
  const r = ramp({ anchors: [{ hex: "#a33001", step: 600 }], steps: HUND });
  assert.deepEqual(hexes(r), generateRamp({ seedHex: "#a33001", steps: HUND, anchorStep: 600 }).map((s) => s.hex));
  // #00ddb1 does not survive the OKLCH round trip (it comes back #01ddb1); the anchor is still exact.
  const edge = ramp({ anchors: [{ hex: "#00DDB1", step: 400 }], steps: HUND });
  assert.equal(edge.steps.find((s) => s.step === 400).hex, "#00ddb1");
});

test("no steps given: the default 100–900 scale and default dark end", () => {
  assert.deepEqual(DEFAULTS.steps, HUND);
  assert.equal(DEFAULTS.lightness.min, 0.3);
  const r = ramp({ anchors: [{ hex: "#2b67b9" }] });
  assert.deepEqual(r.steps.map((s) => s.step), HUND);
  assert.equal(r.placement[0].given, false);
  assert.equal(r.placement[0].step, nearestStep("#2b67b9", HUND));
});

test("lightness bounds move the ends of the ramp", () => {
  const r = ramp({ anchors: [{ hex: "#14d7fb", step: 300 }], steps: FIFTY, lightness: { min: 0.25, max: 0.98 } });
  assert.ok(Math.abs(hexToOklch(r.steps.at(-1).hex).l - 0.25) < 0.005);
  assert.ok(Math.abs(hexToOklch(r.steps[0].hex).l - 0.98) < 0.005);
});

test("unplaced anchors that land on one step are spread to the nearest free step", () => {
  const r = ramp({ anchors: [{ hex: "#2b67b9" }, { hex: "#2c68ba" }], steps: HUND });
  const steps = r.placement.map((p) => p.step);
  assert.equal(new Set(steps).size, 2);
  assert.equal(Math.abs(HUND.indexOf(steps[0]) - HUND.indexOf(steps[1])), 1);
});

test("ramp refuses inputs it cannot honour", () => {
  assert.throws(() => ramp({ anchors: [] }), /at least one anchor/);
  assert.throws(() => ramp({ anchors: [{ hex: "teal-ish" }] }), /not a colour/);
  assert.throws(() => ramp({ anchors: [{ hex: "#14d7fb", step: 250 }], steps: HUND }), /250 is not one of the steps/);
  assert.throws(() => ramp({ anchors: [{ hex: "#14d7fb", step: 300 }, { hex: "#2b67b9", step: 300 }], steps: HUND }), /two anchors at step 300/);
  assert.throws(() => ramp({ anchors: [{ hex: "#14d7fb" }], steps: [100, 100, 200] }), /steps must be distinct/);
});

test("every generated ramp keeps its anchors exact and gets darker step by step", () => {
  for (const [a, b] of [["#f9f8f7", "#5c5650"], ["#fbc117", "#8a4b00"], ["#e6ff00", "#4d5a00"], ["#ff00ff", "#5c0536"]]) {
    const r = ramp({ anchors: [{ hex: a }, { hex: b }], steps: FIFTY });
    assert.equal(r.steps.length, FIFTY.length);
    for (const p of r.placement) assert.equal(r.steps.find((s) => s.step === p.step).hex, p.hex);
    for (const s of r.steps) assert.match(s.hex, /^#[0-9a-f]{6}$/);
    const ls = r.steps.map((s) => hexToOklch(s.hex).l);
    for (let i = 1; i < ls.length; i++) assert.ok(ls[i] < ls[i - 1], `${a}+${b} step ${r.steps[i].step}`);
  }
});

// ── placement on any scale ──────────────────────────────────────────────────────────────────────────
test("placement works by step index: 1–9 places exactly as 100–900 does", () => {
  for (const hex of ["#14d7fb", "#2b67b9", "#a33001", "#fbc117", "#f4ff3a", "#efefef", "#8fe0ff", "#013c38", "#d1e231", "#7dc8f7"]) {
    assert.equal(nearestStep(hex, [1, 2, 3, 4, 5, 6, 7, 8, 9]), HUND.indexOf(nearestStep(hex, HUND)) + 1, hex);
  }
});

test("on 50–950 the lightest and darkest steps are reachable", () => {
  assert.equal(nearestStep("#f9f8f7", FIFTY), 50);
  assert.equal(nearestStep("#e9faff", FIFTY), 50);
  assert.equal(nearestStep("#0a0a0a", FIFTY), 950);
  assert.equal(nearestStep("#f4ff3a", FIFTY), 300); // a saturated light colour still sits no lighter than a quarter down
});

// ── audit ───────────────────────────────────────────────────────────────────────────────────────────
test("hue drift is measured round the wheel, so reds either side of 0° are close", () => {
  const a = auditRamp([{ step: 100, hex: "#f9667a" }, { step: 200, hex: "#d24572" }, { step: 300, hex: "#a82571" }]);
  const hues = a.rows.map((r) => r.oklch.h);
  assert.ok(Math.max(...hues) - Math.min(...hues) > 180, "fixture straddles 0°");
  assert.equal(a.hueDrift, 24.5);
  assert.equal(engine.auditRamp, auditRamp);
});
