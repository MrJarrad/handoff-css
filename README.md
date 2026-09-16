# handoff-css

Turn a Figma **Design Handoff** export into production-ready CSS: custom
properties for every variable, a Tailwind v4 `@theme` bridge so utilities speak
your names instead of Tailwind's, and a reconciliation report that tells you
exactly what it did and what it refused to guess.

Its job is to set up **production-ready code from the handoff** — not to have
opinions about your design system. Every opinion lives in one config file.

```
export.json  ──▶  handoff-css  ──▶  tokens.generated.css
                      ▲               styles.generated.css
                      │               theme.generated.css
              handoff.config.mjs      report.md
              your styles.css         exclusions.json
```

> **Status: 0.2.0, not on npm yet.** Consume it with a local link
> (`"handoff-css": "file:../handoff-css"`) until it is published.

---

## Why it exists

A token generator goes wrong in the same handful of ways every time, and all of
them are silent:

- It **invents** a value the export did not state (a unit, a divisor, a
  breakpoint) and ships something plausible but wrong.
- It **drops** a variable Figma marked "don't publish", leaving every semantic
  token that aliases it invalid at computed-value time — the element renders
  unstyled, with no error.
- It emits a key that **cycles** (`--radius-300: var(--radius-300)`), so the
  utility silently computes to `0`. No warning; just a radius that isn't there.
- It **duplicates** what you hand-authored, so two files disagree and the
  cascade picks a winner nobody chose.

handoff-css treats each of those as a hard failure or a reported class, never a
fallback. The reasoning behind every rule, with the browser measurements that
produced it, is in [`docs/POLICIES.md`](docs/POLICIES.md).

## Install

```sh
npm i -D handoff-css      # pnpm add -D handoff-css
```

## Quick start

1. Export your design system with the Design Handoff Figma plugin and commit the
   JSON. **Vendor it** — the export is the contract, and a generator run should
   be reproducible from the repo alone.
2. Write a `handoff.config.mjs`. Start from
   [`presets/jhd.config.mjs`](presets/jhd.config.mjs), a real house config with
   every key filled in and commented.
3. Wire two scripts:

```json
{
  "scripts": {
    "tokens": "handoff-css --config handoff.config.mjs",
    "tokens:check": "handoff-css --config handoff.config.mjs --check"
  }
}
```

4. Import the generated files from your stylesheet, generated **first** so your
   own declarations win:

```css
@import "tailwindcss";
@import "./theme.generated.css";
@import "./tokens.generated.css";
/* your own declarations follow */
```

5. Run `npm run tokens:check` in CI. It writes nothing and exits 1 if any
   committed artifact would change, so a stale token file cannot merge.

## The four outputs

| Output | What it is |
| --- | --- |
| `paths.out` | Every variable as a CSS custom property, grouped by collection, placed on `:root` / a theme class / a `@media (min-width)` block per the export's own mode rows. |
| `paths.theme` | One `@theme inline` block: your names as Tailwind keys, Tailwind's default scale reset away. |
| `paths.report` | The audit trail — what matched your stylesheet, what drifted, what could not be converted and why, which variables are private vs hidden vs excluded, which namespaces are held. |
| `paths.exclusions` | Machine-readable EXCLUDED + PRIVATE name lists, so a downstream conformance checker never needs its own copy of your policy. |

## Library use

```js
import { generate } from "handoff-css";
import config from "./handoff.config.mjs";

const out = generate(JSON.parse(exportJson), config, { handAuthoredCss });
// out.tokensCss, out.themeCss, out.report, out.exclusionsJson
// out.rows, out.themeRows, out.privateRows, out.hiddenRows, out.excludedRows
// out.aliasRows, out.warnings
```

`generate` is pure — no filesystem, no `process`. The rows are the report's data
before it is rendered, so you can build your own checks on them.

## Config

`handoff.config.mjs` default-exports one object, validated against
[`schema/config.schema.json`](schema/config.schema.json) on every run. There are
**no defaults**: an unstated policy is an error, not a guess.

