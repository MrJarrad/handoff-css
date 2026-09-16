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
/**
 * The two 0.4.0 policies, pinned to their pre-0.4.0 behaviour.
 *
 * `expected/*` in `jhd-v7b`, `jhd-v8b`, `jhd-v9`, `jhd-v9b` and `jhd-v9c` are
 * committed artifacts of the design system AS IT WAS EXPORTED — motion steps
 * still named by index rather than by milliseconds (`duration/300` = 0.375s),
 * and `grid/aspect/*` still carrying one wrong description. Generating them
 * under the 0.4.0 house policy would restate those exports as something they
 * never said, so the fixtures state the policy they were produced under and
 * stay byte-stable. The 0.4.0 behaviour is asserted against `jhd-v9d`, the
 * export that carries it — exactly as the 0.2.0 deltas are asserted against
 * the preset rather than folded into these files.
 *
 * P19 `timingUnit: "s"`  — Figma's own unit, which is what 0.3.4 emitted.
 *     `delayAliasOf: null` — no delay/duration cross-check.
 * P20 `ratioPaths: []`     — no STRING variable is treated as a ratio.
 */
export const PRE_0_4_0 = {
  motion: { timingUnit: "s", delayAliasOf: null },
  aspect: { ratioPaths: [], descriptionGroup: null, descriptionPattern: null },
};

export const config = {
  ...preset,
  responsive: { honourClasses: [] },
  viewport: { ...preset.viewport, descriptionFallback: false },
  aliases: {},
  ...PRE_0_4_0,
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
/**
 * `version` selects which consumer stylesheet a caller wants: no argument (or
 * `"v8b"`) is the v8b stylesheet every pre-0.4.x fixture parity test is pinned
 * against; `"v11"` is `fixtures/jhd-v11-2026-09-12/styles.css` — the 0.4.x
 * path's own hand-authored stylesheet, vendored alongside its brief pair
 * rather than borrowed from an older fixture. Older parity tests are
 * unaffected: they call `consumerCss()` with no argument and keep getting v8b.
 */
export const consumerCss = (version = "v8b") =>
  readFileSync(
    path.join(version === "v11" ? V11 : V8B, "styles.css"),
    "utf8",
  );

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
// P11 — pinned explicitly on every pre-0.4.2 consumer config below, rather
// than inherited from the mutable `preset`: 0.4.2 un-holds `fluid-clamp` and
// `fixed` in the house preset, and these configs back fixtures generated
// under the pre-0.4.2 preset (viewport classes only). Pinning keeps them
// byte-stable regardless of what the preset does next.
const PRE_0_4_2_RESPONSIVE = { responsive: { honourClasses: ["viewport-height", "viewport-width"] } };

export const consumerConfig = {
  ...preset,
  report: { ...preset.report, policyRef: "docs/handoff-css.md" },
  header: { ...preset.header, regenerateCommand: "pnpm run tokens" },
  ...PRE_0_4_0,
  ...PRE_0_4_2_RESPONSIVE,
};

/**
 * The same consumer pair with the 0.4.0 policies ON — the config
 * `jhd-design-system` ships from 0.4.0 onward. Used by the `jhd-v9d`/`jhd-v10`
 * fixtures, whose `expected/*` this package generated. P11 stays pinned to
 * the pre-0.4.2 preset (see `PRE_0_4_2_RESPONSIVE`) — `consumerConfig042`
 * below is the 0.4.2 config, used only by the v11 fixture.
 */
export const consumerConfig040 = {
  ...preset,
  report: { ...preset.report, policyRef: "docs/handoff-css.md" },
  header: { ...preset.header, regenerateCommand: "pnpm run tokens" },
  ...PRE_0_4_2_RESPONSIVE,
};

/**
 * The consumer pair with 0.4.2's responsive policy ON — the house preset's
 * `responsive.honourClasses` un-held (`fluid-clamp` and `fixed` honoured, per
 * `layoutVariant`, exactly as `responsiveBehavior.rules[]` states). Used only
 * by the v11 fixture, the first generated under it.
 */
export const consumerConfig042 = {
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

/**
 * A SIXTH real export, `fixtures/jhd-v9b-2026-09-11/export.json` — schema 9,
 * generated 2026-09-11T07:31:20.236Z, same design-system state as `docV9()`
 * (`bb6a0025…7224`), content hash `3dd36033…2aa4`. The operator's fix to the
 * one token schema 9 still could not classify: `device/container-max-width` is
 * now described "Fixed maximum container width (2156px across all
 * breakpoints)" and every `responsiveBehavior` rule states `strategy: "fixed"`
 * with no `viewportFraction` — the fixture for P11's third silencing source
 * (see `test/responsive.test.mjs` and `test/parity-v9b.test.mjs`).
 *
 * The pair is vendored whole: `design-system-handoff.md` is the companion the
 * JSON was exported beside (its stated content hash IS the JSON's), and
 * `design-handoff-block-navigation.md` is the layer brief exported from the
 * same state at the same minute.
 */
export const docV9b = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v9b-2026-09-11", "export.json"), "utf8"),
  );

export const V9B = path.join(path.dirname(FIXTURE), "jhd-v9b-2026-09-11");

/** `expected/*` for the v9b fixture — generated by this package's own CLI
 * against `docV9b()` + `consumerConfig` + v8b's `consumerCss()`, exactly as
 * `expectedV9` is. Only the export moved. */
export const expectedV9b = (file) =>
  readFileSync(path.join(V9B, "expected", file), "utf8");

/**
 * A SEVENTH real export, `fixtures/jhd-v9c-2026-09-11/export.json` — schema 9,
 * generated 2026-09-11T09:47:02.715Z, same design-system state as `docV9b()`
 * (`bb6a0025…7224`), the plugin's export v4. This is the fixture for P17: the
 * companion `design-handoff-block-navigation.md` now opens with a `---` YAML
 * front-matter block and its responsive tables carry a fifth `Notes` header
 * column (`† token-swap` / `† variant-only` / `† row-wrap: …`), replacing the
 * ragged trailing-cell form `jhd-v9b` used. `validation.findings` is present
 * (empty) for the first time.
 */
export const docV9c = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v9c-2026-09-11", "export.json"), "utf8"),
  );

