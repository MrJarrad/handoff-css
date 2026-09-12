# Changelog

All notable changes to `handoff-css`. Dates are the release date; versions follow semver.

## 0.5.0 — 2026-09-12

`design-system-handoff` schema 12/13: the export now states its own CSS, so the generator
stops being a token-only consumer. A design system can delete its hand-authored type
utilities.

### Added

- **`styles.generated.css` (P21)** — one class per Figma style, from the export's own
  `cssClass`: **selector and declarations verbatim, in the export's order**, never derived
  from a style name and never recomputed from `properties`. TEXT, then EFFECT, then GRID,
  then PAINT. A style the export gives no `declarations` for is reported `NO-DECLARATIONS`
  and not emitted (PAINT is all of that case today). Named by the new, optional
  `paths.styles`; an export older than schema 12, or a config that names no path, writes
  **no file** rather than an empty one.
- **Hand-authored wins, per class (P21.1).** A selector the consumer declares at top level
  is MATCH / VALUE-DRIFT and is not emitted, exactly as P2 does per token. `@utility foo`
  compiles to `.foo` and therefore SHADOWS a generated class, but is not an unconditional
  declaration of it — the same reading `isGlobalScope` already takes — so it is reported,
  never obeyed. Sixteen shadows in `jhd-design-system/src/styles.css` today.
- **Two findings about the export (P21.2).** `STYLE_CLASS_LITERAL`: a declaration freezes a
  raw literal **outside every `var()`** for a property the same style binds to a variable.
  `STYLE_CLASS_UNSCOPED`: the selector is the style's bare `leafName`. Both fired on the
  13:28 schema-12 export (18 and 7); the plugin fixed both at the source, and both report
  zero on the 13:43 schema-13 export shipped here. Neither is ever repaired in this
  package — a rewritten selector would break P21's verbatim contract.
- **Numeric font weights (P22).** A STRING variable carrying schema 12's
  `fontWeightNumeric` emits the export's own number — `--weight-strong: 500`, not
  `"Medium"`. Nothing here maps a style name to a number; the report states the Figma style
  name and the export's confidence. A STRING without one stays quoted.
- **`cssCustomPropertySheets` cross-check (P21.3).** The export's own `:root` / theme blocks
  are read and **never emitted** — the consumer's policies decide what a token reads as, and
  two disagreeing stylesheets in one repo is the failure this package removes. Every
  declaration is compared against this run instead: 653 differ on the v13 export, including
  101 the plugin stringified an object into (`--delay-0: [object Object]`).
- **`schema/design-system-handoff.v12plus.schema.json`** — the 8-13 base document plus the
  four structures schema 12 introduced (`cssClass`, type ramp v2, `fontWeightNumeric`,
  `cssCustomPropertySheets`). `validate-export.mjs` dispatches on `schemaVersion`, so an
  8-11 export is not failed for lacking fields its own version never had. Published as
  `handoff-css/schema/export/v12plus`.
- **`fixtures/jhd-v13-2026-09-12/`** — schema 13, plugin export v17, generated
  2026-09-12T13:43:20.353Z, design-system state `eab3d422…498cc` (the same state `jhd-v11`
  was exported from). Ships the companion `.md`, the consumer's `styles.css` verbatim from
  `jhd-design-system`, and five `expected/*` artifacts. `test/styles-v13.test.mjs` pins them
  byte-for-byte and pins that the two findings still fire on a mutated copy, so a green run
  means "clean", not "switched off".

### Changed

- `schema/design-system-handoff.schema.json` accepts `schemaVersion` 8-13 (10 and 11 shipped
  and were generated from, but would have failed validation). The unknown-version tests are
  repointed from 10 to 14 — assertions unchanged, only the version they pin.
- `src/header.mjs`: the provenance header extracted from `emit-tokens.mjs` verbatim, so both
  generated stylesheets state the same export. Byte-neutral — every older fixture is
  unchanged.
- `presets/jhd.config.mjs`: `schema.versions` gains `10`-`13`; `paths.styles` added.
- `skills/handoff-to-code/SKILL.md`: bind the generated class, delete the shadowing
  `@utility`, report the two class findings rather than patching them. Adapters rebuilt.

## 0.4.3 — 2026-09-12

