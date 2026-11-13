// Ramp generation, placement and audit, in OKLCH.
//
// Each anchor keeps its exact colour at its step and the ramp is built outward from it toward a light
// end ("off white") and a dark end ("off black"). One eased distance from the anchor moves lightness,
// hue and chroma together. Hue is held to the anchor except in the dark tail, where a hue that goes flat
// when dark drifts toward the nearer hue that keeps chroma there. Chroma follows the anchor's own level,
// flexed partly by how wide the sRGB gamut is at each step.
import { hexToOklch, oklchToHex, maxChroma, hslLightness } from "./color.mjs";

/** @typedef {{ step: number, hex: string }} RampStep */

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// ── Dark-tail hue drift ─────────────────────────────────────────────────────────────────────────────
// When dark, sRGB keeps rich chroma only near red (~25°) and blue (~265°). A hue that goes flat when dark
// (yellow, cyan) drifts toward the nearer of the two, scaled by how starved of chroma it is at L 0.3 and
// capped at RELIEF_MAX. A hue that holds chroma when dark does not drift; a near-neutral does not drift.
const RELIEF_MAX = 30;
const RELIEF_PROBE_L = 0.3;
const RELIEF_RICH = 0.1;
const DARK_RICH_HUES = [25, 265];
export function defaultDarkHueShift(seedHex) {
  const o = hexToOklch(seedHex);
  if (o.c < 0.02) return 0;
  const starvation = clamp((RELIEF_RICH - maxChroma(RELIEF_PROBE_L, o.h)) / RELIEF_RICH, 0, 1);
  if (starvation <= 0) return 0;
  const dist = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };
  const toward = DARK_RICH_HUES.reduce((a, b) => (dist(o.h, b) < dist(o.h, a) ? b : a));
  let dh = toward - o.h;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  return clamp(dh, -RELIEF_MAX, RELIEF_MAX) * starvation;
}

// ── Easing ──────────────────────────────────────────────────────────────────────────────────────────
// Placement ladder gamma: equal OKLCH-L steps look bunched in the darks, so the ladder spreads them.
const LIGHTNESS_GAMMA = 1.4;
// Ease-in-out exponent from an anchor toward an end. 1.0 = uniform lightness steps.
const BRAND_EASE = 1;
// The lightest step keeps at least this much lightness above an anchor that has steps above it.
const LIGHT_GAP = 0.03;
// A very light anchor (L > 0.9) eases harder so its brightness holds into the steps just below it.
const LIGHT_HOLD = 0.4;
const LIGHT_HOLD_L = 0.9;
const easeKFor = (lBrand) => BRAND_EASE + LIGHT_HOLD * clamp((lBrand - LIGHT_HOLD_L) / (1 - LIGHT_HOLD_L), 0, 1);
/** Symmetric ease-in-out by exponent k: gentle at both ends, steepest at t = 0.5. */
function easeFromBrand(t, k = BRAND_EASE) {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? 0.5 * Math.pow(2 * c, k) : 1 - 0.5 * Math.pow(2 * (1 - c), k);
}
/** Gamma-warped position 0..1 along the ramp (0 = lightest step). */
function rampG(step, first, last) {
  return Math.pow((step - first) / (last - first || 1), LIGHTNESS_GAMMA);
}

// ── Chroma ──────────────────────────────────────────────────────────────────────────────────────────
// Every step targets the anchor's own chroma, flexed by (gamut here / gamut at the anchor) ^ SPIRIT.
// 0 would hold the anchor's chroma everywhere; 1 would ride the gamut fully. A very faint tint
// (below TINT_FLAT_LO) is held flat; from TINT_FLEX_HI up it flexes fully.
const SPIRIT = 0.55;
const gamutAtBrand = (lBrand, hBrand) => maxChroma(lBrand, hBrand) || 1e-3;
const TINT_FLAT_LO = 0.013;
const TINT_FLEX_HI = 0.022;
const smooth01 = (t) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const spiritFor = (cBrand) => SPIRIT * smooth01((cBrand - TINT_FLAT_LO) / (TINT_FLEX_HI - TINT_FLAT_LO));
/** Chroma at a step. On the light side the gamut ratio is capped at 1: a tint never out-vivids its anchor. */
const chromaAt = (cBrand, gBrand, l, h, capLight = false) => {
  const gHere = maxChroma(l, h);
  let ratio = Math.pow(gHere / gBrand, spiritFor(cBrand));
  if (capLight) ratio = Math.min(ratio, 1);
  return Math.min(cBrand * ratio, gHere);
};

