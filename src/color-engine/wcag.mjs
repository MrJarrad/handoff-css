// WCAG 2.x contrast grading: the ratio, and whether it clears AA for a use.
// Pure functions over culori.
import { wcagContrast } from "culori";

/** AA floors: 4.5 for body text, 3 for large text and non-text / UI. */
export const AA = Object.freeze({ text: 4.5, "large-text": 3, ui: 3 });

/** @typedef {"text" | "large-text" | "ui"} ContrastUse */

/** The WCAG 2.x contrast ratio of a foreground on a background, rounded to two places (1..21). */
export function contrast(fgHex, bgHex) {
  const r = wcagContrast(fgHex, bgHex);
  if (!Number.isFinite(r)) throw new TypeError(`contrast: ${JSON.stringify(fgHex)} on ${JSON.stringify(bgHex)} is not two colours`);
  return +r.toFixed(2);
}

/** Grade a foreground on a background for a use (default body text).
 *  @param {string} fgHex @param {string} bgHex @param {ContrastUse} [use]
 *  @returns {{ ratio: number, pass: boolean, floor: number }} */
export function grade(fgHex, bgHex, use = "text") {
  const floor = AA[use];
  if (floor === undefined) throw new RangeError(`unknown contrast use ${JSON.stringify(use)} (text, large-text, ui)`);
  const ratio = contrast(fgHex, bgHex);
  return { ratio, pass: ratio >= floor, floor };
}
