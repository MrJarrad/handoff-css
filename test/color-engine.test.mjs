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

// ── mergeVerdict ────────────────────────────────────────────────────────────────────────────────────
const { mergeVerdict } = engine;
const byCheck = (v) => Object.fromEntries(v.reasons.map((r) => [r.check, r]));
// A system whose own ramps reach evenness 0.0445 and a hue spread of 49.6°.
const SYSTEM = { steps: FIFTY, lightness: { min: 0.282, max: 0.979 }, evenness: { max: 0.0445 }, hueDrift: { max: 49.6 } };

test("the approved cyan + blue ramp is a merge, in the system and from scratch", () => {
  const anchors = [{ hex: "#14d7fb", step: 300 }, { hex: "#2b67b9", step: 700 }];
  for (const v of [mergeVerdict({ anchors, steps: FIFTY }), mergeVerdict({ anchors, system: SYSTEM })]) {
    assert.equal(v.merge, true);
    const c = byCheck(v);
    assert.equal(c.lightness.pass, true);
    assert.equal(c.evenness.pass, true);
    assert.equal(c["hue drift"].pass, true);
    // The pairing rule (hues within 10°) fails and is reported, but does not decide.
    assert.equal(c.pairing.pass, false);
    assert.equal(c.pairing.veto, false);
    assert.match(c.pairing.text, /41\.3° apart/);
  }
});

test("the system's own limits set the bar", () => {
  const anchors = [{ hex: "#14d7fb", step: 300 }, { hex: "#2b67b9", step: 700 }];
  const tight = mergeVerdict({ anchors, system: { ...SYSTEM, hueDrift: { max: 30 } } });
  assert.equal(tight.merge, false);
  assert.equal(byCheck(tight)["hue drift"].pass, false);
  assert.match(byCheck(tight)["hue drift"].text, /> 30°/);
  const uneven = mergeVerdict({ anchors, system: { ...SYSTEM, evenness: { max: 0.01 } } });
  assert.equal(uneven.merge, false);
  assert.equal(byCheck(uneven).evenness.pass, false);
});

test("two unrelated hues are not one ramp", () => {
  const v = mergeVerdict({ anchors: [{ hex: "#14d7fb" }, { hex: "#a33001" }], steps: FIFTY });
  assert.equal(v.merge, false);
  assert.equal(byCheck(v)["hue drift"].pass, false);
});

test("one hue, light and dark, is one ramp and passes the pairing rule too", () => {
  const v = mergeVerdict({ anchors: [{ hex: "#aecdf9" }, { hex: "#2b67b9" }], steps: FIFTY });
  assert.equal(v.merge, true);
  assert.equal(byCheck(v).pairing.pass, true);
});

test("the pairing rule's other reasons are named: steps too close, neutral with a colour, warm with cool", () => {
  const close = mergeVerdict({ anchors: [{ hex: "#2b67b9", step: 600 }, { hex: "#1f5aa8", step: 700 }], steps: HUND });
  assert.match(byCheck(close).pairing.text, /1 step apart/);
  const mixed = mergeVerdict({ anchors: [{ hex: "#efefef", step: 100 }, { hex: "#2b67b9", step: 700 }], steps: HUND });
  assert.match(byCheck(mixed).pairing.text, /near-neutral with a colour/);
  const temp = mergeVerdict({ anchors: [{ hex: "#efece6", step: 100 }, { hex: "#4a4f57", step: 700 }], steps: HUND });
  assert.match(byCheck(temp).pairing.text, /warm and cool/);
});

test("a ramp that does not get darker step by step is never a merge", () => {
  const v = mergeVerdict({ anchors: [{ hex: "#2b67b9", step: 200 }, { hex: "#aecdf9", step: 700 }], steps: HUND });
  assert.equal(v.merge, false);
  assert.equal(byCheck(v).lightness.pass, false);
  assert.equal(byCheck(v).lightness.veto, true);
});

test("from scratch, the evenness bar is the widest spread the default ramps make on the scale in use", async () => {
  const { defaultEvennessMax } = await import("../src/color-engine/merge.mjs");
  const { oklchToHex, maxChroma } = await import("../src/color-engine/color.mjs");
  const FIVE = [100, 200, 300, 400, 500];
  for (const steps of [HUND, FIVE, FIFTY]) {
    let max = 0;
    for (let h = 0; h < 360; h += 30) for (const l of [0.3, 0.45, 0.6, 0.75, 0.9]) for (const c of [0.02, 0.06, 0.12, 0.2]) {
      max = Math.max(max, ramp({ anchors: [{ hex: oklchToHex({ l, c: Math.min(c, maxChroma(l, h)), h }) }], steps }).audit.evenness);
    }
    assert.equal(defaultEvennessMax(steps), max, steps.join(","));
  }
  assert.equal(defaultEvennessMax(HUND), 0.0319);
  assert.equal(defaultEvennessMax(FIVE), 0.0975);
});

test("on 100–500 with no system, the bar is the 5-step one", () => {
  // Steps 200 and 400 of the default ramp from #984260, refused against the 9-step bar before.
  const FIVE = [100, 200, 300, 400, 500];
  const v = mergeVerdict({ anchors: [{ hex: "#fabccd", step: 200 }, { hex: "#bf6582", step: 400 }], steps: FIVE });
  assert.equal(byCheck(v).evenness.pass, true, byCheck(v).evenness.text);
  assert.match(byCheck(v).evenness.text, /≤ 0\.0975, the widest of the default ramps on 5 steps/);
});