// ── Light end ───────────────────────────────────────────────────────────────────────────────────────
// The lightest step goes as close to white as the hue's gamut allows before the chroma jump between the
// two lightest steps exceeds LIGHT_JUMP_MAX. Neutrals reach LIGHT_CEIL_HI; a hue whose gamut collapses
// near white settles lower, never below LIGHT_CEIL_LO.
const LIGHT_CEIL_HI = 0.975;
const LIGHT_CEIL_LO = 0.88;
const LIGHT_JUMP_MAX = 0.09;
function lightCeiling(l, c, h, easeK, nLight) {
  if (nLight < 2) return LIGHT_CEIL_HI;
  const gBrand = gamutAtBrand(l, h);
  const e200 = easeFromBrand((nLight - 1) / nLight, easeK);
  const jumpAt = (ceil) => {
    const pMax = Math.max(ceil, l + LIGHT_GAP);
    const c100 = chromaAt(c, gBrand, pMax, h);
    const c200 = chromaAt(c, gBrand, l + e200 * (pMax - l), h);
    return c200 - c100;
  };
  for (let ceil = LIGHT_CEIL_HI; ceil >= LIGHT_CEIL_LO; ceil -= 5e-3) if (jumpAt(ceil) <= LIGHT_JUMP_MAX) return ceil;
  return LIGHT_CEIL_LO;
}

/** Default lightness of the darkest step. */
export const DEFAULT_LIGHT_MIN = 0.3;

// ── Placement ───────────────────────────────────────────────────────────────────────────────────────
// A light, saturated colour (a fluorescent yellow) reads more central than its OKLCH lightness says, so
// placement lightness is pulled toward HSL lightness in proportion to saturation, above L 0.62 only.
const SAT_PULL = 0.1;
const SAT_FULL = 0.13;
const SAT_PULL_FLOOR = 0.62;
/** Lightness used to place a colour on a ramp (intensity-aware). */
export function placementLightness(hex) {
  const o = hexToOklch(hex);
  const sat = clamp(o.c / SAT_FULL, 0, 1);
  const lightGate = clamp((o.l - SAT_PULL_FLOOR) / (1 - SAT_PULL_FLOOR), 0, 1);
  return o.l + SAT_PULL * sat * lightGate * (hslLightness(hex) - o.l);
}

/** A ramp through one anchor, which keeps its colour (round-tripped through OKLCH) at `anchorStep`.
 *  @param {{ seedHex: string, steps: number[], anchorStep: number, lightMin?: number, lightMax?: number }} opts
 *  @returns {RampStep[]} */
export function generateRamp(opts) {
  const seed = hexToOklch(opts.seedHex);
  const sorted = [...opts.steps].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const lightMax = opts.lightMax ?? lightCeiling(seed.l, seed.c, seed.h, easeKFor(seed.l), sorted.indexOf(opts.anchorStep));
  const lightMin = opts.lightMin ?? DEFAULT_LIGHT_MIN;
  // The light end clears an anchor that has steps above it; a very dark anchor with steps below it gets
  // room below its own lightness instead of collapsing onto it.
  const pMax = opts.anchorStep > first ? Math.max(lightMax, seed.l + LIGHT_GAP) : Math.max(lightMax, seed.l);
  const needsDarkRoom = opts.anchorStep < last && seed.l <= lightMin;
  const pMin = needsDarkRoom ? seed.l * 0.7 : Math.min(lightMin, seed.l);
  // The dark-tail drift scales with how far the dark side reaches below the anchor.
  const darkShift = defaultDarkHueShift(opts.seedHex) * clamp((seed.l - pMin) / 0.5, 0, 1);
  const gBrand = gamutAtBrand(seed.l, seed.h);
  const easeK = easeKFor(seed.l);
  const aIdx = sorted.indexOf(opts.anchorStep);
  const nLight = aIdx;
  const nDark = sorted.length - 1 - aIdx;

  return sorted.map((step, idx) => {
    if (idx === aIdx) return { step, hex: oklchToHex({ l: seed.l, c: seed.c, h: seed.h }) };
    const dark = idx > aIdx;
    const p = dark ? (idx - aIdx) / (nDark || 1) : (aIdx - idx) / (nLight || 1);
    const e = easeFromBrand(p, easeK);
    const l = dark ? seed.l - e * (seed.l - pMin) : seed.l + e * (pMax - seed.l);
    const h = seed.h + e * (dark ? darkShift : 0);
    const c = chromaAt(seed.c, gBrand, l, h, l > seed.l);
    return { step, hex: oklchToHex({ l, c, h }) };
  });
}

/** A ramp through several anchors, each reproduced exactly. Segments run between knots: an off-white knot
 *  at the lightest step, each anchor, and an off-black knot at the darkest step. Within a segment lightness,
 *  hue (shortest path between two anchors) and chroma move on one ease. The dark tail takes the dark-tail
 *  drift of the darkest anchor, scaled by the tail's length.
 *  @param {{ anchors: RampStep[], steps: number[], lightMin?: number, lightMax?: number }} opts
 *  @returns {RampStep[]} */
