// The one fixture every test in this package runs against: a real committed
// design system's export, its hand-authored stylesheet, and the four artifacts
// its own in-repo generator produced before this package existed.
//
// `expected/*` is what makes the fixture worth having — the expectations are
// files, produced by other code, not values recomputed here.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import preset from "../presets/jhd.config.mjs";

export const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "jhd-v7b",
);

export const read = (...p) => readFileSync(path.join(FIXTURE, ...p), "utf8");

/** A fresh parse each call, so a test that mutates cannot leak into another. */
export const doc = () => JSON.parse(read("export.json"));

/**
 * A SECOND real export, `fixtures/jhd-v7c/export.json` — same design system,
 * same schema (7), re-exported 2026-09-10T19:39Z after the operator filled in
 * three blank variable descriptions. It is the fixture for the description
 * convention: `device/screen-height/full` gained "100% of screen height", and
 * `device/width` gained "20% of screen width" — which is WRONG (it is
 * full-bleed) and is kept here deliberately, because the generator emitting a
 * wrong token from a wrong description is the behaviour under test.
 */
export const docV7c = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v7c", "export.json"), "utf8"),
  );
export const handAuthoredCss = () => read("styles.css");
export const expected = (file) => read("expected", file);

/**
 * The house preset as shipped — 0.2.0 behaviour: the viewport classes are
 * honoured and the alias block is emitted.
 */
export { preset };

/**
 * The same preset with every 0.2.0 behaviour pinned off, which is exactly what
 * 0.1.0 did. `expected/*` was generated before this package existed, so every
 * test that compares against those files uses this config; the 0.2.0 deltas
 * are asserted against the preset in `responsive.test.mjs` and
 * `aliases.test.mjs`.
 */
export const config = {
  ...preset,
  responsive: { honourClasses: [] },
  viewport: { ...preset.viewport, descriptionFallback: false },
  aliases: {},
};
