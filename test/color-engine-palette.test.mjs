// paletteToSystem: a brand palette (a few hexes, no ramps) → the ramps a from-scratch web colour system needs.
import { test } from "node:test";
import assert from "node:assert/strict";

import { paletteToSystem, ramp, DEFAULTS } from "../src/color-engine/index.mjs";
import { hexToOklch } from "../src/color-engine/color.mjs";

// Slack's reported brand colours (third-party transcription of its media kit); worked example, not a contract.
const SLACK = [
  { name: "aubergine", hex: "#4a154b" },
  { name: "blue", hex: "#36c5f0" },
  { name: "green", hex: "#2eb67d" },
  { name: "yellow", hex: "#ecb22e" },
  { name: "red", hex: "#e01e5a" },
  { name: "black", hex: "#1d1c1d" },
];
const byName = (sys, n) => sys.ramps.find((r) => r.name === n);

test("every brand colour gets its own default ramp with its hex unchanged at the step it reads at", () => {
  const sys = paletteToSystem(SLACK);
  const landed = Object.fromEntries(SLACK.map((c) => [c.name, byName(sys, c.name).placement[0].step]));
  assert.deepEqual(landed, { aubergine: 900, blue: 400, green: 400, yellow: 300, red: 600, black: 900 });
  for (const c of SLACK) {
    const r = byName(sys, c.name);
    assert.equal(r.source, "brand");
    assert.deepEqual(r.steps.map((s) => s.step), DEFAULTS.steps);
    assert.equal(r.steps.find((s) => s.anchor).hex, c.hex);
    assert.deepEqual(r.steps, ramp({ anchors: [{ hex: c.hex }] }).steps); // same ramp the engine builds for one colour
  }
});

test("a brand palette with a near-black keeps it as the neutral ramp; none is added", () => {
  const sys = paletteToSystem(SLACK);
  assert.equal(byName(sys, "neutral"), undefined);
  assert.equal(sys.neutral.from, "brand");
  assert.equal(sys.neutral.ramp, "black");
});

test("a palette with no neutral gets one derived at the hue of its darkest colour, barely tinted", () => {
  const sys = paletteToSystem(SLACK.filter((c) => c.name !== "black"));
  const n = byName(sys, "neutral");
  assert.equal(sys.neutral.from, "derived");
  assert.equal(n.source, "derived-neutral");
  assert.ok(n.steps.every((s) => hexToOklch(s.hex).c < 0.035));
  const hue = hexToOklch(n.steps[4].hex).h;
  assert.ok(Math.abs(hue - hexToOklch("#4a154b").h) < 12, `neutral hue ${hue}`);
});

test("feedback roles are covered by a brand hue within the tolerance; a role nothing covers is added", () => {
  const sys = paletteToSystem(SLACK);
  const f = Object.fromEntries(sys.feedback.map((x) => [x.role, x]));
  assert.deepEqual([f.error.covers, f.success.covers, f.warning.covers], ["red", "green", "yellow"]);
  // Slack's blue sits ~32° from the conventional info hue: outside the default 30°.
  assert.equal(f.info.added, "info");
  const info = byName(sys, "info");
  assert.equal(info.source, "feedback");
  assert.ok(Math.abs(hexToOklch(info.steps[3].hex).h - 255) < 12);
  // a wider tolerance covers it instead
  const wide = paletteToSystem(SLACK, { feedbackTolerance: 40 });
  assert.equal(wide.feedback.find((x) => x.role === "info").covers, "blue");
  assert.equal(byName(wide, "info"), undefined);
});

test("report-only: auto-add off lists the gap and adds no ramp", () => {
  const sys = paletteToSystem(SLACK, { addFeedback: false });
  assert.deepEqual(sys.feedback.find((x) => x.role === "info"), { role: "info", hue: sys.feedback.find((x) => x.role === "info").hue, gap: true });
  assert.equal(byName(sys, "info"), undefined);
});

test("a brand hex that lands on an end step is reported, and can be pinned one step in", () => {
  const sys = paletteToSystem(SLACK);
  assert.deepEqual(sys.notes.filter((n) => n.kind === "anchor-at-end-step").map((n) => [n.ramp, n.step]), [["aubergine", 900], ["black", 900]]);
  const pinned = paletteToSystem(SLACK, { pinEndStep: true });
  assert.equal(byName(pinned, "aubergine").placement[0].step, 800);
  assert.equal(byName(pinned, "aubergine").steps.find((s) => s.step === 800).hex, "#4a154b");
  assert.equal(pinned.notes.filter((n) => n.kind === "anchor-at-end-step").length, 0);
});

test("two brand hexes that make one ramp are merged; a given step is honoured", () => {
  const sys = paletteToSystem([{ name: "sky", hex: "#36c5f0", step: 300 }, { name: "ocean", hex: "#0b5f7a", step: 700 }, { name: "ink", hex: "#111111" }]);
  const r = byName(sys, "sky");
  assert.deepEqual(r.placement.map((p) => [p.hex, p.step]), [["#36c5f0", 300], ["#0b5f7a", 700]]);
  assert.equal(byName(sys, "ocean"), undefined);
});

test("bad input is refused by name", () => {
  assert.throws(() => paletteToSystem([]), /at least one colour/);
  assert.throws(() => paletteToSystem([{ name: "a", hex: "#111111" }, { name: "a", hex: "#222222" }]), /duplicate colour name "a"/);
  assert.throws(() => paletteToSystem([{ name: "a", hex: "nope" }]), /not a colour/);
});