Design Handoff schema v11 (export v15+): explicit alignment. `gridPlacement` now carries
`justifySelf`/`alignSelf` on every grid child (`auto` when default), and every layout container
carries CSS-resolved `alignItems`/`justifyContent` beside Figma's own `align`/`justify`.

### Added

- **`schema/design-handoff.v11.schema.json`.** Types `alignSelf`/`justifySelf` as a closed enum
  of CSS values plus `auto`, and `alignItems`/`justifyContent` as a closed enum of CSS content
  values; `additionalProperties: false` throughout, including `gridPlacement` and `layout`. v10
  stays accepted — `src/brief.mjs` now dispatches the schema to validate a brief JSON against by
  its own `schemaVersion` (10 or 11), never a flag.
- **`fixtures/jhd-v11-2026-09-12/design-handoff-block-navigation.{json,md}`** replaced with the
  real 09:51 export (schema 11, export v15) — the 08:20 pair (schema 10, export v14) it
  superseded is gone from the tree.
- A mutation test proving an unknown alignment value (e.g. `gridPlacement.justifySelf`) fails
  schema validation, plus a parity test that a v10 brief (alignment fields stripped) still
  validates against schema v10.
- `src/validate-handoff-md.mjs`'s grid-table cell vocabulary now accepts the trailing
  `justifySelf:X alignSelf:Y` pair schema v11 prints after `col()`/`row()` cells.

### Changed

- `skills/handoff-to-code/SKILL.md`: alignment is written from the container's
  `alignItems`/`justifyContent` and the child's `alignSelf`/`justifySelf` as stated, never
  inferred. Adapters rebuilt (`npm run skills`).
- `package.json` `exports["./schema/brief/v11"]` publishes the new schema alongside the existing
  `./schema/brief` (v10).

## 0.4.2 — 2026-09-12

Operator ruling ("Responsive strategy"): *"let's follow what the plugin suggests."* The
generator now emits each variable's responsive value exactly as the plugin's
`responsiveBehavior` rule states, per layout variant.

### Changed

- **P11 un-holds `fluid-clamp` and `fixed`.** `presets/jhd.config.mjs`'s `responsive.honourClasses`
  now lists all four classes that can change output (`viewport-height`, `viewport-width`,
  `fluid-clamp`, `fixed`) instead of the viewport pair alone. Every `responsiveBehavior.rules[]`
  entry is honoured exactly as published, per `layoutVariant` — `fluid-clamp` emits the export's
  own `css: clamp(...)` verbatim, never recomputed; `fixed` collapses to one declaration per
  variant, or once on the base scope when every rule states `fixed`. `mode-stepped` stays
  per-breakpoint. A variable whose rule is genuinely `fluid-clamp`/`fixed` at one layout variant
  and `mode-stepped` at another (e.g. `--grid-col-start-2`: `fluid-clamp` at `default`/`flush`,
  `fixed` at `sidebar-main`/`sidebar-main-flush`) honours each variant independently.
- **§10 states an honoured variable's per-variant effect, not the last variant processed.**
  Previously a variable classed differently across layout variants had its single `Effect` cell
  silently overwritten by whichever variant the emitter reached last, understating what other
  variants actually did. `Effect` now names every distinct outcome and the variants that share it
  (`default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed
  once per layout variant`) — a report-only fix; the emitted CSS was already correct per variant.