| Key | What it decides |
| --- | --- |
| `schema.name` / `schema.versions` | Which export contract you have actually read. A superseded schema still parses, so it is rejected rather than accepted. |
| `paths.*` | Export in, four artifacts out, plus your own stylesheet. |
| `paths.styles` | Optional, schema 12+: where the style classes go. One class per Figma style, selector and declarations from the export's own `cssClass`, verbatim (P21). Unset, or an older export, writes no file. |
| `exclude.paths` | `"<collection>/<variable>"` prefixes that are never emitted — authoring scratch, Figma-only hacks. Applied on path identity, never revived by an alias. |
| `color.format` | `rgb-slash-percent` (`#rrggbb` at full alpha, else `rgb(r g b / pct)`) or `hex8`. |
| `motion.timingUnit` | `ms` or `s`. Figma stores a TIMING variable in seconds; `ms` republishes it in milliseconds, so a step named for its milliseconds reads in the unit its name states (P19). |
| `motion.delayAliasOf` | The delay and duration group prefixes. A delay step holding a duration step's value as its own literal instead of aliasing it raises `DELAY_NOT_ALIASED`. Reported, never rewritten (P19). |
| `aspect.ratioPaths` | `"<collection>/<variable>"` prefixes whose STRING variables hold a ratio (`core/aspect/`). `"3:2"` renders as the CSS value `3 / 2`; every STRING outside them stays quoted (P20). |
| `aspect.descriptionGroup` / `.descriptionPattern` | Optional cross-check: the excluded per-column-span height groups that describe the same ratios. A description contradicting the authored variable raises `ASPECT_DESCRIPTION_DISAGREES` and changes no value (P20). |
| `layout.collection` | The collection whose modes are responsive breakpoints rather than themes. |
| `layout.variantAttribute` | The attribute that selects a non-default layout variant. |
| `layout.baseMode` | `smallest-default-variant` (mobile-first) or `collection-default`. |
| `modes.collectionModeAttribute` | Selector template for a multi-mode collection with no width or theme semantics. `{collection}` is substituted. |
| `themes.collection` | Fallback gate if an export ever stops publishing `isTheme`. |
| `themes.total` | Theme modes that replace their siblings entirely (see P10). |
| `tailwind.namespaces` | Which Tailwind namespaces you populate, and which name segment each claims. |
| `tailwind.held` | Namespaces deliberately **not** reset, each with its blocker stated. |
| `tailwind.rootFontSizePx` | px→rem divisor; `null` reads the export's own `units.policy.rootFontSizePx`. |
| `responsive.honourClasses` | Which responsive classes may change the output (see below). |
| `viewport.heightUnit` / `viewport.widthUnit` | The units a viewport fraction is emitted in — `dvh` / `vw`. |
| `viewport.descriptionFallback` | Read the `"N% of screen height\|width"` description convention as a viewport signal. |
| `viewport.groups` | Variable-name prefixes you declare viewport-relative; an unstated member is reported, not guessed. |
| `aliases` | Name-pattern → target-pattern alias block (see below). |
| `report.*` | Report title, where your policy write-up lives, and the narrative paragraphs. |
| `header.regenerateCommand` | Printed into every generated file, so a reader knows how to reproduce it. |

### Responsive classes

A dimensional variable's **class** decides how many declarations it gets, not
its mode count:

| Class | Emitted as |
| --- | --- |
| `viewport-width` / `viewport-height` | One declaration on the base scope, the fraction in `vw` / `dvh`. The per-mode px samples are dropped. |
| `fluid-clamp` | The export's own `clamp()`, once per layout variant. |
| `fixed` | One declaration per layout variant. |
| `mode-stepped` | Per-mode, in ascending `@media (min-width)` blocks. |
| `sample-only` | Per-mode, from the one published sample. |

The class comes from a `responsive` block on the variable, else a description
matching exactly `N% of screen height` / `N% of screen width`, else the
export's own `responsiveBehavior.rules[].viewportFraction` (a fraction stated
by the rule itself, source `rule`), else a bare `.strategy` with no fraction
(a hint only), else the per-mode default. The description convention is a
supported input rather than a stopgap: Figma variables carry no viewport
semantics, so it is the only place a designer can currently state the
fraction — which is also why it beats a rule fraction on disagreement (more
than 0.005 apart): a `VIEWPORT_FRACTION_DISAGREES` warning names both values
and the description wins.

`responsive.honourClasses` lists the classes allowed to change your output —
`[]` pins the per-mode behaviour of 0.1.0 exactly, so you adopt one class at a
time.

`viewport.groups` is the whitelist of variable-name prefixes that may become
viewport units at all — every source above is gated by it, because an export
can state a fraction for a variable that is not a fraction of the screen (the
2026-09-10 schema-8 export does so for a font size, a letter-spacing, an icon
radius and a grid column start). A stated fraction outside every declared
prefix keeps its per-mode samples and is reported as
`VIEWPORT_OUTSIDE_GROUPS`; `groups: []` opts out of the gate entirely.

Nothing is guessed either way: a `viewport.groups` member with no stated
fraction stays px and is reported as `VIEWPORT_UNFLAGGED`, and a wrong
description yields a wrong token on purpose (the export is the contract; the
fix is in Figma). Full rules: [P11](docs/POLICIES.md).

