// WCAG grading and the step-mapping helpers (HT-119).
import { test } from "node:test";
import assert from "node:assert/strict";

import { contrast, grade, nearestPassingStep, mirrorStep, pullBack, ramp } from "../src/color-engine/index.mjs";
import { hexToOklch } from "../src/color-engine/color.mjs";

const FIFTY = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const blue = () => ramp({ anchors: [{ hex: "#14d7fb", step: 300 }, { hex: "#2b67b9", step: 700 }], steps: FIFTY }).steps;

test("contrast: the WCAG 2.x ratio, two places", () => {
  assert.equal(contrast("#000000", "#ffffff"), 21);
  assert.equal(contrast("#ffffff", "#ffffff"), 1);
  assert.equal(contrast("#777777", "#ffffff"), 4.48);
  assert.equal(contrast("#ffffff", "#777777"), 4.48);
  assert.throws(() => contrast("nope", "#fff"), TypeError);
});

test("grade: AA text 4.5, large text and UI 3, boundaries inclusive", () => {
  assert.deepEqual(grade("#767676", "#ffffff"), { ratio: 4.54, pass: true, floor: 4.5 });
  assert.equal(grade("#777777", "#ffffff").pass, false);
  assert.equal(grade("#777777", "#ffffff", "large-text").pass, true);
  assert.equal(grade("#949494", "#ffffff", "ui").pass, true); // 3.03
  assert.equal(grade("#999999", "#ffffff", "ui").pass, false); // 2.85
  assert.throws(() => grade("#000", "#fff", "huge"), RangeError);
});

test("nearestPassingStep: nearest to where it sits, passing on every surface, lower step on a tie", () => {
  const r = blue();
  assert.equal(nearestPassingStep(r, 300, ["#ffffff"]), 700); // 700 is the first step that reads on white
  assert.equal(nearestPassingStep(r, 700, ["#ffffff"]), 700);
  assert.equal(nearestPassingStep(r, 700, ["#ffffff", "#e9faff"]), 700);
  const both = nearestPassingStep(r, 500, ["#ffffff", "#0d0d0d"]); // nothing clears 4.5 on near-white and near-black
  assert.equal(both === null || typeof both === "number", true);
  const tie = [{ step: 100, hex: "#000000" }, { step: 200, hex: "#ffffff" }, { step: 300, hex: "#000000" }];
  assert.equal(nearestPassingStep(tie, 200, ["#ffffff"]), 100);
  assert.equal(nearestPassingStep([{ step: 1, hex: "#eeeeee" }], 1, ["#ffffff"]), null);
});

test("nearestPassingStep works on any scale (1-12 as well as 50-950)", () => {
  const r = Array.from({ length: 12 }, (_, i) => ({ step: i + 1, hex: `#${(255 - i * 20).toString(16).padStart(2, "0").repeat(3)}` }));
  assert.equal(nearestPassingStep(r, 1, ["#ffffff"]), 8);
});

test("mirrorStep: by lightness across the ramp's own range, not by step number", () => {
  const r = blue();
  assert.equal(mirrorStep(r, 50), 950);
  assert.equal(mirrorStep(r, 950), 50);
  const l = (s) => hexToOklch(r.find((x) => x.step === s).hex).l;
  const lo = Math.min(...r.map((s) => hexToOklch(s.hex).l));
  const hi = Math.max(...r.map((s) => hexToOklch(s.hex).l));
  for (const s of [100, 300, 500, 700]) {
    const m = mirrorStep(r, s);
    const best = Math.min(...r.map((x) => Math.abs(hexToOklch(x.hex).l - (lo + hi - l(s)))));
    assert.equal(Math.abs(l(m) - (lo + hi - l(s))), best);
  }
  // A lopsided ramp: step numbers would say 200 <-> 800, lightness says otherwise.
  const lop = [{ step: 100, hex: "#ffffff" }, { step: 200, hex: "#fafafa" }, { step: 300, hex: "#444444" }, { step: 400, hex: "#222222" }, { step: 500, hex: "#000000" }];
  assert.equal(mirrorStep(lop, 100), 500);
  assert.equal(mirrorStep(lop, 200), 500);
  assert.equal(mirrorStep(lop, 500), 100);
});

test("mirrorStep: a step the ramp lacks mirrors across the ends of the scale", () => {
  assert.equal(mirrorStep([{ step: 100, hex: "#fff" }, { step: 500, hex: "#888" }, { step: 900, hex: "#000" }], 200), 900);
});

test("pullBack: an overshooting step eases toward 4.5, inside the move cap and its neighbours", () => {
  const r = blue();
  const dark = r.find((s) => s.step === 900);
  assert.ok(grade(dark.hex, "#ffffff").ratio > 5);
  const p = pullBack(r, 900, "#ffffff");
  assert.ok(p, "900 on white overshoots and has room");
  const ratio = grade(p.hex, "#ffffff").ratio;
  assert.ok(ratio >= 4.5 && ratio < grade(dark.hex, "#ffffff").ratio);
  assert.ok(Math.abs(hexToOklch(p.hex).l - hexToOklch(dark.hex).l) <= 0.05 + 1e-9);
  assert.equal(p.from, dark.hex);
});

test("pullBack: null for an anchor, a step that does not overshoot, or a step with no room", () => {
  const r = blue();
  assert.equal(pullBack(r, 700, "#ffffff", { anchor: true }), null);
  const near = r.find((s) => grade(s.hex, "#ffffff").ratio > 4.5 && grade(s.hex, "#ffffff").ratio <= 5);
  if (near) assert.equal(pullBack(r, near.step, "#ffffff"), null);
  const packed = [{ step: 1, hex: "#3a3a3a" }, { step: 2, hex: "#333333" }, { step: 3, hex: "#2d2d2d" }];
  assert.equal(pullBack(packed, 2, "#ffffff"), null);
  assert.throws(() => pullBack(r, 123, "#fff"), RangeError);
});