- **`FIXED_VARIES_BY_MODE` / `CLAMP_WITHOUT_EXPRESSION` warn once per layout variant, not once per
  width sample.** An honoured `fixed` rule whose modes disagree is proved false before every
  width sample in that variant, not just the first; the warning is now deduplicated per variant
  (`src/emit-tokens.mjs`'s `uncollapsible` set), matching the existing per-variant dedupe for
  `VIEWPORT_CLASS_WITHOUT_FRACTION`. The variable-wide all-`fixed` collapse (0.3.1) also no longer
  double-warns when its own per-variant fallback re-checks the same disagreement.
- **§10 reports a strategy-count summary row** (`Strategy counts: fixed: 7 · fluid-clamp: 14 ·
  mode-stepped: 52 · viewport-height: 8 · viewport-width: 1`), collapsed over `source` — one
  number per `responsiveBehavior` strategy regardless of how the generator learned of it,
  alongside the existing per-(class, source) tally.
- **`fixtures/jhd-v11-2026-09-12/expected/*` regenerated** under the new preset default
  (`test/fixture.mjs`'s `consumerConfig042`). Every other fixture's `tokens.generated.css`,
  `theme.generated.css` and `exclusions.json` stay byte-identical under their own pinned configs
  (`consumerConfig`/`consumerConfig040` now pin `responsive.honourClasses` explicitly to the
  pre-0.4.2 viewport-only default, rather than inheriting it from the mutable preset); their
  `ds-from-handoff-report.md` gained only the new strategy-count summary line.

## 0.4.1 — 2026-09-12

The layer-brief markdown gets a JSON companion of its own (schema `design-handoff` v10),
and the brief's own grammar grows a ninth line vocabulary (export v11, schema `design-handoff`
v9/v10) alongside `handoff-to-code` hints the generator's node table can now carry.

### Added

- **`src/brief.mjs` — the brief JSON reader.** The Design Handoff plugin (export v14+) now
  emits `*-design-handoff.json` for the layer brief itself, distinct from the
  `*-design-system-handoff.json` the tokens come from. `validateBriefJson` checks its shape
  against `schema/design-handoff.v10.schema.json` (also published as `handoff-css/schema/brief`);
  `validateBriefPair` reconciles the brief JSON's identity fields (`schema`, `schemaVersion`,
  `contract`, `exportVersion`, `contentHash`, `designSystemStateHash`, and the companion block)
  against the markdown's front matter. The JSON is the contract; the markdown reconciles
  against it, never the reverse.
- **A light structural pass for a paired brief `.md`.** Once a `.json` naming schema
  `design-handoff` is given alongside its `.md`, `handoff-css validate` drops the markdown to
  front-matter-present + legend-present + identity-matches-JSON, instead of re-running the
  full v6/v9 line grammar. A lone `.md` (no companion given) still gets the full grammar
  unchanged — `validate-handoff-md.mjs` owns that path exactly as before; `brief.mjs` owns only
  the paired-identity reconciliation. This is the module boundary: grammar parsing stays in
  one file, brief-JSON/identity reconciliation in the other, and `src/cli.mjs` is the only
  place that decides which path a given file pair takes.
- **`schema/design-handoff.v9.grammar.md`** — the ninth schema-version line grammar the
  markdown parser accepts, adding node-table hints beyond `col-span N/M`: `col(S/N of M)`
  and `row(S/N)` (grid placement), `aspect: $token (stable|varies)`, `semantic(<tag>)`,
  `interactive(<events>)`, `states(<pseudo-classes>)`, `a11y(<attrs>)`, `position(sticky|fixed)`,
  `@container`, and `desc("…")`. Each is documented in `skills/handoff-to-code/references/
  schema-v9-hints.md` as a one-line mechanism rule for `handoff-to-code`, not style advice.
