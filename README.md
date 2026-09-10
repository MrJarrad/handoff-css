# handoff-css

Turn a Figma **Design Handoff** export into production-ready CSS: custom
properties for every variable, a Tailwind v4 `@theme` bridge so utilities speak
your names instead of Tailwind's, and a reconciliation report that tells you
exactly what it did and what it refused to guess.

Its job is to set up **production-ready code from the handoff** — not to have
opinions about your design system. Every opinion lives in one config file.

```
export.json  ──▶  handoff-css  ──▶  tokens.generated.css
                      ▲               theme.generated.css
                      │               report.md
              handoff.config.mjs      exclusions.json
              your styles.css
```

> **Status: 0.1.0, not on npm yet.** Consume it with a local link
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
// out.warnings
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
| `exclude.paths` | `"<collection>/<variable>"` prefixes that are never emitted — authoring scratch, Figma-only hacks. Applied on path identity, never revived by an alias. |
| `color.format` | `rgb-slash-percent` (`#rrggbb` at full alpha, else `rgb(r g b / pct)`) or `hex8`. |
| `layout.collection` | The collection whose modes are responsive breakpoints rather than themes. |
| `layout.variantAttribute` | The attribute that selects a non-default layout variant. |
| `layout.baseMode` | `smallest-default-variant` (mobile-first) or `collection-default`. |
| `modes.collectionModeAttribute` | Selector template for a multi-mode collection with no width or theme semantics. `{collection}` is substituted. |
| `themes.collection` | Fallback gate if an export ever stops publishing `isTheme`. |
| `themes.total` | Theme modes that replace their siblings entirely (see P10). |
| `tailwind.namespaces` | Which Tailwind namespaces you populate, and which name segment each claims. |
| `tailwind.held` | Namespaces deliberately **not** reset, each with its blocker stated. |
| `tailwind.rootFontSizePx` | px→rem divisor; `null` reads the export's own `units.policy.rootFontSizePx`. |
| `report.*` | Report title, where your policy write-up lives, and the narrative paragraphs. |
| `header.regenerateCommand` | Printed into every generated file, so a reader knows how to reproduce it. |

`viewport.*` and `aliases` are declared from 0.1.0 and consumed from 0.2.0.

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
```

Flags override `paths.*`. `--check` writes nothing and exits 1 on any
difference.

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

## Development

```sh
node --test 'test/**/*.test.mjs'
```

`test/parity.test.mjs` asserts all four outputs byte-identical against a real
committed design system's artifacts — the fixture under `fixtures/jhd-v7b/`.
That test is the reason a refactor here is safe.

## Licence

MIT.
