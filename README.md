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
2. Write a `handoff.config.mjs`. Start from a complete config with
   every key filled in (the Config section below explains each).
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
import { generate, generateSet } from "handoff-css";
import config from "./handoff.config.mjs";

const out = generate(JSON.parse(exportJson), config, { handAuthoredCss });
// one design system split across files (0.14.0): every file's export, joined by key
const set = generateSet([primitives, product], config, { handAuthoredCss });
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
| `layout.breakpoints` | `{ family: px }` house MIN-WIDTH THRESHOLD policy, keyed by `breakpoints.entries[].family` (e.g. `"lg"`). Overrides the emitted `@media (min-width)` threshold and the matching `--breakpoint-<family>` token; a family not in the map keeps the Figma sample `widthPx` unchanged — Figma's `device/width` samples are never rewritten (P6.1). Required, may be `{}`. |
| `modes.collectionModeAttribute` | Selector template for a multi-mode collection with no width or theme semantics. `{collection}` is substituted. |
| `themes.collection` | Fallback gate if an export ever stops publishing `isTheme`. |
| `themes.total` | Theme modes that replace their siblings entirely (see P10). |
| `themes.variants` | Optional. Per total theme, `{ sibling: variantMode }`: the variant mode takes `.total .sibling` / `.total.sibling` instead of the total theme (see P10b). |
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
            [--input <json|zip>…] [--out <css>] [--theme <css>]
            [--report <md>] [--exclusions <json>]
            [--check]

handoff-css validate <file|zip…> [--spec-index <md>] [--json]

handoff-css conform --export <json> --handoff <md> --tokens <css>
                    --css <file…> [--json]

handoff-css match [--handoff <md>] [--export <brief .json>] --src <path…> [--rulings <md>] [--json]

handoff-css ramp --export <json|json.gz|zip> --anchor <#hex>[@step]… [--name <name>] [--from-scratch]
                 [--for <semantic>[@step]… --on <surface>… [--use text|large-text|ui] [--keep-anchor]] [--out <dir>] [--json]

handoff-css vendor <export.json> [<export.md>] | <export.zip> --into <dir>
```

Flags override `paths.*`. `--check` writes nothing and exits 1 on any
difference.

**The plugin's `.zip`** (0.14.0). Every command takes the `.zip` the Design System Handoff
plugin and `design-handoff-script` save, in place of the `.json` and `.md` inside it. `validate`
names each file as `<zip> › <file>`; anything else in the zip (screenshots) is ignored.
Stored and deflated entries are read with `node:zlib`; ZIP64 and encrypted zips are refused.

**A design system split across Figma files** (0.14.0). Each file's Design System Handoff
export lists only its own variables; a variable used from a library arrives as an alias carrying
the library's key. Give every file's export — `--input` once per file, or a list in
`paths.input` — and they are joined by variable key into one token file, library aliases kept
as `var()`:

```sh
handoff-css --input design/handoff/latest/primitives.json --input design/handoff/latest/product.json
```

The join never guesses. It stops, naming both files, when one key is stated two different ways
(`MERGE_KEY_CONFLICT`), two variables claim one CSS name (`MERGE_NAME_COLLISION`), or one export
is given twice (`MERGE_SAME_EXPORT`). An alias whose library export was not given is inlined and
reported, as it is for a single export.

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
A Design System Handoff export's own `.md` (`- Schema: \`design-system-handoff\` v<N>`) is
named and skipped — its JSON is the contract — and never stands in for a brief's `.md`. A brief
`.md` alone and beside its `.json` reports the same `POLICY_VERSION_MISMATCH`.

**An export set** (0.11.0). Give a brief's `.json` + `.md` with every Design System
Handoff export it was made from, and `validate` adds a `(set)` result:

```sh
handoff-css validate design-handoff-overlay.json design-handoff-overlay.md \
                     design-system-handoff.json \
                     --spec-index spec-index.md
```