- **`fixtures/jhd-v11-2026-09-12/`** — the plugin's export v11 pair: brief `.json` + `.md`
  (schema `design-handoff` v10/v9), `export.json` (tokens), and `styles.css` (generated
  output). This is the fixture the DS parity test (`jhd-design-system`'s own suite) should
  point at going forward — it is the only fixture carrying both the brief JSON companion and
  the full schema-v9 node-hint vocabulary in one place.

### Changed

- **`skills/handoff-to-code/SKILL.md` trimmed to fit its 1,200-word ceiling.** The schema-v9
  node-hints table moved to `skills/handoff-to-code/references/schema-v9-hints.md` in full;
  the skill body keeps a one-paragraph pointer naming every hint. Body word count (frontmatter
  excluded, matching the discipline plugin's own ceiling test) is 1,090. No law sentence
  (`test/skill-law-sentences.mjs`) moved or changed; `description` is unchanged; every host
  adapter under `skills/handoff-to-code/dist/` was regenerated (`npm run skills`).
- **`schema/design-handoff.v10.schema.json` now constrains the shape, not just presence.**
  `additionalProperties: false` at the top level and on every `layerTree` node; typed shapes
  for `selectedNodes` (`{id, name}`), `componentIndex`, `variableTokens`, `prototypeFlows`,
  and `motionTransitionTokens` entries; `layerTree` nodes require `id, name, type, depth,
  visible` with typed optional fields (`dimensions`, `fills`, `strokes`, `cornerRadius`,
  `semantic`, `link`, `parentId`, `absolute`, `absoluteBounds`, `gridPlacement`, `layout`,
  `component`, `modes`, `clip`, `interactive`, `aspectRatio`, `annotations`, `constraints`,
  `text`, `children`) derived from the real contract file and the v11 fixture. A garbage
  node entry, a mistyped `selectedNodes`, or an unknown top-level/node key is now a
  validation failure (`test/brief.test.mjs`).
- **`test/fixture.mjs`'s `consumerCss(version)`** takes an optional `"v11"` argument
  returning `fixtures/jhd-v11-2026-09-12/styles.css` — its own hand-authored stylesheet
  rather than v8b's borrowed one. Every pre-0.4.x caller (`consumerCss()`, no argument)
  is unaffected and still gets v8b.

### Added (test)

- **`test/parity-v11.test.mjs`** — byte-identical parity pin for the v11 fixture, on the
  `parity-v10.test.mjs` pattern: `docV11()` + `consumerConfig040` + `consumerCss("v11")`
  against committed `fixtures/jhd-v11-2026-09-12/expected/*`, plus a determinism check.
  Zero warnings — every delay step is aliased to its duration step in this later export,
  closing the gap `test/motion-v10.test.mjs` pins against the v10 fixture.

### Unchanged

- Fixtures other than `jhd-v11-2026-09-12/` (whose data was unchanged) gain only their
  `expected/*` where new (`jhd-v11-2026-09-12/expected/*`, generated this round).

## 0.4.0 — 2026-09-12

Motion and aspect ratios become generator output instead of hand-authored copies.
Operator rulings 2026-09-12 (`2026-09-12-motion-token-naming`), against the design
system as export v11 authors it.

### Added

- **P19 — MOTION (`config.motion`).** A TIMING variable publishes in the unit
  `motion.timingUnit` names. Figma stores seconds; the house preset publishes
  **milliseconds**, because the ramp names each step for its milliseconds and
  `--duration-375: 0.375s` would lie about itself in the one place a reader looks. Float32
  noise is rounded off in seconds BEFORE the scale, or `0.1s` reads as `100.000001ms`.
  Easing needs no policy and gains no key: `LINEAR` emits the keyword `linear`, every other
  curve emits `cubic-bezier(…)` from the export's own control points.
- **`DELAY_NOT_ALIASED` (`motion.delayAliasOf`).** Ruling row 4 makes every delay step a
  Figma ALIAS of the duration step of the same value, *"so values can never drift"*. When
  Figma authors that, P5 emits `--delay-375: var(--duration-375)` with the terminal comment
  in milliseconds too. **The generator never pairs the two itself** — rewriting a literal
  delay on a value match looks identical today and silently overwrites the first delay that
  legitimately differs. It reports instead, naming the duration to re-point at. A delay with
  no matching duration step (`delay/50`) is not a finding.
- **P20 — ASPECT RATIOS (`config.aspect`).** Figma has no aspect-ratio TYPE, but it has
  STRING variables, and `core/aspect/{landscape, portrait, square, tall}` now hold `"3:2"`,
  `"4:5"`, `"1:1"`, `"2:3"`. Nothing is derived: they are ordinary published variables under
  their own `--aspect-<name>` names (P1), and this policy renders `a:b` as the CSS ratio
  `a / b`. Both spellings and decimals are read; every STRING outside `aspect.ratioPaths`
  stays quoted; a declared ratio path holding a non-ratio is a hard failure rather than a
  quoted passthrough that would surface in a browser.
- **`ASPECT_DESCRIPTION_DISAGREES` (`aspect.descriptionGroup`).** The per-column-span
  `layout/grid/aspect/*` heights stay EXCLUDED (P7) and still describe the ratio they were
  computed from, so each leaf group's descriptions are cross-checked against the authored
  variable of the same name. The finding changes **no value** — the authored variable is
  always the value; a stale description means a designer is reading the wrong number.
- **`conform` and the handoff-markdown parser are exported from the package entry.** The
  `exports` map publishes `.` only, so P16's checker was reachable from the CLI and from
  this repo's own tests and from nowhere else; `jhd-design-system` calls it from its suite.
  Exported as `conform`, `FINDINGS`, `renderConformMarkdown`, `renderConformJson`,
  `parseHandoffMarkdown`, `validateHandoffMarkdown`. The README's old deep-import examples
  (`handoff-css/src/conform.mjs`) never resolved and are corrected.
- **`fixtures/jhd-v10-2026-09-12/`** — the plugin's export v11 (schema 9, state
  `26351f7a…defc`), the design system as the rulings authored it: seven curve-family
  easings, `duration/0..2000` in 100 ms steps plus 375 and 750, `delay/0..1000` in 100 ms
  steps plus 50, 375 and 750, and the four `core/aspect/*` string variables.

### Known gap in the fixture

- **Not one of the fourteen delay steps is a Figma alias** in export v11, though the export
  carries 664 aliases elsewhere. Thirteen hold a duration step's value as their own literal,
  so a v10 run raises thirteen `DELAY_NOT_ALIASED` findings. The values are correct and
  nothing is blocked; ruling row 4's *no-drift* guarantee is simply not authored yet, and
  the fix is re-pointing thirteen variables in Figma. The generator emits them verbatim
  meanwhile and does not invent the aliasing.

### Changed

- `config.motion` and `config.aspect` are **required**. There are no defaults in this
  package by design — a silently defaulted house policy is how a token pipeline starts
  emitting values nobody chose. A consumer on the shipped preset inherits both.
- `resolveValue(v, mode, byId, cfg)` takes an optional fifth argument, the variable's
  collection, so P20 can tell a ratio path from any other STRING. Callers inside this
  package pass it; the default preserves the old behaviour.

### Unchanged

- The `jhd-v7b`, `jhd-v8b`, `jhd-v9`, `jhd-v9b` and `jhd-v9c` fixtures are byte-identical.
  Their `expected/*` are committed artifacts of exports that predate these rulings, so
  `test/fixture.mjs` states the policy they were produced under (`PRE_0_4_0`) rather than
  restating those exports as something they never said.

### For consumers adopting this

Six hand-authored declarations in `jhd-design-system/src/styles.css` are superseded and must
be deleted, or P2 keeps suppressing the generated token: the four `--aspect-*` copies,
`--duration-1600: 1.6s` (the file calls it *"not yet a Figma step"* — it is one now, and is a
VALUE-DRIFT row until the copy goes), and `--easing-linear` (kept by hand because the export
published the keyword; v11 authors the explicit `0,0,1,1` bezier, so it is a MATCH now).
`--duration-250` stays: there is still no `duration/250` in Figma. See `consumerCss040` in
`test/fixture.mjs`.

## 0.3.4 — 2026-09-11

Generated headers no longer print the export's filename.

### Fixed

- **Header `Source:` line now prints `doc.documentName`, never `doc.artifactFilename`.**
  Downloads keep a suffix so exports never overwrite each other on disk, but that suffix was
  leaking into `tokens.generated.css`, `theme.generated.css`, and the reconciliation report's
  `Export` row — a suffixed download moved generated output even though nothing about the
  design system changed. Fallback is `doc.artifact`, then a fixed string. Fixes
  `src/emit-tokens.mjs`, `src/emit-theme.mjs`, `src/report.mjs`; see P18 in `docs/POLICIES.md`.

## 0.3.3 — 2026-09-11

The plugin's export v4 adds a leading YAML front-matter block and turns the ragged
table-note cell into a proper `Notes` column.

### Added

- **`src/front-matter.mjs`: a minimal hand-rolled YAML front-matter reader.** Flat keys, one
  level of nested mapping, quoted strings, ints, and simple sequences of flat mappings — no
  YAML dependency. `parseHandoffMarkdown` reads a leading `---`/`---` block and exposes it as
  `parsed.frontMatter` (`null` when absent — every pre-export-v4 brief).
- **`FRONT_MATTER_MISMATCH` (error).** When an identity field is stated in both the front
  matter and the bold lines and they disagree, the field, the front-matter value and the
  bold-line value are all named. A field in only one source is not a mismatch.
- **The `Notes` header column.** A table whose last header cell is literally `Notes` accepts
  empty / `† <note>` / `† row-wrap: <free text>` cells there, never against the value-column
  vocabulary; `row.note` is populated the same way the legacy ragged trailing cell was. The
  legacy ragged form is unchanged and still accepted on tables without a `Notes` header.
- **`validation.findings` (schema 9+, optional).** `validateExport` surfaces each finding as
  a `PLUGIN_FINDING` warning. `figma.fileKey` accepts `string | null`.
- **`fixtures/jhd-v9c-2026-09-11/`** — export v4 (schema 9, state `bb6a0025…7224`) + brief v3,
  vendoring both halves of the plugin's 2026-09-11T09:47:02.715Z pair. Zero warnings; the
  generated artifacts differ from `jhd-v9b`'s only in the header (Source/Exported timestamps).

## 0.3.2 — 2026-09-11

The plugin's next export gave `⚠` one meaning (a raw value that should be bound) and moved
table/footnote/layout notes to `†`. The grammar reads both.

### Changed

- **`design-handoff.v6.grammar.md` + `validate-handoff-md.mjs`: single-meaning sigils.**
  A table's trailing note cell and a footnote line accept `† <note>` (the 2026-09-11 form)
  and the legacy `⚠ <note>` — both normalise to one `row.note` / `parsed.notes[].text` shape,
  sigil stripped. `⚠raw <value>` and the inline `⚠<value>` both mean unbound raw; `⚠ placeholder`
  is unchanged. Added `parsed.changes` for the `**Changelog**` block's `- **Node** #id — kind`
  rows. Vendored the plugin's 2026-09-11 v2 export as
  `fixtures/jhd-v9b-2026-09-11/design-handoff-block-navigation-v2.md`; it and the v1 sibling
  both validate with zero errors and zero warnings, and `conform` reads bindings from either
  identically.
- **`src/cli.mjs` `USAGE`: `conform` now names `--config` and `--allow-name`** — the
  reviewer's 2026-09-11 amber on P16 landing without them.

## 0.3.1 — 2026-09-11

The house export's last standing warning, and the checker's last standing red — both were
the tool refusing to take an answer it had been given.

### Added

- **P11's third silencing source: a rule-level `fixed`.** A variable inside a declared
  `viewport.groups` prefix whose every `responsiveBehavior` rule states `strategy: "fixed"`
  now classifies as `fixed` and emits ONE declaration on the base scope, with no
  `VIEWPORT_UNFLAGGED`. The warning asks "this group is a fraction of the screen; which
  fraction is this one?", and an all-`fixed` rule set answers *none — it is one value at
  every breakpoint*. That is a statement, not silence. Memo
  `2026-09-10-handoff-viewport-tokens-brief` addendum 1: "`fixed` -> one value".
  Proved before it collapses — the modes' own resolved values must agree, or the per-mode
  samples stand and `FIXED_VARIES_BY_MODE` says so — and gated on the same `viewport.groups`
  whitelist as the warning it replaces, so the per-variant `fixed` path outside every
  declared group is untouched.
- **`fixtures/jhd-v9b-2026-09-11/`** — the operator's 2026-09-11T07:31Z re-export (schema 9,
  same design-system state `bb6a0025…7224`, content hash `3dd36033…2aa4`), vendored whole:
  the JSON, its companion `design-system-handoff.md`, and the block-navigation layer brief
  from the same state at the same minute. `device/container-max-width` is now described
  "Fixed maximum container width (2156px across all breakpoints)" and carries the `fixed`
  rule. `test/parity-v9b.test.mjs` pins its artifacts byte-for-byte and asserts the run
  raises **zero** warnings.