export function generateRampMulti(opts) {
  const lightMin = opts.lightMin ?? DEFAULT_LIGHT_MIN;
  const steps = [...opts.steps].sort((a, b) => a - b);
  if (!opts.anchors.length) return steps.map((step) => ({ step, hex: "#000000" }));
  const first = steps[0];
  const last = steps[steps.length - 1];
  const norm = (h) => ((h % 360) + 360) % 360;
  const A = [...opts.anchors]
    .sort((a, b) => a.step - b.step)
    .map((a) => {
      const o = hexToOklch(a.hex);
      return { step: a.step, hex: a.hex, l: o.l, h: o.h, c: o.c };
    });
  const lightMax = opts.lightMax ?? lightCeiling(A[0].l, A[0].c, A[0].h, easeKFor(A[0].l), steps.filter((s) => s < A[0].step).length);
  const eMax = Math.max(lightMax, ...A.map((a) => (a.step > first ? a.l + LIGHT_GAP : a.l)));
  const darkA = A[A.length - 1];
  const eMin = darkA.step < last && darkA.l <= lightMin ? darkA.l * 0.7 : Math.min(lightMin, ...A.map((a) => a.l));
  const knots = A.map((a) => ({ step: a.step, l: a.l, h: a.h, cBrand: a.c, gBrand: gamutAtBrand(a.l, a.h), anchor: true, darkShift: 0 }));
  const lightest = A[0];
  const darkest = A[A.length - 1];
  const easeK = easeKFor(lightest.l);
  if (lightest.step > first) knots.unshift({ step: first, l: eMax, h: lightest.h, cBrand: lightest.c, gBrand: gamutAtBrand(lightest.l, lightest.h), anchor: false, darkShift: 0 });
  if (darkest.step < last) {
    const tailScale = clamp((darkest.l - eMin) / 0.5, 0, 1);
    knots.push({ step: last, l: eMin, h: darkest.h, cBrand: darkest.c, gBrand: gamutAtBrand(darkest.l, darkest.h), anchor: false, darkShift: defaultDarkHueShift(darkest.hex) * tailScale });
  }

  const anchorByStep = new Map(A.map((a) => [a.step, a.hex]));
  return steps.map((step) => {
    const exact = anchorByStep.get(step);
    if (exact) return { step, hex: exact };
    let k0 = knots[0];
    let k1 = knots[knots.length - 1];
    for (let i = 0; i < knots.length - 1; i++) {
      if (step >= knots[i].step && step <= knots[i + 1].step) {
        k0 = knots[i];
        k1 = knots[i + 1];
        break;
      }
    }
    const t = (step - k0.step) / (k1.step - k0.step || 1);
    const e = easeFromBrand(t, easeK);
    const l = clamp(k0.l + e * (k1.l - k0.l), 0, 1);
    let h;
    if (k0.anchor && k1.anchor) {
      let dh = k1.h - k0.h;
      if (dh > 180) dh -= 360;
      else if (dh < -180) dh += 360;
      h = k0.h + e * dh;
    } else if (!k1.anchor) {
      h = k0.h + e * k1.darkShift;
    } else {
      h = k1.h;
    }
    const hue = norm(h);
    const cRef = k0.cBrand + e * (k1.cBrand - k0.cBrand);
    const gRef = k0.gBrand + e * (k1.gBrand - k0.gBrand);
    const gHere = maxChroma(l, hue);
    const ratio = Math.pow(gHere / gRef, spiritFor(cRef));
    const c = Math.min(cRef * (l > lightest.l ? Math.min(ratio, 1) : ratio), gHere);
    return { step, hex: oklchToHex({ l, c, h: hue }) };
  });
}

// Placement ladder: lightness of a step on a gamma-warped white→black ladder. Its ends are the ends the ramp
// is generated to when the caller names them (a fitted system's, or its own: `lightMax`, `lightMin`), so a
// colour is placed on the ladder its ramp will be built on. With none named, the ladder is this default pair,
// which is not the generation default (a per-hue light ceiling and DEFAULT_LIGHT_MIN).
const LADDER_LIGHT_MAX = 0.98;
const LADDER_LIGHT_MIN = 0.14;
function ladderLightness(step, steps, lightMax = LADDER_LIGHT_MAX, lightMin = LADDER_LIGHT_MIN) {
  const first = Math.min(...steps);
  const last = Math.max(...steps);
  return lightMax - rampG(step, first, last) * (lightMax - lightMin);
}