test("mergeVerdict needs two anchors", () => {
  assert.throws(() => mergeVerdict({ anchors: [{ hex: "#14d7fb" }] }), /two or more anchors/);
});

// ── fitToSystem ─────────────────────────────────────────────────────────────────────────────────────
const { fitToSystem } = engine;
const asRamp = (name, r) => ({ name, steps: r.steps.map(({ step, hex }) => ({ step, hex })) });
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const systemRamps = () => [
  asRamp("sky", ramp({ anchors: [{ hex: "#14d7fb", step: 300 }], steps: FIFTY, lightness: { min: 0.24, max: 0.98 } })),
  asRamp("ember", ramp({ anchors: [{ hex: "#a33001", step: 700 }], steps: FIFTY, lightness: { min: 0.27, max: 0.97 } })),
  asRamp("moss", ramp({ anchors: [{ hex: "#4d7a2a", step: 600 }], steps: FIFTY, lightness: { min: 0.31, max: 0.985 } })),
  asRamp("stone", ramp({ anchors: [{ hex: "#8a8580", step: 500 }], steps: FIFTY, lightness: { min: 0.15, max: 0.97 } })),
  asRamp("legacy", ramp({ anchors: [{ hex: "#2b67b9", step: 600 }], steps: HUND })),
];

test("fit takes the system's step scale and the median ends of its colour ramps", () => {
  const ramps = systemRamps();
  const fit = fitToSystem(ramps);
  assert.deepEqual(fit.steps, FIFTY);
  const chromatic = ramps.slice(0, 3);
  const L = (hex) => hexToOklch(hex).l;
  assert.equal(fit.lightness.min, median(chromatic.map((r) => L(r.steps.at(-1).hex))));
  assert.equal(fit.lightness.max, median(chromatic.map((r) => L(r.steps[0].hex))));
  assert.deepEqual(fit.basis.skipped, ["legacy"]);
  assert.equal(fit.basis.ramps, 4);
  assert.equal(fit.basis.chromatic, 3);
  const audits = ramps.slice(0, 4).map((r) => auditRamp(r.steps));
  assert.equal(fit.evenness.max, Math.max(...audits.map((a) => a.evenness)));
  assert.equal(fit.hueDrift.max, Math.max(...audits.map((a) => a.hueDrift)));
});

test("a ramp built with the fit lands on the system's ends", () => {
  const fit = fitToSystem(systemRamps());
  const r = ramp({ anchors: [{ hex: "#7a3fd1" }], steps: fit.steps, lightness: fit.lightness });
  assert.ok(Math.abs(hexToOklch(r.steps.at(-1).hex).l - fit.lightness.min) < 0.005);
  assert.ok(Math.abs(hexToOklch(r.steps[0].hex).l - fit.lightness.max) < 0.005);
});

test("a system of neutrals only still fits, from all its ramps", () => {
  const fit = fitToSystem([systemRamps()[3]]);
  assert.equal(fit.basis.chromatic, 0);
  assert.equal(fit.lightness.min, hexToOklch(systemRamps()[3].steps.at(-1).hex).l);
});

test("fit refuses an empty system: use the defaults instead", () => {
  assert.throws(() => fitToSystem([]), /no ramps/);
});

// ── nameColor ───────────────────────────────────────────────────────────────────────────────────────
const { nameColor } = engine;

test("a colour on the name list takes its own name", () => {
  assert.deepEqual(nameColor("#9F381D"), { name: "Cognac", slug: "cognac", hex: "#9f381d", distance: 0, exact: true });
  assert.equal(nameColor("#0b0b0b").slug, "cod-gray");
});

test("any other colour takes the nearest name on the list", () => {
  assert.deepEqual(nameColor("#14d7fb"), { name: "Bright Turquoise", slug: "bright-turquoise", hex: "#08e8de", distance: nameColor("#14d7fb").distance, exact: false });
  assert.equal(nameColor("#2b67b9").name, "Cerulean Blue");
  assert.equal(nameColor("#abc").name, nameColor("#aabbcc").name);
});

test("names already in the system are passed over for the next nearest", () => {
  const first = nameColor("#14d7fb");
  const second = nameColor("#14d7fb", { exclude: ["Bright Turquoise"] });
  assert.notEqual(second.slug, first.slug);
  assert.ok(second.distance >= first.distance);
  assert.equal(nameColor("#14d7fb", { exclude: ["bright-turquoise"] }).slug, second.slug);
});

test("nameColor refuses what is not a colour", () => {
  assert.throws(() => nameColor("blue"), /not a colour/);
});

// ── published entry ─────────────────────────────────────────────────────────────────────────────────
test("handoff-css/color-engine is the published entry and carries the whole interface", async () => {
  const pub = await import("handoff-css/color-engine");
  assert.deepEqual(Object.keys(pub).sort(), ["DEFAULTS", "auditRamp", "fitToSystem", "mergeVerdict", "nameColor", "ramp"]);
  assert.equal(pub.ramp, ramp);
});