### Cell trust

The export's `build` cell states the value (P4) — but only while it agrees with
itself. An `identity` conversion whose `rawValue` and `convertedValue` differ,
or a `css` unit that is not the cell's own `buildUnit`, is **untrusted**: its
`css` is never emitted. The value falls to a stated fraction if there is one,
otherwise to the raw source value in the cell's own `sourceUnit`, always with a
`BUILD_CELL_CONTRADICTORY` / `BUILD_CELL_UNIT_MISMATCH` warning and a §10 row
carrying the raw/converted pair; a cell with no `rawValue` to fall back on is a
hard failure. Float32 noise is not a contradiction. For the same reason a
responsive class with no fraction behind it is only a hint and changes nothing
(`VIEWPORT_CLASS_WITHOUT_FRACTION`). Full rules: [P13](docs/POLICIES.md).

### Aliases

```js
aliases: {
  "--screen-height-*": "--device-screen-height-*",
  "--height-screen-*": "--screen-height-*",
}
```

Each pattern ends in exactly one `*`, which binds to the leaf of every emitted
name matching the target — so the alias set is derived from what was generated,
not maintained by hand. Patterns may target an earlier pattern's output. The
result is one `:root` block of `var()` hops after the collections; the token
stays the single place the value is stated. A collision with a generated or
hand-authored name is a hard failure. Full rules: [P12](docs/POLICIES.md).

### Report narrative

The report's tables are mechanics and always generic. Every paragraph that states
something about **your** system — which ruling excluded a path, which modes your
layout collection publishes, why a namespace is held — is a string under
`report.notes`, interpolated with `{{name}}` placeholders. Supply none and you
still get the whole report; it just carries no commentary.

## CLI

```
handoff-css [--config <mjs>]        default: ./handoff.config.mjs
            [--input <json>] [--out <css>] [--theme <css>]
            [--report <md>] [--exclusions <json>]
            [--check]

handoff-css validate <file…> [--json]

handoff-css conform --export <json> --handoff <md> --tokens <css>
                    --css <file…> [--json]
```

Flags override `paths.*`. `--check` writes nothing and exits 1 on any
difference.

### `validate` — is the pair itself well-formed?

```sh
handoff-css validate export.json design-handoff-block-navigation.md
```

A `.json` file is checked against `schema/design-system-handoff.schema.json` (schema 8
and 9; schema 7 is skipped: legacy). A `.md` file is checked against the line grammar in
`schema/design-handoff.v6.grammar.md` — identity lines, the companion block, Build
standards 1–5, token rows, node rows, the responsive grid tables. One line per file, the
findings under it, exit 1 on any **error**. A warning never fails the run: it is a decision
waiting on a human. `--json` prints the same result machine-readably. Table/footnote notes
accept either the plugin's current `†` sigil or the pre-2026-09-11 `⚠` (0.3.2).

### `conform` — does the built CSS honour the pair?

```sh
handoff-css conform --export export.json \
                    --handoff design-handoff-block-navigation.md \
                    --tokens src/tokens.generated.css \
                    --css src/app/globals.css \
                    --allow-name --font-suisse
```

| Finding | Severity | What it means |
| --- | --- | --- |
| `UNKNOWN_NAME` | red | a `var(--x)` in neither the export nor the generated tokens (alias hops resolve first) |
| `LOCAL_ONLY` | amber | the stylesheet declares the name itself — a local value, not a token |
| `UNMAPPED_BINDING` | amber | the handoff states a binding the generated tokens never declare |
| `SAMPLE_PX_LITERAL` | red / amber | red for a device/viewport sample (`812px`), amber for any other token px; an `@media` breakpoint is exempt |
| `GRID_ARITHMETIC` | red | column maths where the handoff states `col-span N/M` — Build standard 5 names a grid container |
| `PLACEHOLDER_COPY` | amber | a `⚠ placeholder` string shipped as content |

Exit 1 on any red. **CSS only in 0.3.0** — a binding that lives in markup (a utility class,
a styled component, an inline style) is invisible to this check, and that is a named gap.

**Allowing a name.** Some `var()` names legitimately come from outside the export — a font
face this package asks you to supply, for instance. `--allow-name <name>` (repeatable) and
the config's `conform.allowNames: []` are the same statement, and both are additive:

```js
// handoff.config.mjs
export default {
  // …
  conform: { allowNames: ["--font-suisse"] },
};
```

An allowed name never raises `UNKNOWN_NAME`. It is not a mute button: a name your own
stylesheet declares is still `LOCAL_ONLY`.