- **A conformance allowlist (P16).** `--allow-name <name>` (repeatable) and the config's
  `conform.allowNames: []` — the same additive statement — for names that legitimately come
  from outside the export, such as the font face this package asks consumers to supply. An
  allowed name never raises `UNKNOWN_NAME`. It is not a mute button: a name the consumer's
  own stylesheet declares is still `LOCAL_ONLY`. `handoff-css conform` also takes
  `--config <mjs>`.

### Changed

- `--device-container-max-width` collapses from eleven identical `2156px` declarations to
  one on the base scope in the **v8b** and **v9** parity fixtures too — both exports state
  the `fixed` rule. v9's warning count goes 1 → 0 and v8b's 51 → 50; the vanished warning is
  `VIEWPORT_UNFLAGGED` on that same token, which is the whole point of the change. Nothing
  else in either artifact moves.
- `VIEWPORT_UNFLAGGED`'s detail now names all three signals it looked for, not two.

## 0.3.0 — 2026-09-11

Three joints in the plugin ↔ package ↔ skill pairing were soft: the package trusted any JSON
that named schema 8, the `handoff-to-code` skill existed as two hand-drifted copies, and
nothing checked a consumer's built CSS back against the export. Each is now a failing test.

### Added

- **Schema 9 support.** `fixtures/jhd-v9-2026-09-11/` vendors the operator's newest export
  (schema 9, generated 2026-09-11T06:35:12.600Z, same design-system state as v8b) and nav
  brief 6 (schema v6, companion moved to v9). Schema 9 is the same JSON shape as 8 — verified
  field by field before deciding — so `schema/design-system-handoff.schema.json`'s
  `schemaVersion` enum is `[8, 9]` rather than a second schema file; `VALIDATED_SCHEMA_VERSIONS`
  and the JHD preset's `schema.versions` both gain `"9"`. A schema version newer than every
  known one (e.g. a future 10) now fails at `/schemaVersion` instead of silently "skipping" —
  closes the gap where "unrecognized" could read as "passed." `test/parity-v9.test.mjs` pins
  the schema-9 device ramp byte-identical to v8b's; `test/responsive-census-v9.test.mjs` locks
  the export's own polish (every `viewport-*` rule under `device/`, every `viewportFraction` a
  whole percent) as a failing test against regression.
