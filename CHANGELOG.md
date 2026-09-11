# Changelog

All notable changes to `handoff-css`. Dates are the release date; versions follow semver.

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