export const V9C = path.join(path.dirname(FIXTURE), "jhd-v9c-2026-09-11");

/**
 * The consumer's stylesheet as it ships AFTER adopting 0.4.0 — every
 * hand-authored declaration the new policies supersede, deleted.
 *
 * A global hand-authored declaration suppresses the generated token (P2), so
 * adoption is a deletion on the consumer's side, exactly as adopting P12 meant
 * deleting the eighteen `--screen-height-*` lines (see `consumerCss` above).
 * Six lines go:
 *
 *   `--aspect-{landscape,square,portrait,tall}` — ruling row 5, *"no
 *   hand-authored copies"*. `core/aspect/*` now authors all four, and the
 *   generated values are byte-equal (report §3 MATCH), so nothing computes
 *   differently.
 *
 *   `--duration-1600: 1.6s` — styles.css ~928 calls it *"not yet a Figma
 *   step"*. It is one now, and P19 publishes it as `1600ms`, so the stale copy
 *   is the only thing keeping the file on seconds. `--duration-250` STAYS:
 *   there is still no `duration/250` in Figma, and the generator can only emit
 *   what the export publishes.
 *
 *   `--easing-linear: cubic-bezier(0, 0, 1, 1)` — styles.css ~960 kept it by
 *   hand because the export published the keyword `linear`, *"equivalent but
 *   not byte-equal"*, and would not settle that VALUE-DRIFT row. Export v11
 *   authors the explicit 0,0,1,1 bezier, so the row is a MATCH now — P2's own
 *   definition of a duplicate that can simply be deleted.
 *
 * Filtered rather than vendored as a second styles.css, because
 * `jhd-design-system` has not landed the deletion yet, and a fixture
 * stylesheet no repo ships would prove nothing. `jhd-v8b/styles.css` stays the
 * pinned, shipped one.
 */
export const consumerCss040 = () =>
  consumerCss().split("\n")
    .filter((l) => !/^\s*--(?:aspect-[a-z]+|duration-1600|easing-linear):/.test(l))
    .join("\n");

/**
 * An EIGHTH real export, `fixtures/jhd-v10-2026-09-12/export.json` — schema 9,
 * generated 2026-09-12T07:11:41.254Z, the plugin's export v11, design-system
 * state `26351f7a…defc`. This is THE 0.4.0 fixture: the design system as the
 * operator's 2026-09-12 rulings authored it.
 *
 *   motion — easings renamed to their curve families (`quad-out`, `cubic-out`,
 *   `quart-out`, `expo-out`, `ease-out`, `circ-in-out`, `linear`); durations a
 *   0–2000 ms ramp in 100 ms steps plus 375 and 750; delays 0–1000 in 100 ms
 *   steps plus 50, 375 and 750. Every step is NAMED for its milliseconds.
 *
 *   aspect — `core/aspect/{landscape, portrait, square, tall}` are STRING
 *   variables holding "3:2" / "4:5" / "1:1" / "2:3", with their own
 *   `--aspect-<name>` WEB names. The `layout/grid/aspect/*` heights stay
 *   excluded and their descriptions now agree with them.
 *
 * One contract statement is NOT met by this export and is left visible rather
 * than papered over: ruling row 4 makes every delay step a Figma ALIAS of the
 * matching duration step, and not one of the fourteen is (664 aliases exist
 * elsewhere in the export, so the shape is available). Eleven of them hold a
 * duration step's value as their own literal, which is what `DELAY_NOT_ALIASED`
 * reports — see `test/motion-v10.test.mjs`.
 */