| Finding | Severity | What it means |
| --- | --- | --- |
| `STALE_PAIR` | error | a given export is not the run the brief names (companion hashes, or `linkRun` `generatedAt`); the message names the fix — `design-handoff --regenerate …` when the export is the newer half, the run the brief names when it is the older |
| `SET_MEMBER_MISSING` | error | `linkRun.designSystemExports` names an export that was not given |
| `LINK_RUN_NOT_FOR_BRIEF` | error | the link-run file beside the brief (`<brief>.link-run.json`, schema `design-handoff-link-run`) names another brief's `contentHash` |
| `LINK_RUN_TWICE` | error | the brief carries `linkRun` and a link-run file was given too: one source |
| `SPEC_INDEX_PATH_MISSING` | error | the spec index lists a file that is not there |
| `SPEC_TEXT_NOT_IN_EXPORT` | warning | a spec has no text in the export and no `--spec-index` was given |
| `SPEC_NOT_INDEXED` | warning | a spec has no row in the spec index (matched by file key + node id) |
| every `linkRun.findings[].code` | warning | the link-run script's own findings, under their own codes |
| `DS_EXPORT_OUT_OF_DATE` | warning | the link-run findings say this file's Design System Handoff export is behind the file: one ask, that plugin run on the named file |
| `SCHEMA_NEWER_THAN_CHECKER` | warning | (brief or export result) a `schemaVersion` newer than this package knows: checked as the newest known; each field it has never seen is listed as a warning, while a missing required field or a wrong type stays an error |

The spec index is a markdown table with `file key | spec node id | spec | path` columns; the
path is a markdown link, resolved against the index's own folder. Each listed spec's file is
printed under the `(set)` line (`specs[]` in `--json`). Brief schemas v13 (catch-up) and v14
(`specs[]`, `builtReference[]`) validate the script's and the plugin's current exports.

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

### `match` — brownfield: a brief against code that already exists

For a project with its own tokens and components and no Design System Handoff export:

```sh
handoff-css match --handoff design-handoff-block-overlay.md --src src --rulings handoff-rulings.md
```

