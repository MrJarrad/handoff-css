// Step-mapping helpers: where a semantic colour lands on a ramp, per mode.
//   nearestPassingStep  the step closest to where a colour sits now that clears AA on every surface it meets
//   mirrorStep          a light-mode step's counterpart in dark mode, by lightness (the ramp is not symmetric)
//   pullBack            a step that clears AA by a wide margin, eased back toward the floor
// Pure functions; a ramp is `{ step: number, hex: string }[]` on any step scale.
import { hexToOklch, oklchToHex } from "./color.mjs";
import { grade } from "./wcag.mjs";

const byStep = (ramp) => [...ramp].sort((a, b) => a.step - b.step);

/** The step nearest `from` whose colour passes on EVERY surface; a tie goes to the lower step number.
 *  Null when no step passes.
 *  @param {{ step: number, hex: string }[]} ramp @param {number} from @param {string[]} surfaces
 *  @param {import("./wcag.mjs").ContrastUse} [use] @returns {number | null} */
export function nearestPassingStep(ramp, from, surfaces, use = "text") {
  const passing = byStep(ramp).filter((s) => surfaces.every((bg) => grade(s.hex, bg, use).pass));
  if (!passing.length) return null;
  return passing.reduce((best, s) => (Math.abs(s.step - from) < Math.abs(best.step - from) ? s : best)).step;
}

/** The step whose lightness mirrors the light step's across the ramp's own lightness range
 *  (target L = darkest + lightest - L of the step), by OKLCH L; a tie goes to the lower step number.
 *  A step the ramp does not have mirrors across the ends of the step scale instead.
 *  @param {{ step: number, hex: string }[]} ramp @param {number} lightStep @returns {number} */
export function mirrorStep(ramp, lightStep) {
  const steps = byStep(ramp).map((s) => ({ step: s.step, l: hexToOklch(s.hex).l }));
  const cur = steps.find((s) => s.step === lightStep);
  if (!cur) {
    const target = steps[0].step + steps.at(-1).step - lightStep;
    return steps.reduce((b, s) => (Math.abs(s.step - target) < Math.abs(b.step - target) ? s : b)).step;
  }
  const target = Math.min(...steps.map((s) => s.l)) + Math.max(...steps.map((s) => s.l)) - cur.l;
  return steps.reduce((b, s) => (Math.abs(s.l - target) < Math.abs(b.l - target) ? s : b)).step;
}

/** How far past the AA floor a colour must be before it counts as overshooting, and the other limits. */
export const PULL = Object.freeze({
  floor: 4.5, // AA body text
  eps: 0.04, // land a hair past the floor, not on the knife edge
  margin: 0.5, // only pull back a step that clears the floor by more than this (ratio units)
  minSpacing: 0.05, // OKLCH L kept from each neighbouring step
  moveCap: 0.05, // OKLCH L a step may move from its generated value
});

/** Pull an overshooting step back toward the floor: move its OKLCH lightness toward the surface until the
 *  ratio is a hair past 4.5, keeping its distance from both neighbours and at most `moveCap` from where it
 *  was, so the ramp stays monotonic and keeps its shape. Null when nothing should move: the step is not
 *  overshooting, it is an anchor, it has no room between its neighbours, or the clamp would drop it
 *  below the floor.
 *  @param {{ step: number, hex: string }[]} ramp @param {number} step @param {string} surface
 *  @param {{ anchor?: boolean }} [options] @returns {{ hex: string, from: string } | null} */
export function pullBack(ramp, step, surface, { anchor = false } = {}) {
  const sorted = byStep(ramp);
  const at = sorted.findIndex((s) => s.step === step);
  if (at < 0) throw new RangeError(`pullBack: step ${step} is not in the ramp`);
  const { hex } = sorted[at];
  if (anchor || grade(hex, surface).ratio - PULL.floor <= PULL.margin) return null;
  const o = hexToOklch(hex);
  const wcagAt = (l) => grade(oklchToHex({ ...o, l }), surface).ratio;
  let keep = o.l;
  let toward = hexToOklch(surface).l;
  for (let i = 0; i < 28; i++) {
    const mid = (keep + toward) / 2;
    if (wcagAt(mid) >= PULL.floor + PULL.eps) keep = mid;
    else toward = mid;
  }
  // The lighter neighbour has the higher L (a ramp runs light to dark as the step rises).
  const lighterL = at > 0 ? hexToOklch(sorted[at - 1].hex).l : 1;
  const darkerL = at < sorted.length - 1 ? hexToOklch(sorted[at + 1].hex).l : 0;
  const upper = Math.min(o.l + PULL.moveCap, lighterL - PULL.minSpacing);
  const lower = Math.max(o.l - PULL.moveCap, darkerL + PULL.minSpacing);
  if (upper < lower) return null;
  const nl = Math.min(upper, Math.max(lower, keep));
  if (wcagAt(nl) < PULL.floor) return null;
  if (Math.abs(nl - o.l) < 0.004) return null;
  return { hex: oklchToHex({ ...o, l: nl }), from: hex };
}
