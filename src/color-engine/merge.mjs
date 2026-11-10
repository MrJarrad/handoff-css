// Does a set of colours make sense as one ramp? Build the merged ramp and audit it against the system's
// own ramps (or, with no system, against what the default ramps do). The classic pairing rule (one hue,
// at least two steps apart) is reported as a reason but does not decide.
import { hexToOklch } from "./color.mjs";
import { ramp, DEFAULTS } from "./build.mjs";

/** Widest evenness (spread of lightness drops) a default single-anchor ramp makes, over a sweep of hues
 *  every 30°, L 0.30–0.90 and chroma 0.02–0.20. The from-scratch evenness bar. */
export const DEFAULT_EVENNESS_MAX = 0.0319;
/** From-scratch hue drift bar, degrees. */
export const DEFAULT_HUE_DRIFT_MAX = 50;

// Pairing rule.
const PAIR_HUE = 10; // degrees
const PAIR_NEUTRAL_C = 0.03; // below this chroma the hue is noise
const PAIR_PURE_C = 0.004; // below this there is no tint at all: counts as cool
const PAIR_MIN_GAP = 2; // steps
const isWarmHue = (h) => h <= 150 || h >= 330;
const temperature = (o) => (o.c < PAIR_PURE_C ? "cool" : isWarmHue(o.h) ? "warm" : "cool");
const hueDist = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** @typedef {{ check: "lightness" | "evenness" | "hue drift" | "pairing", pass: boolean, veto: boolean, text: string }} Reason */

/** Verdict on merging anchors into one ramp.
 *  `system` is a `fitToSystem` result; without it the defaults apply.
 *  @param {{ anchors: import("./build.mjs").Anchor[], steps?: number[], system?: { steps: number[], lightness: object, evenness: { max: number }, hueDrift: { max: number } } }} input
 *  @returns {{ merge: boolean, reasons: Reason[], ramp: ReturnType<typeof ramp> }} */
export function mergeVerdict({ anchors, steps, system }) {
  if (!Array.isArray(anchors) || anchors.length < 2) throw new TypeError("mergeVerdict needs two or more anchors");
  const r = ramp({ anchors, steps: steps ?? system?.steps ?? DEFAULTS.steps, lightness: system?.lightness ?? {} });
  const scale = r.steps.map((s) => s.step);
  const against = system ? "the system's own ramps" : "the default ramps";
  const reasons = [];

  const ls = r.steps.map((s) => hexToOklch(s.hex).l);
  const turn = ls.findIndex((l, i) => i > 0 && l >= ls[i - 1]);
  reasons.push({
    check: "lightness",
    pass: turn < 0,
    veto: true,
    text: turn < 0 ? "gets darker at every step" : `step ${scale[turn]} is not darker than step ${scale[turn - 1]}`,
  });

  const evenMax = system ? system.evenness.max : DEFAULT_EVENNESS_MAX;
  const even = r.audit.evenness;
  reasons.push({ check: "evenness", pass: even <= evenMax, veto: true, text: `evenness ${even} ${even <= evenMax ? "≤" : ">"} ${evenMax}, the widest of ${against}` });

  const driftMax = system ? system.hueDrift.max : DEFAULT_HUE_DRIFT_MAX;
  const drift = r.audit.hueDrift;
  reasons.push({ check: "hue drift", pass: drift <= driftMax, veto: true, text: `hue drift ${drift}° ${drift <= driftMax ? "≤" : ">"} ${driftMax}°, the widest of ${against}` });

  reasons.push(pairing(r.placement, scale));
  return { merge: reasons.every((x) => x.pass || !x.veto), reasons, ramp: r };
}

/** The pairing rule over every pair of anchors: the first failure, or a pass. */
function pairing(placement, scale) {
  const fail = (text) => ({ check: "pairing", pass: false, veto: false, text: `pairing rule: ${text}` });
  for (let i = 0; i < placement.length; i++)
    for (let j = i + 1; j < placement.length; j++) {
      const [a, b] = [placement[i], placement[j]];
      const [oa, ob] = [hexToOklch(a.hex), hexToOklch(b.hex)];
      const gap = Math.abs(scale.indexOf(a.step) - scale.indexOf(b.step));
      if (gap < PAIR_MIN_GAP) return fail(`${a.hex} and ${b.hex} are ${gap} step apart (needs ${PAIR_MIN_GAP})`);
      const [an, bn] = [oa.c < PAIR_NEUTRAL_C, ob.c < PAIR_NEUTRAL_C];
      if (an !== bn) return fail(`${an ? a.hex : b.hex} is a near-neutral with a colour`);
      if (an && bn && temperature(oa) !== temperature(ob)) return fail(`${a.hex} and ${b.hex} are warm and cool neutrals`);
      const d = hueDist(oa.h, ob.h);
      if (!an && d > PAIR_HUE) return fail(`${a.hex} and ${b.hex} hues are ${d.toFixed(1)}° apart (allows ${PAIR_HUE}°)`);
    }
  return { check: "pairing", pass: true, veto: false, text: `pairing rule: one hue, at least ${PAIR_MIN_GAP} steps apart` };
}
