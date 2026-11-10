// Name a colour from the Name that Color list: the entry nearest by squared RGB distance plus twice the
// squared HSL distance (both on a 0–255 scale), which is how that list is meant to be matched.
import { NAMES } from "./names.mjs";

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** HSL on a 0–255 scale, truncated, the way the list's own matcher computes it. */
function hsl255([R, G, B]) {
  const [r, g, b] = [R / 255, G / 255, B / 255];
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const delta = max - min;
  const l = (min + max) / 2;
  const s = l > 0 && l < 1 ? delta / (l < 0.5 ? 2 * l : 2 - 2 * l) : 0;
  let h = 0;
  if (delta > 0) {
    if (max === r && max !== g) h += (g - b) / delta;
    if (max === g && max !== b) h += 2 + (b - r) / delta;
    if (max === b && max !== r) h += 4 + (r - g) / delta;
    h /= 6;
  }
  return [Math.trunc(h * 255), Math.trunc(s * 255), Math.trunc(l * 255)];
}

const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const LIST = NAMES.map(([hex, name]) => {
  const rgb = channels("#" + hex);
  return { hex: "#" + hex, name, slug: slugOf(name), rgb, hsl: hsl255(rgb) };
});

/** The nearest name for a colour. Names in `exclude` (as written or as slugs) are passed over.
 *  @param {string} hex  #rgb or #rrggbb
 *  @param {{ exclude?: string[] }} [options]
 *  @returns {{ name: string, slug: string, hex: string, distance: number, exact: boolean }} */
export function nameColor(hex, { exclude = [] } = {}) {
  if (typeof hex !== "string" || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) throw new TypeError(`${JSON.stringify(hex)} is not a colour (#rgb or #rrggbb)`);
  const full = (hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex).toLowerCase();
  const skip = new Set(exclude.map(slugOf));
  const rgb = channels(full);
  const hsl = hsl255(rgb);
  let best = null;
  for (const e of LIST) {
    if (skip.has(e.slug)) continue;
    const d = sq(rgb, e.rgb) + 2 * sq(hsl, e.hsl);
    if (!best || d < best.distance) best = { name: e.name, slug: e.slug, hex: e.hex, distance: d, exact: e.hex === full };
    if (best.exact) break;
  }
  return best;
}

const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