export const docV10 = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v10-2026-09-12", "export.json"), "utf8"),
  );

export const V10 = path.join(path.dirname(FIXTURE), "jhd-v10-2026-09-12");

/** `expected/*` for the v10 fixture — generated by this package's own CLI
 * against `docV10()` + `consumerConfig040` + v8b's `consumerCss()`. */
export const expectedV10 = (file) =>
  readFileSync(path.join(V10, "expected", file), "utf8");

/**
 * A NINTH real export, `fixtures/jhd-v11-2026-09-12/` — the plugin's export
 * v11, same design-system state as `docV10()` (`26351f7a…defc`), re-exported
 * with the brief markdown's own JSON companion (schema `design-handoff` v10)
 * for the first time — see `src/brief.mjs` and `test/brief.test.mjs`. This is
 * the fixture the DS parity test should point at going forward: it carries
 * both the brief JSON companion and the full schema-v9 node-hint vocabulary
 * (`col()`/`row()`, `aspect`, `semantic`, `interactive`, `states`, `a11y`,
 * `position`, `@container`, `desc`) in one place, and vendors its OWN
 * hand-authored `styles.css` rather than borrowing v8b's — the 0.4.x path's
 * consumer stylesheet, not a stand-in.
 */
export const docV11 = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v11-2026-09-12", "export.json"), "utf8"),
  );

export const V11 = path.join(path.dirname(FIXTURE), "jhd-v11-2026-09-12");

/** `expected/*` for the v11 fixture — generated by this package's own CLI
 * against `docV11()` + `consumerConfig040` + v11's OWN `consumerCss("v11")`. */
export const expectedV11 = (file) =>
  readFileSync(path.join(V11, "expected", file), "utf8");

/**
 * A TENTH real export, `fixtures/jhd-v13-2026-09-12/` — the design-system
 * handoff at schema **13**, generated 2026-09-12T13:43:20.353Z, plugin export
 * v17, design-system state `eab3d422…498cc` (the same state `docV11()` was
 * exported from; only the plugin moved). This is THE 0.5.0 fixture: the first
 * export that states its own CSS, so the generator stops being a token-only
 * consumer.
 *
 *   `styles.{PAINT,TEXT,EFFECT,GRID}[].cssClass` — a ready `selector` +
 *   `declarations[]`, already bound to `var(--token, fallback)`. 52 TEXT, 15
 *   EFFECT, 7 GRID, 0 PAINT. P21 emits them verbatim.
 *
 *   `styles.TEXT[].typeRamp` (policy v2) — per-property `cssProperty` / `css` /
 *   `buildReady`, plus `fontStack` / `fontStackCss`.
 *
 *   `weight/strong`'s `fontWeightNumeric` — the STRING "Medium" with the
 *   number 500 beside it. P22 emits the number.
 *
 *   `cssCustomPropertySheets` — the export's own `:root` / theme blocks, one
 *   per collection x mode. Cross-checked against this run, never emitted.
 *
 * It supersedes the 13:28 schema-12 export of the same state, which this
 * package's own P21 findings condemned on two counts the plugin then fixed at
 * the source: effect classes froze `#3A96CFFF` where the style BOUND
 * `--border-focused-dark` (`STYLE_CLASS_LITERAL`), and grid classes were the
 * bare leaves `.default` / `.flush` (`STYLE_CLASS_UNSCOPED`). Both report zero
 * here — `test/styles-v13.test.mjs` pins that, and pins that they still fire
 * on a mutated copy so a green run means "clean", not "switched off".
 *
 * Its consumer stylesheet is `jhd-design-system`'s `src/styles.css` verbatim
 * (the same bytes `jhd-v11` vendors), which is the point of the fixture: that
 * file hand-authors the type ramp as `@utility title-style1-100 { … }` — the
 * duplication 0.5.0 exists to end.
 */
export const docV13 = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v13-2026-09-12", "export.json"), "utf8"),
  );

export const V13 = path.join(path.dirname(FIXTURE), "jhd-v13-2026-09-12");

/** The v13 consumer stylesheet — `jhd-design-system/src/styles.css` verbatim. */
export const consumerCssV13 = () => readFileSync(path.join(V13, "styles.css"), "utf8");

