// Fit to an existing system: its step scale, where its ramps end in lightness, and how even and how
// hue-stable its own ramps are (the bar a merged ramp has to meet).
import { hexToOklch } from "./color.mjs";
import { auditRamp } from "./ramp.mjs";

// A ramp whose middle step has less chroma than this is a neutral; its ends are used only when the
// system has no colour ramps.
const NEUTRAL_C = 0.035;

/** @param {{ name: string, steps: { step: number, hex: string }[] }[]} ramps  the system's colour ramps
 *  @returns {{ steps: number[], lightness: { min: number, max: number }, evenness: { max: number }, hueDrift: { max: number },
 *    basis: { ramps: number, chromatic: number, darkest: [number, number], lightest: [number, number], skipped: string[] } }} */
export function fitToSystem(ramps) {
  if (!Array.isArray(ramps) || !ramps.length) throw new TypeError("fitToSystem: no ramps (use the defaults for a new system)");
  const scaleOf = (r) => r.steps.map((s) => s.step).sort((a, b) => a - b);
  const count = new Map();
  for (const r of ramps) {
    const k = scaleOf(r).join(",");
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  // The scale most ramps use; a tie goes to the longer scale, then the lower first step.
  const [key] = [...count].sort(([a, n], [b, m]) => m - n || b.split(",").length - a.split(",").length || parseFloat(a) - parseFloat(b))[0];
  const on = ramps.filter((r) => scaleOf(r).join(",") === key);
  const sorted = on.map((r) => [...r.steps].sort((a, b) => a.step - b.step));
  const chromatic = sorted.filter((s) => hexToOklch(s[Math.floor(s.length / 2)].hex).c >= NEUTRAL_C);
  const basis = chromatic.length ? chromatic : sorted;
  const darkest = basis.map((s) => hexToOklch(s.at(-1).hex).l);
  const lightest = basis.map((s) => hexToOklch(s[0].hex).l);
  const audits = sorted.map((s) => auditRamp(s));
  return {
    steps: key.split(",").map(Number),
    lightness: { min: median(darkest), max: median(lightest) },
    evenness: { max: Math.max(...audits.map((a) => a.evenness)) },
    hueDrift: { max: Math.max(...audits.map((a) => a.hueDrift)) },
    basis: {
      ramps: on.length,
      chromatic: chromatic.length,
      darkest: [Math.min(...darkest), Math.max(...darkest)],
      lightest: [Math.min(...lightest), Math.max(...lightest)],
      skipped: ramps.filter((r) => !on.includes(r)).map((r) => r.name),
    },
  };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