- **Export validation (P14).** `schema/design-system-handoff.schema.json` (draft 2020-12)
  states the shape the generator depends on — `codeSyntax.WEB` and `responsiveBehavior.rules[]`
  are closed, the viewport/clamp rules must carry the field they promise. `generate()` asserts
  it before emitting (schema 7 skips, legacy). `validateExport` / `assertValidExport` are
  exported, and the schema ships as `handoff-css/schema/export`.
- **Markdown grammar (P14).** `schema/design-handoff.v6.grammar.md` + `src/validate-handoff-md.mjs`:
  the layer brief's identity lines, companion block, Build standards 1–5, token rows, node
  rows and responsive grid tables, with `COMPANION_STATE_MISMATCH` (error) and
  `POLICY_VERSION_MISMATCH` (warning). `parseHandoffMarkdown` is the brief as data.
- **`handoff-css validate <file…> [--json]`** — one line per file, exit 1 on any error.
- **`handoff-css conform` (P16)** — a consumer's own CSS checked back against the pair:
  `UNKNOWN_NAME` / `LOCAL_ONLY`, `UNMAPPED_BINDING`, `SAMPLE_PX_LITERAL`, `GRID_ARITHMETIC`,
  `PLACEHOLDER_COPY`. Alias hops resolve, `@media` breakpoints are exempt, exit 1 on red.
  CSS only in 0.3.0: a binding that lives in markup is a named gap.
