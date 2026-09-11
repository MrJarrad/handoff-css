# Changelog

All notable changes to `handoff-css`. Dates are the release date; versions follow semver.

## 0.3.0 — 2026-09-11

Three joints in the plugin ↔ package ↔ skill pairing were soft: the package trusted any JSON
that named schema 8, the `handoff-to-code` skill existed as two hand-drifted copies, and
nothing checked a consumer's built CSS back against the export. Each is now a failing test.

### Added

- **Export validation (P14).** `schema/design-system-handoff.v8.schema.json` (draft 2020-12)
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