/** `expected/*` for the v13 fixture — generated by this package's own CLI
 * against `docV13()` + `consumerConfig042` + `consumerCssV13()`. */
export const expectedV13 = (file) =>
  readFileSync(path.join(V13, "expected", file), "utf8");

/**
 * An ELEVENTH real export, `fixtures/jhd-v17-2026-09-13/` — the design-system
 * handoff at schema **17**, generated 2026-09-13T17:08:05.918Z, design-system
 * state `4dd755a1…20bf`, content hash `2b855aa0…f30f`. Vendored verbatim from
 * the plugin's own artifact pair:
 *
 *   `vault/main/projects/portfolio/artifacts/design-handoff-2026-09-13-exports/`
 *   `jhd-spec-designsystem-design-system-handoff-2026-09-13-17-08-05/`
 *     `…-17-08-05.json` -> `export.json`
 *        sha256 9c5d66a6dbdfb8f318ff98922ef45ec197698ff5f3c2d3686ec96c2cce063697
 *     `…-17-08-05.md`   -> `design-system-handoff.md`
 *        sha256 0d0fff5c7c1d9b372d725252a8a0e9e3a74653c76e33b78e6abc9ae16cf2a649
 *
 * Schema 17's one delta is `policies.units` v5 -> v6 (the export's own
 * `changes.policyChanges` states it: `{ field: "units", before: "5", after:
 * "6" }`, `changes.summary.policyChanged: 1`). Units v6 adds ONE rule:
 *
 *   "Letter-spacing and line-height variables resolve their associated
 *    font-size divisor from sibling variables: same-step `size/<n>` for
 *    primitives; `text/<fam>/font-size-<step>` for layout collections. The
 *    divisor is never invented; unresolvable associations emit
 *    `status: unresolved`."
 *
 * So the typography cells this generator has emitted as raw px + UNCONVERTED
 * since schema 5 are now RESOLVED at the variable level, each with its own
 * `build.css` in `em` / unitless (`0em`, `-0.01em`, `1.15`, `1.3`). Nothing in
 * `src/` changes to consume them: they take the existing resolved path and the
 * generator emits `build.css` verbatim (P4). P13 is untouched — an export that
 * still cannot resolve a divisor keeps emitting raw + UNCONVERTED, which is
 * what `jhd-v16-2026-09-13` still does and `test/schema-17.test.mjs` pins.
 */
export const docV17 = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v17-2026-09-13", "export.json"), "utf8"),
  );

export const V17 = path.join(path.dirname(FIXTURE), "jhd-v17-2026-09-13");

/** The schema-16 export of the same design system, for the before/after pin in
 * `test/schema-17.test.mjs` — the same typography variables, still
 * `status: "unresolved"` under units v5. */
export const docV16 = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v16-2026-09-13", "export.json"), "utf8"),
  );

/**
 * A TWELFTH real export, `fixtures/jhd-v17c-2026-09-16/` — schema **17**,
 * generated 2026-09-16T14:05:41.614Z, design-system state
 * `8cb5f9d3…f60c8`, content hash `7a93a9eb…c649f44`. Vendored verbatim from
 * the plugin's own artifact pair:
 *
 *   `vault/main/projects/portfolio/artifacts/design-system-handoff-2026-09-16/`
 *     `…-14-05-41.json` -> `export.json`
 *        sha256 eec3b8a2bf6541f8cb297e8598ebbb5a44a81789cac7686325360a7ded1777fa
 *     `…-14-05-41.md`   -> `design-system-handoff.md`
 *        sha256 18ab4c1c91106f9db62ed5bc603b439f6b801eb7bed8ab78f811ff4c2a2c46eb
 *
 * Its one delta from `jhd-v17-2026-09-13` is `policies.typeRamp` v2 -> v3
 * (`TYPE_RAMP_POLICY_VERSION` in the design-system-handoff plugin): every
 * `styles.TEXT[].typeRamp` now carries `textDecorationDetail`, a `raw`
 * property whose `build` states the underline/strikethrough geometry
 * (`style`, `thickness`, `offset`, `skipInk`, `color`) plus the `css` map
 * those compose to, when `build.status` is `resolved`. `title-action-style1/200`
 * and `body-action-style1/200` are the two styles this fixture is pinned on —
 * both carry a resolved detail, and both already fold its `css` entries into
 * `cssClass.declarations` (P21 emits the class verbatim; nothing in `src/`
 * re-derives underline geometry).
 */
export const docV17c = () =>
  JSON.parse(
    readFileSync(path.join(path.dirname(FIXTURE), "jhd-v17c-2026-09-16", "export.json"), "utf8"),
  );

export const V17C = path.join(path.dirname(FIXTURE), "jhd-v17c-2026-09-16");
