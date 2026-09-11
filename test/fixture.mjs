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

/**
 * A THIRD real export, `fixtures/jhd-v8-2026-09-10/export.json` — schema 8,
 * exported 2026-09-10T20:03Z, copied verbatim from the plugin's own artifact
 * (sha256 7622dde8…). It is the fixture for CELL TRUST: 100 of its `device/*`
 * build cells are self-contradicting (`conversionStrategy: "identity"` with
 * `rawValue !== convertedValue` — e.g. `device/container-max-width` raw 2156px,
 * converted 100, `css: "100vw"`), and 60-odd of its `responsiveBehavior` rules
 * name a viewport class for a `grid/col-span/*` or a `text` letter-spacing
 * variable that is not a fraction of the screen at all. Both are what
 * `test/cell-trust.test.mjs` holds the generator to.
 */
export const docV8 = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v8-2026-09-10", "export.json"), "utf8"),
  );

/**
 * A FOURTH real export, `fixtures/jhd-v8b-2026-09-10/export.json` — schema 8,
 * exported 2026-09-10T21:19Z, the plugin's next revision: every
 * `responsiveBehavior` rule now carries its own `viewportFraction` alongside
 * `strategy` and `css` (Workstream C's ask, one step further than `docV8`'s
 * export). It is the fixture for consuming that field as a fraction source —
 * see `test/responsive.test.mjs`.
 */
export const docV8b = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v8b-2026-09-10", "export.json"), "utf8"),
  );

export const V8B = path.join(path.dirname(FIXTURE), "jhd-v8b-2026-09-10");

/**
 * `fixtures/jhd-v8b-2026-09-10/styles.css` — the CONSUMER'S stylesheet as it
 * ships after adopting 0.2.0, copied verbatim from `jhd-design-system`'s
 * `src/styles.css` at the commit that adopted it (WS-B step 7). It is the same
 * file as `jhd-v7b/styles.css` minus the eighteen hand-authored
 * `--screen-height-*` / `--height-screen-*` declarations, whose comment block
 * became a pointer at the `aliases` config: a hand-authored GLOBAL declaration
 * suppresses generation (P2) and collides with the alias block (P12), so the
 * deletion is not optional.
 *
 * This was a filter over `jhd-v7b/styles.css` until the consumer actually
 * landed the deletion. A derived fixture could only ever prove the generator
 * against a stylesheet no repo shipped; this one is pinned byte-for-byte in
 * both directions — `jhd-design-system`'s own
 * `test/handoff-css-fixture-parity.test.mjs` fails if the two drift.
 * (Generation is identical either way, which is how the swap was verified.)
 */
export const consumerCss = () => readFileSync(path.join(V8B, "styles.css"), "utf8");

/** `expected/*` for the v8b fixture — see `expectedV8b`'s note below. */
export const expectedV8b = (file) =>
  readFileSync(path.join(V8B, "expected", file), "utf8");

/**
 * The consumer's config as `jhd-design-system/handoff.config.mjs` actually
 * resolves it: the house preset, with the two strings the generator writes
 * into its own output as pointers back at the consuming repo. Neither can be
 * correct in a preset other consumers copy, and the v8b `expected/*` files are
 * that repo's committed artifacts, so reproducing them needs the real pair.
 */
export const consumerConfig = {
  ...preset,
  report: { ...preset.report, policyRef: "docs/handoff-css.md" },
  header: { ...preset.header, regenerateCommand: "pnpm run tokens" },
};

/**
 * A FIFTH real export, `fixtures/jhd-v9-2026-09-11/export.json` — schema 9,
 * generated 2026-09-11T06:35:12.600Z, same design-system state as `docV8b()`
 * (`bb6a0025…7224`). `changes.schema[9]` (per the companion `.md`): viewport
 * classes are now gated by designer signal (a reference-variable group or a
 * screen-percentage description) rather than by group alone, and
 * `viewportFraction` values are snapped to the nearest whole percent. Same
 * JSON shape as schema 8 — see `docs/POLICIES.md` P14 for the diff that
 * justified one schema file instead of two.
 */
export const docV9 = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v9-2026-09-11", "export.json"), "utf8"),
  );

export const V9 = path.join(path.dirname(FIXTURE), "jhd-v9-2026-09-11");

/** `expected/*` for the v9 fixture — generated by this package's own CLI
 * against `docV9()` + `consumerConfig` + v8b's `consumerCss()` (same consumer,
 * same hand-authored stylesheet; only the export moved). */
export const expectedV9 = (file) =>
  readFileSync(path.join(V9, "expected", file), "utf8");