// A fully saturated colour may sit no lighter than a quarter of the way down the ramp (300 on 100–900).
const VIBRANCY_FLOOR_POS = 0.25;
// A colour no lighter than this is placed on the last step (the default dark end of a generated ramp).
const GEN_DARK = DEFAULT_LIGHT_MIN;
// Below this chroma a colour is a near-neutral and is placed by lightness alone.
const NEUTRAL_C = 0.035;

/** Coefficient of variation of the OKLab distance between adjacent steps of the ramp placed at
 *  `anchorStep`. Lower reads more even. */
function rampEvenness(seedHex, steps, anchorStep, lightness) {
  const ramp = generateRamp({ seedHex, steps, anchorStep, ...lightness });
  const ds = [];
  let prev = null;
  for (const s of ramp) {
    const o = hexToOklch(s.hex);
    const a = o.c * Math.cos((o.h * Math.PI) / 180);
    const b = o.c * Math.sin((o.h * Math.PI) / 180);
    if (prev) ds.push(Math.hypot(o.l - prev.l, a - prev.a, b - prev.b));
    prev = { l: o.l, a, b };
  }
  const mean = ds.reduce((x, y) => x + y, 0) / (ds.length || 1);
  if (mean === 0) return 0;
  return Math.sqrt(ds.reduce((x, y) => x + (y - mean) ** 2, 0) / ds.length) / mean;
}

/** The step a colour occupies on a ramp with these steps (any scale). Its ladder rung by placement
 *  lightness, held no lighter than the vibrancy floor; a chromatic colour then takes whichever of that rung
 *  and its two neighbours gives the most even ramp. Works by step index, so 50–950 or 1–12 place the same
 *  way 100–900 does. The ladder runs between the `lightness` ends when they are named (the ends the ramp is
 *  generated to), and between 0.98 and 0.14 when they are not; a colour no lighter than `lightMin` (0.30 when
 *  not named) is placed on the last step.
 *  @param {string} seedHex @param {number[]} steps @param {{ lightMin?: number, lightMax?: number }} [lightness] */
export function nearestStep(seedHex, steps, lightness = {}) {
  const sorted = [...steps].sort((a, b) => a - b);
  const o = hexToOklch(seedHex);
  const L = placementLightness(seedHex);
  if (L <= (lightness.lightMin ?? GEN_DARK)) return sorted[sorted.length - 1];
  const rung = (s) => Math.abs(ladderLightness(s, sorted, lightness.lightMax, lightness.lightMin) - L);
  const byLight = sorted.reduce((best, s, i) => (rung(s) < rung(sorted[best]) ? i : best), 0);
  const sat = clamp(o.c / SAT_FULL, 0, 1);
  const floor = Math.round(sat * VIBRANCY_FLOOR_POS * (sorted.length - 1));
  const natural = Math.min(Math.max(byLight, floor), sorted.length - 1);
  if (o.c < NEUTRAL_C) return sorted[natural];
  const window = [natural - 1, natural, natural + 1].filter((i) => i >= 0 && i < sorted.length && i >= floor);
  const best = window.reduce((b, i) => (rampEvenness(seedHex, sorted, sorted[i], lightness) < rampEvenness(seedHex, sorted, sorted[b], lightness) ? i : b), window[0]);
  return sorted[best];
}

/** Smallest arc of the colour wheel holding every hue, in degrees. */
function hueSpread(hues) {
  if (hues.length < 2) return 0;
  const s = [...hues].sort((a, b) => a - b);
  const wrapGap = 360 - (s[s.length - 1] - s[0]);
  let gap = wrapGap;
  let at = -1;
  for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > gap) ((gap = s[i] - s[i - 1]), (at = i));
  return at < 0 ? s[s.length - 1] - s[0] : 360 - gap;
}

/** Audit a ramp: lightness drop per step, the spread of those drops (0 = perfectly even), and the hue
 *  spread over the steps with chroma above 0.05 (below that the hue is rounding noise).
 *  @param {RampStep[]} steps */
export function auditRamp(steps) {
  const sorted = [...steps].sort((a, b) => a.step - b.step);
  const rows = sorted.map((s, i) => {
    const oklch = hexToOklch(s.hex);
    const prev = i > 0 ? hexToOklch(sorted[i - 1].hex) : null;
    return { step: s.step, hex: s.hex, oklch, deltaL: prev ? +(prev.l - oklch.l).toFixed(4) : null };
  });
  const deltas = rows.map((r) => r.deltaL).filter((d) => d != null).map(Math.abs);
  const mean = deltas.reduce((a, b) => a + b, 0) / (deltas.length || 1);
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / (deltas.length || 1);
  const hueDrift = hueSpread(rows.filter((r) => r.oklch.c > 0.05).map((r) => r.oklch.h));
  return { rows, evenness: +Math.sqrt(variance).toFixed(4), hueDrift: +hueDrift.toFixed(1) };
}
