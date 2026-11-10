// Colour maths for the color engine: OKLCH in and out, sRGB gamut limits, HSL lightness.
// Pure functions over culori.
import { converter, formatHex, rgb, toGamut, clampChroma } from "culori";

const toOklch = converter("oklch");
const intoGamut = toGamut("rgb", "oklch");

/** @typedef {{ l: number, c: number, h: number }} Oklch  l 0..1, chroma, hue in degrees */

/** Any CSS colour → OKLCH. An achromatic hue reads as 0. @returns {Oklch} */
export function hexToOklch(hex) {
  const o = toOklch(hex);
  if (!o) return { l: 0, c: 0, h: 0 };
  return { l: o.l, c: o.c, h: Number.isFinite(o.h) ? o.h : 0 };
}

/** OKLCH → #rrggbb, mapped into sRGB by chroma reduction (CSS Color 4), not by clipping. */
export function oklchToHex(o) {
  return formatHex(intoGamut({ mode: "oklch", l: o.l, c: o.c, h: o.h })) ?? "#000000";
}

/** HSL lightness, 0..1: the mean of the largest and smallest sRGB channel. A fully saturated hue reads
 *  about 0.5 here however light it looks, which makes it the intensity-aware placement signal. */
export function hslLightness(hex) {
  const c = rgb(hex);
  const r = c?.r ?? 0;
  const g = c?.g ?? 0;
  const b = c?.b ?? 0;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

/** The largest chroma sRGB can show at this lightness and hue. */
export function maxChroma(l, h) {
  const clamped = clampChroma({ mode: "oklch", l, c: 0.4, h }, "oklch");
  return clamped.c ?? 0;
}