Every Figma variable (the brief's token rows) and component (its component list) gets the
closest existing code match — evidence on name, value and usage, and a confidence
(`high`/`medium`/`low`) — or is reported unmatched. A value alone is never a proposal. The text
report ends with every unruled item as a row of the ruling table (`| kind | figma | ruling |
code | note |`, ruling `use`/`new`/`skip`); pass the filled table back with `--rulings` and the
next run reuses it, reporting `RULING_STALE` when a `use` names code that has gone. Exit 1 until
every item is ruled. Rules and shape: `docs/POLICIES.md` P26,
`skills/handoff-to-code/references/brownfield.md`.

**Raw values.** A value the layer states as a plain number, not bound to a Figma variable,
is listed by `design-handoff-script` in the link-run file beside the brief (`unboundValues`; a layer
that binds no variables needs no Design System Handoff export). `--export <brief .json>` matches each,
by value, to the project's token of the same kind: a colour you can't tell apart (CIEDE2000 ΔE < 1,
alpha equal) or a number within half a pixel is **built with the token** and listed (when several tokens qualify, the closest, then the
lowest name, is built as `tie-picked` and the others are named); a slightly-off
colour (ΔE < 5, token suggested), a number between two steps (both neighbours), beyond the scale, or
no token of its kind **needs a call** — built with the exact value and a deviation row until
ruled `use` or `keep` (`raw-<kind>` rows). Listed raw values never fail the run. Worked example:
`fixtures/ht102-raw-values/`.

### `profile` — how is this system built?

`handoff-css profile --export <json|json.gz|zip> [--out <dir>] [--check]` writes `system-profile.json` and
`system-profile.md` from one Design System Handoff export, for any system's naming: collection roles from the alias
graph (primitive, semantic, mixed, standalone), name shape and code-name rule, groups, ramps with their own steps and
end colours, sibling gaps, mode meaning with how it was detected (the export's own classification, or the mode count),
scope and description coverage, and the list of existing names. A gap is a fact, not a verdict. `--check` writes
nothing and exits 1 naming the file that has drifted.

What counts as a sibling gap, stated so it can be checked: sibling groups are groups of one collection whose paths
differ at exactly one segment (`color/*/action`). A group takes part only if it shares at least 50% of its leaves with
the family (shared leaves over the family's distinct leaves). A **gap** needs a family of **at least 3** such groups and
a leaf held by a **strict majority** of them (exactly half is not a gap). A family of exactly **2** cannot outvote
itself, so a difference there is listed under `siblingObservations` as a fact (which leaves each group alone has),
never as a gap. A group under the 50% overlap is left out of both lists. The same thresholds head `system-profile.md`.

### `resolve` — what in the system covers this need?

`handoff-css resolve --export <json|json.gz|zip> --need <needs.json> [--rulings <md>] [--out <dir>] [--json]` reads one
export and a list of needs, and writes `resolve-report.json` and `resolve-report.md`. It never invents a name.

A need (`schema/resolve-need.v1.schema.json`): `{ "id", "name"?, "group"?, "collection"?, "wants"? }`, at least one of
`name`, `group`, `wants`. `wants` maps a mode name (or `*` for every mode) to the raw value the build holds
(`"#00000078"`, `12`, `"16px"`). Per need the report gives up to five ranked candidates, each with its values per
mode, a `distance` from the wanted value (0 is the same; colour distance is OKLab ΔE ×100 plus alpha, numbers are a
percentage difference) and `evidence` naming the profile fact it came from, then one verdict:

| Verdict | Means | Open |
| --- | --- | --- |
| `REUSE` | the name exists and holds the wanted value, or (no name asked) a name holds it exactly | no |
| `SIBLING` | no name asked; the nearest name is within tolerance but not the same value — ask once | yes |
| `MISMATCH` | the name exists but holds another value | yes |
| `NEW_NAME` | the name is not in the system; `bindTo` shows the existing value each mode could point at | yes |
| `NEW_RAMP` | nothing in the system holds the wanted value in every mode asked — the designer decides | yes |
| `RULED` | a ruling row settles it | no |
| `RULING_STALE` | a `use` ruling names something the export does not have | yes |

Two tolerances decide the verdicts, on the `distance` above and the worst mode (a `*` want must hold in every mode of
a candidate). **Same**: a distance of **0.5 or less** is the same value (colour ΔE×100 plus alpha; numbers as a percent);
this is also `REUSE`'s line, whether or not a name is asked, so 0.5 reuses and anything over it is a `SIBLING` (no name)
or a `MISMATCH` (name asked). **Near**: a distance of **5 or less** is close enough to rank, to be offered as a `SIBLING`
and to be a `bindTo` target; over 5 is `NEW_RAMP`. Both edges are tested on either side (`test/resolve.test.mjs`).

Ranking, in order: the exact name; a sibling in the asked group (a name in a `siblingGaps` family is cited as
evidence); the smaller distance (worst mode, then sum); semantic before primitive; name text. Every open need carries
`fallback: raw-value, assumed-ask`: build the raw value and say so until it is ruled. `siblingObservations` appear in a
candidate's evidence and never change a verdict.

Rulings are the same table `match` reads: `| kind | figma | ruling | code | note |` with kind `resolve-need`, `figma`
the need id, ruling `use` (with the existing name in `code`), `new` (the designer approved the new name) or `skip`.
Exit codes: `0` every need is `REUSE` or `RULED`; `2` at least one need is open (the report is still written);
`1` a usage or input error (nothing written). The report is a function of the export, the needs and the rulings, so a
rerun is byte-identical (`test/resolve.test.mjs`).


### `components` — how does this system build its components, and does it already have this one?

`handoff-css components [--export <layer export .json|.json.gz>…] [--ds-export <Design System Handoff export>…] [--out <dir>] [--check]` reads one or more Design
Handoff layer exports and writes `component-profile.json` and `component-profile.md`: the components seen (a layer
export lists only the components its layers use and define, so the count is "of an unknown total" unless `--ds-export`
passes a Design System Handoff export of schema 20 or newer: it lists every component its file defines, so the profile
reports "N of M defined in the library are placed", names the ones no layer placed, and counts a component placed
from another library as outside it, never in the total), how they are
named, the properties they share, how deeply they nest, and which token collections they bind. Facts only. A
component name defined in two exports is read as one component and warned about.

`--ds-export` alone (no `--export`) makes the profile the inventory itself: every component the Design System Handoff export's file defines, with its properties, none counted as placed. The inventory is counted per library component (page and name), so a name defined on two pages is two components; a layer instance names the component but not its page, so `coverage.ambiguousNames` lists those names.

`... --src <code paths…>` also reads each React component's structure from code and writes `component-code-compare.json` and `.md`: per design component, its code match (names equal once case and separators are set aside; never by similarity), each property as matched, a value gap (variant options differ) or a prop gap (no same-named code prop; the Figma `#id` suffix and kebab case are set aside), composition (a nested component the code does not render, and the reverse), code props the design lacks, and the design-only and code-only components. It is a text scan, not a type checker: a props type it cannot see into is listed as extended, never guessed. Classing a gap (build prop, state, responsive, Figma-only) stays the designer's.

`... --need <needs.json> [--rulings <md>]` resolves each need (`schema/resolve-component-need.v1.schema.json`:
`{ "id", "name"?, "wants"? }`, with `wants.props` and `wants.children`) and writes `component-resolve-report.json`
and `.md`. Verdicts: `REUSE`, `REUSE_WITH_PROP` (build it, set the listed properties), `PROP_GAP` (extend the
component, never fork it), `SIBLING`, `COMPOSE`, `NEW_COMPONENT` (with the naming and property pattern the system
shows), `RULED`, `RULING_STALE`. Rulings use kind `resolve-component`. Exit 2 while a need is open. Detail:
`skills/handoff-to-code/references/reuse-or-add.md` § Components.

### `ramp` — a whole new ramp, and which step each colour uses

`handoff-css ramp --export <json|json.gz|zip> --anchor <#hex>[@step]… [--name <name>] [--from-scratch] [--for <semantic>[@step]… --on <surface>… [--use text|large-text|ui] [--keep-anchor]] [--out <dir>] [--json]`
is for the case `resolve` reports as `NEW_RAMP`: nothing in the system holds the colour. It proposes a **whole primitive ramp**
(never one colour) and writes `ramp-proposal.json` (a patch, `schema/ramp-proposal.v1.schema.json`) and
`ramp-proposal.md`. It writes nothing into Figma: an agent (after a yes) or the designer applies the patch there, then the
export is taken again and `profile`/`resolve` see the new ramp.

- **The system's own steps and naming.** Steps, the dark and light ends, and the evenness and hue-drift limits come from
  `fitToSystem` over the system's colour ramps; the collection, parent group and web-name pattern come from those ramps'
  variables. A system with no colour ramps, or `--from-scratch`, gets the engine's defaults (100–900, darkest step at L 0.30).
  Nothing is assumed about a house: no collection, mode, step or group name is written in the code.
- **Anchors.** `--anchor` repeats; `#hex@step` pins a colour to a step and it is kept exactly there. Several anchors are
  merged into one ramp when `mergeVerdict` says they make sense as one; if not, the proposal is one ramp per anchor.
- **The name** is yours (`--name`) or generated (Name that Color, skipping names the system already uses for a ramp).
  Neither is forced: a generated name is printed with a question ("keep it, or give your own?") and `nameSource` says which.
- **Semantic colours.** `--for <variable>[@step]` names a semantic colour; `--on <variable>` names the surface(s) it is read
  on (several: it must pass on all of them). Nothing is inferred from names. For each mode of the semantic's collection the
  report gives the step, the contrast ratio on the surface, and why. The start step is the `@step`, else the lowest anchor
  step. The collection's default mode keeps the start step if it passes, else the nearest step that does. A mode whose
  surface is darker than the default mode's by more than 0.15 OKLCH L is mapped by mirroring the start step by lightness,
  then the nearest passing step if the mirror fails; `--keep-anchor` keeps an anchor step across modes instead when it
  passes there. A step used that clears 4.5 by more than 0.5 is eased back toward 4.5 (never an anchor; see the helpers).
  `--use` picks the floor: `text` 4.5 (default), `large-text` and `ui` 3.
- **Exit codes.** `0` every mapping has a passing step; `2` at least one has none (written, and named in the report);
  `1` a usage or input error (nothing written). A run is deterministic.

The mapping uses these color-engine helpers (`handoff-css/color-engine`), all pure and on any step scale:

| Entry | What it does |
| --- | --- |
| `contrast(fg, bg)`, `grade(fg, bg, use?)` | WCAG 2.x ratio to two places; `{ ratio, pass, floor }` against AA 4.5 (`text`) or 3 (`large-text`, `ui`). |
| `nearestPassingStep(ramp, from, surfaces, use?)` | The step nearest `from` that passes on **every** surface; a tie goes to the lower step number; `null` if none. |
| `mirrorStep(ramp, lightStep)` | The step whose lightness mirrors the light step's across the ramp's own range (darkest + lightest − L), not the step number. A step the ramp lacks mirrors across the ends of the scale. |
| `pullBack(ramp, step, surface, { anchor? })` | Eases an overshooting step toward 4.5: moves its lightness toward the surface to a hair past 4.5, within 0.05 L of where it was and 0.05 L from each neighbour so the ramp stays monotonic. `null` if it does not overshoot by more than 0.5, is an anchor, or has no room. |

Open choices, because the helpers' origin is silent on them (each is tested, and changing one is a one-line decision):
the mirrored-mode test (surface darker by 0.15 L); where a mapping starts when no `@step` is given (lowest anchor step);
`--keep-anchor` being a flag rather than inferred from a name; the 3:1 floor for `large-text` and `ui` also standing in
for the pull-back, which only runs for `text`; and eased-back steps being recorded on the ramp (`nudged.from`) rather than
applied to a sibling.

### `vendor` — add a new export without overwriting the old one

```sh
handoff-css vendor design-system-handoff.json --into design/handoff
```

For a project that keeps each vendored set in `design/handoff/v<N>-<date>/` with `latest` a
symlink to the current one. Writes `v<N+1>-<date>/` (date from the export's `generatedAt`): the
set `latest` points at, carried forward, with the new export (and its `.md`, if given) in place
of its old self under its `artifactFilename`. Then `latest` is repointed and the run prints the
new folder, what was carried forward, and that the old folder was kept. An export `latest`
already holds (same `contentHash`) writes nothing; a `latest` that is a real folder is refused.

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

The package publishes `.` (plus `./schema`, `./schema/export`, `./color-engine` and a house preset under `./presets/`) and
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

## Color engine

`handoff-css/color-engine` builds full primitive colour ramps when nothing in a design system fits. It
is pure (colours in, ramps out) and works in OKLCH.

```js
import { ramp, mergeVerdict, fitToSystem, nameColor, auditRamp, DEFAULTS, grade, nearestPassingStep, mirrorStep, pullBack } from "handoff-css/color-engine";

// An existing system: take its step scale, its ramps' ends and its own limits.
const system = fitToSystem([{ name: "sky", steps: [{ step: 50, hex: "#e9faff" }, /* … */] }, /* … */]);

// One seed, or several anchors merged into one ramp. An anchor with no step is placed for you.
const r = ramp({ anchors: [{ hex: "#14d7fb", step: 300 }, { hex: "#2b67b9", step: 700 }], steps: system.steps, lightness: system.lightness });
// r.steps: [{ step, hex }, …], each anchor marked anchor: true
// r.placement: where each anchor sits; r.audit: lightness per step, evenness, hue drift

// Does merging make sense? merge is true only when the ramp gets darker at every step and is no less
// even and no more hue-drifting than the system's own ramps; reasons[] says what passed and failed.
const { merge, reasons } = mergeVerdict({ anchors: [{ hex: "#14d7fb" }, { hex: "#2b67b9" }], system });

// A name, only when asked for one; names the system already uses can be passed over.
nameColor("#14d7fb", { exclude: ["Bright Turquoise"] }); // { name, slug, hex, distance, exact }
```

| Entry | What it does |
| --- | --- |
| `ramp({ anchors, steps?, lightness? })` | A ramp through one anchor or several, on any step scale (100–900, 50–950, 1–12). Each anchor's hex is kept exactly at its step. `lightness: { min, max }` sets the OKLCH lightness of the darkest and lightest step. |
| `fitToSystem(ramps)` | The step scale most of the system's ramps use, the median lightness of their darkest and lightest steps, and the widest evenness and hue drift among them. |
| `mergeVerdict({ anchors, steps?, system? })` | `{ merge, reasons, ramp }`. Lightness, evenness and hue drift decide; the pairing rule (one hue within 10°, at least two steps apart, neutrals only with neutrals of the same temperature) is reported but does not decide. |
| `nameColor(hex, { exclude? })` | The nearest name on the Name that Color list. |
| `auditRamp(steps)` | Lightness drop per step, evenness (spread of those drops, 0 = even) and hue drift (smallest arc of the wheel holding every hue with chroma above 0.05). |
| `DEFAULTS` | A new system with nothing to fit: steps 100–900, darkest step at L 0.30, lightest step as light as the hue allows. With no system, `mergeVerdict` allows evenness up to the widest the default ramps make on the scale in use (0.0319 on 100–900, 0.0975 on 100–500) and hue drift up to 50°. |

The colour names are Name that Color by Chirag Mehta, under Creative Commons Attribution 2.5; see
`src/color-engine/THIRD-PARTY-NOTICES.md`. Everything else is MIT.

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
committed design system's artifacts, a fixture under `fixtures/`,
generated with every 0.2.0 class pinned off. That test is the reason a refactor
here is safe. A second fixture is a second real export of the same system,
re-exported after three variable descriptions were filled in, and is what the
description convention is tested against.

## Licence

MIT.
