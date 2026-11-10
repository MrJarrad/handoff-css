// ramp(): the entry that builds a ramp through one or more anchors on any step scale.
import { formatHex } from "culori";
import { hexToOklch } from "./color.mjs";
import { generateRamp, generateRampMulti, nearestStep, auditRamp, DEFAULT_LIGHT_MIN } from "./ramp.mjs";



/** A from-scratch system: steps 100–900, darkest step at L 0.30, lightest step as light as the hue's
 *  gamut allows (`max` undefined). */
export const DEFAULTS = Object.freeze({
  steps: Object.freeze([100, 200, 300, 400, 500, 600, 700, 800, 900]),
  lightness: Object.freeze({ min: DEFAULT_LIGHT_MIN, max: undefined }),
});

/** @typedef {{ hex: string, step?: number }} Anchor
 *  @typedef {{ min?: number, max?: number }} Lightness  OKLCH L of the darkest and lightest step
 *  @typedef {{ step: number, hex: string, anchor?: true }} Step */

/** Build a ramp through one or more anchors.
 *  An anchor without a step is placed where it reads most naturally; unplaced anchors that collide move to
 *  the nearest free step. Each anchor's hex appears unchanged at its step.
 *  @param {{ anchors: Anchor[], steps?: number[], lightness?: Lightness }} input
 *  @returns {{ steps: Step[], placement: { hex: string, step: number, given: boolean }[], audit: ReturnType<typeof auditRamp> }} */
export function ramp({ anchors, steps = DEFAULTS.steps, lightness = {} }) {
  const scale = checkSteps(steps);
  if (!Array.isArray(anchors) || !anchors.length) throw new TypeError("ramp needs at least one anchor");
  const bounds = { lightMin: lightness.min, lightMax: lightness.max };
  const placement = place(anchors.map(normaliseAnchor), scale, bounds);

  const out =
    placement.length === 1
      ? generateRamp({ seedHex: placement[0].hex, steps: scale, anchorStep: placement[0].step, ...bounds })
      : generateRampMulti({ anchors: placement, steps: scale, ...bounds });
  const at = new Map(placement.map((p) => [p.step, p.hex]));
  const result = out.map((s) => (at.has(s.step) ? { step: s.step, hex: at.get(s.step), anchor: true } : s));
  return { steps: result, placement, audit: auditRamp(result) };
}

function checkSteps(steps) {
  const scale = [...steps].sort((a, b) => a - b);
  if (scale.length < 2 || scale.some((s) => !Number.isFinite(s))) throw new TypeError("steps must be two or more numbers");
  if (new Set(scale).size !== scale.length) throw new TypeError("steps must be distinct");
  return scale;
}

function normaliseAnchor(a) {
  const hex = typeof a?.hex === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(a.hex) ? formatHex(a.hex) : undefined;
  if (!hex) throw new TypeError(`${JSON.stringify(a?.hex)} is not a colour (#rgb or #rrggbb)`);
  return { hex, step: a.step };
}

/** Given steps first; then unplaced anchors, lightest first, each at its natural step or the nearest free
 *  one (darker side first). */
function place(anchors, scale, bounds) {
  const used = new Set();
  const placed = [];
  for (const a of anchors.filter((x) => x.step !== undefined)) {
    if (!scale.includes(a.step)) throw new RangeError(`anchor step ${a.step} is not one of the steps (${scale.join(", ")})`);
    if (used.has(a.step)) throw new RangeError(`two anchors at step ${a.step}`);
    used.add(a.step);
    placed.push({ hex: a.hex, step: a.step, given: true });
  }
  const unplaced = anchors.filter((x) => x.step === undefined);
  const byLight = unplaced.map((a) => ({ a, l: hexToOklch(a.hex).l })).sort((x, y) => y.l - x.l);
  for (const { a } of byLight) {
    const idx = nearestFreeIndex(scale.indexOf(nearestStep(a.hex, scale, bounds)), used, scale);
    if (idx < 0) throw new RangeError("more anchors than steps");
    used.add(scale[idx]);
    placed.push({ hex: a.hex, step: scale[idx], given: false });
  }
  return placed.sort((x, y) => x.step - y.step);
}

function nearestFreeIndex(idx, used, scale) {
  if (!used.has(scale[idx])) return idx;
  for (let d = 1; d < scale.length; d++) for (const i of [idx + d, idx - d]) if (i >= 0 && i < scale.length && !used.has(scale[i])) return i;
  return -1;
}