- **One skill, every host.** `skills/handoff-to-code/SKILL.md` is canonical;
  `scripts/build-skill-adapters.mjs` writes `dist/{standalone,claude-plugin,cursor,codex}` and
  the root `AGENTS.md`, and the committed outputs are asserted against a rebuild.

### Changed

- **Derived viewport fractions round to the percent the designer typed (P15).** A fraction the
  export derives (`244/812`) becomes `30dvh`, not `30.0493dvh`. If no whole percent is within
  `VIEWPORT_FRACTION_TOLERANCE`, three decimals are kept and `VIEWPORT_FRACTION_UNROUNDED`
  names the variable. The description path is untouched, so the house's shipped output does
  not move (`test/parity-v8b.test.mjs`).
- **First runtime dependencies:** `ajv`, `ajv-formats`. Nothing else.
- `bin/handoff-css.mjs` is now a wrapper over `src/cli.mjs` `dispatch(argv)`. Every pre-0.3.0
  invocation — bare, `--config`, `--check` — behaves exactly as before.

## 0.2.0

Responsive classes (P11), cell trust (P13), the alias block (P12), and the `handoff-to-code`
skill shipped with the package.

## 0.1.0

First release: tokens, the Tailwind `@theme` bridge, the reconciliation report and the
exclusions manifest, from a `design-system-handoff` export.
