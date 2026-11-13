// A brand palette (a handful of hexes, no ramps) → the ramps a from-scratch web colour system needs.
// One ramp per brand colour (colours that make one ramp are merged), one neutral, and a ramp for each
// feedback role no brand hue already covers. Every ramp is the engine's default ramp; nothing here
// does colour maths of its own.
import { formatHex } from "culori";
import { hexToOklch, oklchToHex, maxChroma } from "./color.mjs";
import { ramp, DEFAULTS } from "./build.mjs";
import { mergeVerdict } from "./merge.mjs";

/** A mid-step chroma below this is a neutral (the same bar `fitToSystem` uses). */
const NEUTRAL_C = 0.035;
/** The conventional hue of each feedback role, OKLCH degrees. */
export const FEEDBACK_HUES = Object.freeze({ error: 25, success: 145, warning: 80, info: 255 });
export const PALETTE_DEFAULTS = Object.freeze({
  feedbackTolerance: 30, // a brand hue this near (degrees) covers a feedback role
  addFeedback: true, //     false: report an uncovered role, add no ramp
  pinEndStep: false, //     true: a brand hex that would land on an end step is pinned one step in
});
/** Colours this near in hue (degrees) are candidates for one ramp; `mergeVerdict` then decides. Different brand hues never merge. */
const SAME_HUE = 15;
const NEUTRAL_SEED = Object.freeze({ l: 0.6, c: 0.004 });
const FEEDBACK_SEED = Object.freeze({ l: 0.6, c: 0.15 });

const hueDist = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** @param {{ name: string, hex: string, step?: number }[]} colours
 *  @param {Partial<typeof PALETTE_DEFAULTS>} [options]
 *  @returns {{ ramps: object[], neutral: { from: "brand" | "derived", ramps: string[] },
 *    feedback: ({ role: string, hue: number, covers: string } | { role: string, hue: number, added: string } | { role: string, hue: number, gap: true })[],
 *    notes: { kind: "anchor-at-end-step", ramp: string, step: number }[] }} */
export function paletteToSystem(colours, options = {}) {
  const opt = { ...PALETTE_DEFAULTS, ...options };
  if (!Array.isArray(colours) || !colours.length) throw new TypeError("paletteToSystem needs at least one colour");
  const seen = new Set();
  const given = colours.map((c) => {
    if (seen.has(c?.name)) throw new TypeError(`duplicate colour name ${JSON.stringify(c.name)}`);
    seen.add(c?.name);
    const hex = typeof c?.hex === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.hex) ? formatHex(c.hex) : null;
    if (!hex) throw new TypeError(`${JSON.stringify(c?.hex)} is not a colour (#rgb or #rrggbb)`);
    const o = hexToOklch(hex);
    return { name: c.name, hex, step: c.step, o, neutral: o.c < NEUTRAL_C };
  });

  const groups = [];
  for (const c of given) {
    const home = groups.find((g) => !c.neutral && !g.neutral && g.members.every((m) => hueDist(m.o.h, c.o.h) <= SAME_HUE) && mergeVerdict({ anchors: [...g.members, c].map(({ hex, step }) => ({ hex, step })) }).merge);
    if (home) home.members.push(c);
    else groups.push({ name: c.name, neutral: c.neutral, members: [c] });
  }

  const notes = [];
  const ramps = groups.map((g) => build(g.name, g.members, "brand", opt, notes));
  const neutralBrand = groups.filter((g) => g.neutral);
  // An added ramp never takes a brand name: on a collision it gets a numbered suffix.
  const free = (name) => {
    const taken = new Set(ramps.map((r) => r.name));
    for (let n = 1, c = name; ; c = `${name}-${++n}`) if (!taken.has(c)) return c;
  };
  const darkest = [...given].sort((a, b) => a.o.l - b.o.l)[0];
  let neutralName = null;
  if (!neutralBrand.length) ramps.push(build((neutralName = free("neutral")), [{ hex: oklchToHex({ ...NEUTRAL_SEED, h: darkest.o.h }) }], "derived-neutral", opt, notes));

  const chromatic = ramps.filter((r) => r.source === "brand" && !groups.find((g) => g.name === r.name).neutral);
  const feedback = Object.entries(FEEDBACK_HUES).map(([role, hue]) => {
    const near = chromatic
      .map((r) => ({ r, d: Math.min(...r.placement.map((p) => hueDist(hexToOklch(p.hex).h, hue))) }))
      .filter((x) => x.d <= opt.feedbackTolerance)
      .sort((a, b) => a.d - b.d)[0];
    if (near) return { role, hue, covers: near.r.name };
    if (!opt.addFeedback) return { role, hue, gap: true };
    const seed = oklchToHex({ l: FEEDBACK_SEED.l, c: Math.min(FEEDBACK_SEED.c, maxChroma(FEEDBACK_SEED.l, hue)), h: hue });
    const added = free(role);
    ramps.push(build(added, [{ hex: seed }], "feedback", opt, notes));
    return { role, hue, added };
  });

  return {
    ramps,
    neutral: neutralBrand.length ? { from: "brand", ramps: neutralBrand.map((g) => g.name) } : { from: "derived", ramps: [neutralName] },
    feedback,
    notes,
  };
}

function build(name, members, source, opt, notes) {
  const anchors = members.map(({ hex, step }) => ({ hex, step }));
  let r = ramp({ anchors });
  const ends = [DEFAULTS.steps[0], DEFAULTS.steps.at(-1)];
  const end = source === "brand" && members.length === 1 && members[0].step === undefined ? r.placement.find((p) => ends.includes(p.step)) : undefined;
  if (end && opt.pinEndStep) {
    const inward = DEFAULTS.steps[DEFAULTS.steps.indexOf(end.step) + (end.step === ends[0] ? 1 : -1)];
    r = ramp({ anchors: [{ hex: members[0].hex, step: inward }] });
  } else if (end) notes.push({ kind: "anchor-at-end-step", ramp: name, step: end.step });
  return { name, source, steps: r.steps, placement: r.placement, audit: r.audit };
}