### Roadmap — `conform` on a served DOM (spec only, not implemented)

Today's `conform` reads **source CSS files** (`--css <file…>`) and static text — it never
sees what actually renders. The next scope is a second `conform` mode that reads
**computed styles from a live DOM** instead:

```
handoff-css conform --export <export>.json --handoff <design-handoff>.md \
                    --url <served page> [--json]
```

- The page is loaded (a headless browser drives it), and for every node the handoff names,
  `getComputedStyle()` on the matching DOM element replaces the source-file scan `--css`
  does today. This catches what a source read cannot: a build step that inlines or purges a
  custom property, a CSS-in-JS layer that never touches a `.css` file, a cascade override
  from a later stylesheet the source list didn't include.
- Findings keep the same vocabulary (`UNKNOWN_NAME`, `SAMPLE_PX_LITERAL`, `GRID_ARITHMETIC`,
  `PLACEHOLDER_COPY`, …) — the *source* of a value changes from "declared in this file" to
  "resolved at this element," the severity table does not.
- `--url` and `--css` are mutually exclusive inputs to the same command, not two different
  commands: one reads static declarations, the other reads what the browser actually
  computed, and a consumer picks whichever matches how their build ships CSS.
- Out of scope for this spec: which headless browser, how node→selector matching is
  authored (most likely the handoff's own node ids via a `data-node-id` convention, still
  to be decided), and whether markup itself (not just CSS) gets a served-DOM check. Those
  are open questions for whoever implements this, not settled here.

This section states the shape only — no code in this package implements `--url` yet.

## Pair it with the skill

`skills/handoff-to-code/SKILL.md` ships in this package. It is the procedure for the other
half of the job — turning the generated tokens into code that matches the handoff — written
for a coding agent (Claude Code, Cursor, or anything that reads a `SKILL.md`) and readable
by a person in five minutes.

It covers what the generator cannot: reconciling the `design-handoff` markdown's companion
hashes against the JSON's own before you build, reading each warning as a decision rather
than noise, mapping every `$variable` in the handoff through its **`codeSyntax.WEB`** name
(no emitted token is a defect, not a guess), treating the handoff's own Build standards as
the mechanism each value must be produced by, and returning a deviation table that stops for
a ruling instead of quietly picking a side.

Point your agent at it:

```
skills/handoff-to-code/SKILL.md      # or copy it into .claude/skills/ / your agent's skills dir
```

## Library use, the validation and conformance entries

The package publishes `.` (plus `./presets/jhd`, `./schema`, `./schema/export`) and
nothing else, so everything importable comes from the one entry:

```js
import {
  generate, run,
  validateExport, assertValidExport, exportSchema, VALIDATED_SCHEMA_VERSIONS,
  parseHandoffMarkdown, validateHandoffMarkdown,
  conform, FINDINGS, renderConformMarkdown, renderConformJson,
  validateConfig, configSchema,
} from "handoff-css";
import schema from "handoff-css/schema/export" with { type: "json" };
```

Every one of them is pure: text or parsed documents in, findings out.

## Guarantees

- **Deterministic.** Collections sorted by name, variables by name, floats
  rounded at 6 places. Same inputs → byte-identical output.
- **No invented values.** A conversion the export could not complete is emitted
  raw with an `UNCONVERTED:` comment and listed in the report. The divisor is
  never guessed.
- **Disagreement is a failure.** If the export contradicts itself (a `build.raw`
  that does not match its own `raw`), the run stops rather than picking a side.
- **Your stylesheet wins.** A custom property you declare globally is reported,
  not overwritten (P2).
- **The export is checked before it is trusted** (P14). A schema-8 export that
  does not match the published schema stops the run at a JSON pointer, rather
  than producing three-quarters of a stylesheet.
- **A derived fraction rounds to the value a designer typed** (P15), and says
  so out loud when it cannot.
- **One skill, every host** (Lock 2). `skills/handoff-to-code/SKILL.md` is the
  only copy; the adapters under `skills/handoff-to-code/dist/` are built from it
  and asserted against a rebuild, so two hosts cannot drift apart.

## Development

```sh
node --test 'test/**/*.test.mjs'
```

`test/parity.test.mjs` asserts the outputs byte-identical against a real
committed design system's artifacts — the fixture under `fixtures/jhd-v7b/`,
generated with every 0.2.0 class pinned off. That test is the reason a refactor
here is safe. `fixtures/jhd-v7c/` is a second real export of the same system,
re-exported after three variable descriptions were filled in, and is what the
description convention is tested against.

## Licence

MIT.
