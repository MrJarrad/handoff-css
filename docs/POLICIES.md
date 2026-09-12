# Policies

Everything the export publishes is read from the export. The decisions below are
**not** published by the export, so they are stated here rather than left as
magic. Each names the config key that parameterises it, where there is one; the
open questions are repeated in the generated report.

The rule this package holds to: **never re-introduce a heuristic the export has
taken responsibility for.** Successive schema versions have moved three
generator guesses into published fields — the per-mode `build` cell (P4), the
`breakpoints.entries` array (P3), and the resolved `COMPOSE_COLOR` expression
(P9) — and each time the generator's job got smaller, not cleverer.

---

## P1 — Names

`codeSyntax.WEB.value`, verbatim. Never re-derived from the Figma path. A
variable without one is a hard failure: the export's own `naming.policy`
guarantees one for every variable, so its absence means the export is malformed.

`src/schema.mjs`

## P2 — Hand-authored wins (global scope only)

A custom property already declared **globally** in the consumer's own stylesheet
(`paths.handAuthored`) is not emitted. The rationale is cascade-mechanical, not
stylistic: a consumer that declares its scales inside `@theme inline` has
Tailwind emit them into `@layer theme`, and an unlayered `:root` from a generated
file would beat the theme layer — so emitting a colliding name would silently
invert authorship, and for colour would detach `.dark` from the token the utility
resolves. Standing down is the only ordering-independent way to keep
"hand-authored wins" true. Every skipped name is reported as MATCH or
VALUE-DRIFT.

**Scope.** "Globally" means a top-level `:root` / `html`, or a `@theme` block. A
declaration inside `.dark`, `@media`, `@supports` or `@utility` only applies when
its condition holds, so it cannot supersede the token everywhere; treating it as
a suppressor would leave the token undefined outside that condition. Those names
are reported in the report's §8 instead.

A **MATCH** row means the hand-authored declaration and the export agree — i.e.
a duplicate that could simply be deleted so the generated one wins. Consumers who
have done that tidy can pin MATCH at zero in their own test, and a new row then
tells them a duplicate crept back.

`src/hand-authored.mjs`

## P3 — Modes

The export publishes `breakpoints.entries`, one row per mode: `widthPx`,
`layoutVariant`, `isTheme`. So:

- single-mode collection → `:root`
- a mode the export flags `isTheme` — default → `:root`, otherwise `.<mode name>`
- `layout.collection`'s modes → `@media (min-width: <widthPx>)`, mobile-first in
  ascending width order. The second axis is a **selector, not a width**:
  `layoutVariant === "default"` lands on `:root`, any other variant on
  `[<layout.variantAttribute>="<variant>"]` inside the same media block.
- any other multi-mode collection → default mode on `:root`, every other mode on
  `[<modes.collectionModeAttribute>="<mode name>"]` (the export publishes no
  width or theme semantics for these).

If `breakpoints.entries` does not resolve a width for **every** mode of the
layout collection, the generator falls back to the data-attribute placeholder
rather than guessing breakpoints.

`layout.collection`, `layout.variantAttribute`, `modes.collectionModeAttribute`,
`themes.collection` · `src/modes.mjs`

## P4 — Units

Driven **entirely** by the per-mode `build` cell the export publishes
(`units.policy` v4). The generator applies no scope heuristics of its own.

- `build.status === "resolved"` → emit `build.css` verbatim. A `build.raw` that
  disagrees with the mode's own `raw` is a hard failure, never a silent pick of
  one side. Where `unitHint.sourceUnit` is px and `build.unit` is not, the source
  px value goes in a trailing comment. So `divide-by-100` → `--opacity-500: 0.5`,
  `identity` + px → `--blur-100: 12px`, `divide-by-root-font-size` →
  `3rem /* 48px */`.
- `build.status === "unresolved"` (in practice `divide-by-associated-font-size`,
  which needs a font size the export does not carry for a standalone variable) →
  emit the raw source value with an `UNCONVERTED:` comment and list it in the
  report's §6. **The divisor is never invented.**

Non-FLOAT types are rendered by type, since unit does not apply: TIMING →
seconds (`0.375s`); EASING → `cubic-bezier(…)`, LINEAR → `linear`; COLOR → per
`color.format`; STRING → quoted.

`color.format` · `src/resolve.mjs`

## P5 — Aliases

`var(--<next hop's WEB name>)` from `alias.chain[0]`, so the semantic →
primitive relationship survives into CSS. `terminalValue` goes in a trailing
comment. If the next hop is not in the export (a remote library variable), the
terminal value is emitted instead and the token is listed under UNRESOLVED
ALIASES in the report.

`src/resolve.mjs`

## P6 — Which mode seeds the base

`layout.baseMode: "smallest-default-variant"` — the unconditional base seeds
from the **smallest-width `default`-variant mode**, not the collection's
`defaultModeId`. Wider modes arrive only via their own ascending
`@media (min-width)` block.

The superseded alternative (`"collection-default"`) is kept as an option because
it is what a naive reading of the export gives you, and it is a real bug when the
default mode is not the narrowest: every token below the default mode's width
silently falls back to the default's value, inverting mobile-first. Viewports
narrower than the smallest published sample resolve to that sample's value —
there is no published design intent below it.

`layout.baseMode` · `src/modes.mjs`

## P7 — Private / hidden / excluded

Figma-only scaffolding must never become a public design-system token. But
hidden-in-Figma does **not** mean absent-from-CSS, and conflating the two ships
broken CSS.

In Figma, "don't publish" means "don't offer this in the picker" — a consumption
rule for designers, not a statement that the value is unused. Primitives stay
alive as the alias targets behind semantic tokens. CSS custom properties have no
such distinction: a name is either declared or it is not, and
`--background-default-primary: var(--palette-500)` with no `--palette-500`
declaration is **invalid at computed-value time** — the semantic token resolves
to nothing and the element renders unstyled. So the emit set is the alias
closure, not the published set:

```
emit = published ∪ { reachable by alias from an emitted variable }
```

Three classes, reported separately:

- **PRIVATE** — hidden, but reachable by alias from an emitted variable (walk
  `alias.chain[0]` transitively across every effective mode; light and dark
  routinely alias different primitives). **Emitted**, under the same name,
  because the aliases have to resolve — fenced in a marked block so the file
  states the intent the publish flag was carrying: these exist to be aliased, not
  used directly. Never a public row, never MISSING or EXTRA downstream.
- **HIDDEN** — hidden **and** unreachable. Nothing refers to it, so dropping it
  breaks nothing. Never emitted. This is the export's own signal and the durable
  fix: once Figma marks a variable hidden, it lands here with no config change.
- **EXCLUDED** — the variable's `"<collection>/<name>"` path starts with an entry
  in `exclude.paths`. A **policy** list, applied wholesale on path identity
  regardless of hidden state, and **never revived by reachability** — if product
  code must not consume it, an alias to it is a design-file bug worth surfacing,
  not papering over.

All three are excluded from the reconciliation rows, so MATCH / VALUE-DRIFT /
NAME-ONLY-IN-EXPORT never reflect them. Only PRIVATE is emitted.

`exclude.paths` · `src/exclude.mjs`

## P8 — Tailwind namespaces

A second output (`paths.theme`) holding **one** `@theme` block, so Tailwind's
generated utilities speak the design system's vocabulary
(`bg-background-default-primary`, `rounded-300`, `lg:` = the Figma device width)
and Tailwind's own default scale is gone. `paths.out` stays Figma-fidelity-only
and never gains a Tailwind bridge; the bridge is generated rather than
hand-authored, so it cannot drift from the tokens.

### P8.1 Suffix rule

The key is `--<namespace>-<leaf>`. The leaf is the token's WEB name minus its
leading `--`, minus its leading group segment **when** that group is the
namespace or a documented alias of it (`tailwind.namespaces[].group`):

```
--radius-300                  -> --radius-300        (not --radius-radius-300)
--radius-action-radius-elipse -> --radius-action-radius-elipse
--easing-power2-out           -> --ease-power2-out   (easing -> ease)
--letter-spacing-100          -> --tracking-100      (letter-spacing -> tracking)
--background-default-primary  -> --color-background-default-primary
```

Groups are never re-derived from Figma paths: the leaf is cut off the WEB name P1
already published, so P8 inherits P1's naming policy instead of running a second,
divergent one.

### P8.2 Value

Always `var(--<token WEB name>)`, never the resolved literal, and the block is
`@theme inline`. Both halves were established by measurement:

- `@theme inline` substitutes the value **text** into the utility and does not
  emit the key as a custom property, so the utility ends up
  `background-color: var(--background-default-primary)` and resolves the token
  **at the element**, picking up `.dark` and any scoped override on the way down.
- A plain `@theme` was tried first and is **wrong**. It emits
  `--color-background-default-primary: var(--background-default-primary)` into
  `:root`, which resolves there and then inherits the `:root` answer downward, so
  a subtree that re-declares the token no longer reaches the utility. A
  breakpoint probe caught this as a real shipped regression: a media control
  under a locally inverted scope went white → black at every width.

**Exception — same-name.** When the computed key equals the token's WEB name
(`--radius-300`, `--blur-100`), `var()` is a self-reference and must not be
emitted. Under `inline` Tailwind does not drop such a key; it re-declares it
inside the utility rule, producing
`.rounded-300 { --radius-300: var(--radius-300); border-radius: var(--radius-300) }`
— a cycle, so the custom property is invalid at computed-value time and the
utility silently computes to `0`. Measured in Chromium: the cyclic case yields
`border-radius: 0px` where the plain one yields 3px. No error, no warning.

Those keys therefore emit the token's resolved **default-mode literal**, with the
token named in a trailing comment. Safe because a same-name namespace is
single-mode (so the literal cannot go stale against a `.dark` or `@media`
override), and both halves come from the same export in the same pass. Colour is
never same-name (`--color-` prefix), so the namespace that actually needs
element-level resolution always gets it.

### P8.3 Resets

Each populated namespace opens with `--<namespace>-*: initial`, so Tailwind's
defaults stop compiling. `tailwind.held` names the namespaces deliberately left
un-reset, each with its blocker, and each is listed in the report's §9 so a hold
is a visible decision rather than an omission. Two kinds of hold are worth
distinguishing:

- **Nothing to reset.** Tailwind derives numeric spacing from a single
  `--spacing` multiplier (`p-4` = `calc(var(--spacing) * 4)`), not from per-key
  entries, so there is no namespace to populate and `--spacing-*: initial` would
  remove nothing. `z-<number>` is likewise a bare-value utility with no theme
  namespace behind it.
- **A real blocker.** A namespace whose hand-authored scale the export cannot
  regenerate (a type ramp with per-step letter-spacing modifiers, say) must not
  be reset, or the reset strips a scale nothing replaces.

### P8.4 Breakpoints

`--<namespace>-<family>` from `breakpoints.entries`, `default` layoutVariant only,
px converted to rem at the export's own `units.policy.rootFontSizePx`
(`tailwind.rootFontSizePx` overrides it; `null` means read the export and hard-fail
if absent, rather than assuming 16). Non-default variant rows are **layout
variants, not breakpoints** — they share their family's width and are selected by
the variant attribute (P3), so emitting them here would invent duplicate widths.
A Tailwind default breakpoint with no Figma device width behind it simply
disappears with the reset.

### P8.5 Hand-authored

**P2 does not apply to this file.** A namespace reset is only true if the whole
namespace is emitted in one place, so P8 always emits the full namespace, and the
report's §9 classifies every hand-authored `@theme` entry as
GENERATED-EQUIVALENT / VALUE-DRIFT / HAND-ONLY instead.

### P8.6 Motion is bridged under Tailwind's own namespace names

The duration/delay utilities are not bare-value-only: Tailwind v4 reads
`--transition-duration-*` and `--transition-delay-*`, and a namespace entry
**wins** over the bare-millisecond fallback. Measured against tailwindcss 4.3.3:
with `--transition-duration-300: 0.375s` present, `duration-300` emits
`transition-duration: 0.375s`; without it, the bare path emits `300ms`. So the
bridge maps the motion collection into both namespaces keyed by the **Figma**
suffix.

What the resets do and do not do, measured: Tailwind ships no
`--transition-duration-*` / `--transition-delay-*` theme entries at all
(`theme.css` has only `--default-transition-duration`), so those `: initial`
lines remove nothing — they are whole-namespace consistency and a fence against a
future Tailwind default. The bare-ms fallback also **survives** for suffixes
Figma does not publish (`delay-150` still compiles to `150ms`); only a lint can
close that. The win is that every suffix Figma **does** publish now resolves to
the Figma value instead of a coincidental millisecond.

The house token names remain the token layer; the `--transition-*` keys are the
bridge, and the two never collide, so P8.2's same-name literal rule does not
fire. A `motion-`-prefixed candidate (`duration-motion-300`) emits nothing — the
namespace suffix is the bare Figma leaf.

`tailwind.namespaces`, `tailwind.held`, `tailwind.rootFontSizePx` ·
`src/emit-theme.mjs`

## P9 — COMPOSE_COLOR

A COLOR variable's mode `raw` can be a `VARIABLE_EXPRESSION`
(`expressionFunction: COMPOSE_COLOR`): exactly two `VARIABLE_ALIAS` arguments,
arg 1 a colour, arg 2 an opacity FLOAT. This is Figma's replacement for a
hand-authored alpha ramp.

The export resolves the expression itself. Every COMPOSE_COLOR mode carries a
`build` cell exactly like a FLOAT's: `build.status: "resolved"`, `build.css`
(relative colour syntax, `rgb(from var(--<colour>) r g b / var(--<opacity>))`,
both arguments still live `var()` references so theme-mode overrides on either
half keep flowing through), `build.literal` (an 8-digit hex fallback),
`build.conversionStrategy: "compose-color"`.

Under P4's contract the generator emits `build.css` as-is and **does not** derive
a `color-mix()` of its own. The compose pass is retained only as a validating
pass-through: it still walks `expressionArguments` to resolve both operands' WEB
names (needed for P9.2 reachability and for the terminal-value comment further
down an alias chain, P5), and it still hard-fails on any expression shape it does
not recognise or on `build.status !== "resolved"`. An unresolved compose cell is
exactly the shape the old generator handled by computing its own mix; the export
now states plainly that this is its job, so an unresolved cell is a hard failure
rather than a silent fallback.

Noted for the record, not overridden: `rgb(from …)` reaches Baseline later
(Chrome 119 / Safari 16.4 / Firefox 128) than `color-mix()` (Chrome 111 / Safari
16.2 / Firefox 113). The export states the value and P4 says emit it verbatim.

A bare-number second argument (instead of a `VARIABLE_ALIAS`) is kept as a
defensive branch — one earlier export in this schema family carried the shape,
and nothing proves Figma cannot reintroduce it.

### P9.1 Theme modes, driven by the export's own flag

`breakpoints.entries` carries `isTheme: true` / `theme: "<name>"` /
`source: "theme-name"` for every theme mode alongside the layout rows
(`isTheme: false`). P3's mode-selector rule is driven by that flag directly
rather than a collection-name string check, so a third theme mode lands on its
own class through the same mechanism as the second, with no new code path. No
semantics beyond that are assumed for any theme.

### P9.2 Reachability

P7's alias closure must also walk a COMPOSE_COLOR mode's two
`expressionArguments` (read from `mode.raw`, published alongside `build`), not
just `mode.alias.chain[0]` — both arguments are emitted as `var()` and are
load-bearing exactly like an alias hop. Missing this wrongly drops a hidden
colour/opacity primitive as HIDDEN instead of keeping it PRIVATE, leaving the
composing token's `var()` dangling.

`src/resolve.mjs`, `src/exclude.mjs`

## P10 — Total themes

A mode named in `themes.total` **replaces its sibling themes entirely**. While
its class is on the document root, a nested sibling theme class (a per-media or
per-section ground mode) must not re-point tokens back to that sibling's values —
proximity should not beat the root theme.

**Mechanism.** The total mode's generated block is selected by
`.total, .total .sibling, .total.sibling` instead of plain `.total`:

- `.total .sibling` (0,2,0) outguns both the generated and any hand-authored
  `.sibling` block (0,1,0) regardless of source order, for descendants.
- `.total.sibling` (0,2,0) covers the case where **both** classes land on the
  same element, where plain `.total` (0,1,0) would only tie the `.sibling` block
  and lose on source order.
- Plain `.total` needs no help against `:root` (0,1,0 vs 0,1,0): `:root` sorts
  first, so the total mode wins ties by position alone.

**What this cannot do.** Specificity decides which of two competing declarations
wins; it cannot make a rule win a token that neither `.total` nor
`.total .sibling` declares at all — that token keeps resolving through whatever
`.sibling` rule does declare it. Every theme-bearing token must therefore be
either generated (so P10 covers it automatically) or explicitly hand-mirrored
under the same selector list. **A token declared only in a hand-authored sibling
block is a leak by construction**, whatever this selector's specificity is.

**Checked and rejected: deriving exclusivity from the export.**
`breakpoints.entries` publishes `isTheme` / `theme` / `source` / `confidence` and
no exclusivity or ordering field, so there is nothing generic to hang a rule on.
Hence a named config list rather than an invented heuristic.

**Also rejected: emitting each sibling as `.sibling:not(.total, .total *)`.** That
would require revisiting every consumer of the sibling's specificity assumptions
(the hand-authored and generated blocks share one selector) for a mode that has
no reason to know the total mode exists. Putting the exclusion on the total
mode's own selector keeps the concept contained to the mode that claims it.

A consumer's `dark:`-style custom variant needs the same treatment on its own
side (`@custom-variant dark (&:is(.dark:not(.bttf, .bttf *) *))` in the JHD
case), so those utilities go inert under the total theme exactly as the token
block does. That edit is in the consumer's stylesheet, not here.

`themes.total` · `src/modes.mjs`

---

## P11 — Responsive classes

A dimensional variable is published with a **responsive class**, and the class —
not the number of modes — decides how many declarations it gets.

| Class | Emitted as |
| --- | --- |
| `viewport-width` / `viewport-height` | ONE declaration on the base scope, the fraction in `viewport.widthUnit` / `viewport.heightUnit` (`vw` / `dvh`). The per-mode px samples are dropped and listed in the report. |
| `fluid-clamp` | The export's own `clamp()` expression, once per layout variant. Never recomputed here — the export publishes `preferred.slopeRemPerPx`, `interceptRem` and the finished `css`. |
| `fixed` | One declaration per layout variant, instead of one per width — or, when EVERY published rule states `fixed` and the variable is in a declared `viewport.groups` prefix, one declaration on the base scope for the whole variable. |
| `mode-stepped` | Per-mode, in ascending `@media (min-width)` blocks — the default path (P3, P6). |
| `sample-only` | Per-mode, from the one published sample. |

For `fixed`, the emitted declaration is the resolved token reference (the alias
chain), not the literal `css` string the export publishes — the alias binding is
preferred over the literal because it survives upstream token renames.

**Where the class comes from**, in precedence order:

1. A `responsive` block on the variable —
   `{ kind: "viewport", viewport: { axis: "height" \| "width", fraction } }`, or
   `{ kind: "<class name>" }`. The preferred signal; a block this package only
   half-understands stops the run rather than falling through to the default
   path.
2. The **description convention**: a description matching exactly
   `N% of screen height` or `N% of screen width`. A supported first-class
   input, not a stopgap — Figma variables carry no viewport semantics, so a
   description is the only place a designer can currently state the fraction.
   Anchored: "roughly 20% of screen height on mobile" is not a signal. Switched
   with `viewport.descriptionFallback`.
3. The export's own `responsiveBehavior.rules[].strategy`, which is published
   **per `layoutVariant`** — `col-span-1` is `mode-stepped` at the default
   variant and `fluid-clamp` at `flush`, and each is honoured on its own. One
   reading is variable-wide rather than per-variant: **every** published rule
   stating `fixed`, on a variable inside a declared `viewport.groups` prefix,
   is the export saying this is one value at every breakpoint — see the third
   silencing source below.
4. Nothing: the per-mode default path.

The description beats `responsiveBehavior` deliberately. Every
`device/screen-height/*` variable is `mode-stepped` there — it genuinely IS four
per-breakpoint samples — while its description states the fraction those samples
are samples OF. Only the fraction can be emitted as one declaration that holds
at every viewport, so the more specific statement wins.

**What is honoured is config.** `responsive.honourClasses` lists the classes
allowed to change the output. `mode-stepped` and `sample-only` ARE the default
path, so listing them changes nothing; an empty list pins pre-0.2.0 output
exactly. This is how a consumer adopts one class at a time instead of taking
every behavioural change in one release. The house preset (`presets/jhd.config.mjs`)
honours all four classes that can change output as of 0.4.2 — operator ruling
2026-09-12 ("Responsive strategy"): *"let's follow what the plugin suggests."*
`fluid-clamp` and `fixed` are no longer held; every rule the plugin writes is
honoured exactly as published, per `layoutVariant`, and the export's own `css`
is used verbatim — never recomputed.

**`viewport.groups` is a whitelist, not a warning filter.** It names the
variable-name prefixes the consumer declares viewport-relative, and that
declaration decides which variables may become viewport units **at all** —
every source above is gated by it, so closing the gate on one path and leaving
another open is not possible. A stated fraction outside every declared prefix
is a HINT, treated exactly as a bare class is: the per-mode samples are emitted
unchanged and the variable is reported as `VIEWPORT_OUTSIDE_GROUPS`.

This is not defensive tidying. The 2026-09-10 schema-8 export states a
`viewportFraction` on ~20 rules that are not fractions of the screen in any
design sense — `text/title/letter-spacing-400`, `text/title/font-size-100`,
`icon/radius/100`, `grid/col-start/col-start-2`. Honouring them emits type
whose size and tracking scale with the viewport, which no design decision ever
asked for; the export is wrong about those variables, and the consumer's group
declaration is the only statement in the system that knows it. An empty
`groups` list opts out of the gate entirely — every stated fraction is
honoured, and nothing is reported either way — which is the right default for a
consumer with no group convention.

**Nothing is guessed.** A `viewport.groups` member with none of the **three**
signals keeps its px samples and is reported as `VIEWPORT_UNFLAGGED` — the fix
is one edit in Figma, not a heuristic here. The three that silence it, all of
them statements rather than absences:

1. a `responsive` field stating the fraction;
2. a `N% of screen height|width` description stating the fraction;
3. **`fixed` on every `responsiveBehavior` rule** (0.3.1) — the export
   answering the question the warning asks. `VIEWPORT_UNFLAGGED` means "the
   consumer declared this group a fraction of the screen; which fraction is
   this one?", and an all-`fixed` rule set answers *none — it is one value at
   every breakpoint*. Honoured generically, per the memo
   `2026-09-10-handoff-viewport-tokens-brief` addendum 1 ("`fixed` -> one
   value"), and proved before it is collapsed: the modes' own resolved values
   must agree, or the samples stand and `FIXED_VARIES_BY_MODE` says so. Gated
   on the same `viewport.groups` whitelist as the warning it replaces, so the
   per-variant `fixed` path outside every declared group is untouched.

Likewise a `fluid-clamp` with no `css` expression
(`CLAMP_WITHOUT_EXPRESSION`) and a `fixed` whose modes do not actually agree
(`FIXED_VARIES_BY_MODE`) fall back to the samples and say so.

And nothing is second-guessed. A description of "20% of screen width" on a
full-bleed variable emits `20vw`. That is a wrong token from a wrong
description, correctable in Figma in one edit and named in the report's §10; a
plausibility check here would make the export stop being the contract.

`responsive.honourClasses`, `viewport.*` · `src/responsive.mjs`

---

## P13 — Cell trust

Every FLOAT mode carries a `build` cell, and P4 emits its `css` verbatim — but
only while the cell agrees with itself. A cell is **untrusted** when
`conversionStrategy: "identity"` (the build value IS the source value) comes
with a `rawValue` and a `convertedValue` that differ, or when `css` carries a
unit other than the `buildUnit` the same cell published. Float32
representation noise is not a contradiction: both comparisons round through the
same `num()` the emitter uses, so `162.39999389648438` stored against
`162.399994` converted is one number written twice.

An untrusted cell never emits its `css`. Resolution falls, in order, to an
explicit `responsive.viewport.fraction`, then the description convention (P11),
then the raw source value in the cell's own `sourceUnit` — with a
`BUILD_CELL_CONTRADICTORY` / `BUILD_CELL_UNIT_MISMATCH` warning naming the
variable, the mode and the raw/converted pair. A cell with no `rawValue` to
fall back on is a **hard failure**: the export states no value for that mode,
and inventing one is the bug this policy exists to prevent. The 2026-09-10
schema-8 export publishes 100 such cells — `device/container-max-width` is
`rawValue: 2156`, `sourceUnit: "px"`, `convertedValue: 100`, `css: "100vw"`, so
trusting it makes a fixed 2156px cap full-bleed site-wide.

For the same reason a responsive **class** is not a value. `viewport-width` /
`viewport-height` say "a fraction of the screen" and the class name says nothing
about which fraction, so a class arriving from `responsiveBehavior[].strategy`
or a bare `responsive.strategy` is a **hint**: it is reported
(`VIEWPORT_CLASS_WITHOUT_FRACTION`) and changes nothing on its own. A fraction
is stated by, in order, an explicit `responsive.viewport.fraction`, the
description convention, or the export's own `responsiveBehavior[].viewportFraction`
(source `rule`; a `viewportFraction` of exactly 0 is treated as no signal, not
"0% of the screen"). A rule fraction that disagrees with the description by
more than 0.005 loses to the description, with a `VIEWPORT_FRACTION_DISAGREES`
warning naming both values — the rule fraction is unproven where the
description is the deliberate, human-stated convention.

The report's §10 lists every untrusted cell with its raw/converted pair. The
count is a property of the export, not of your config: when the plugin stops
publishing contradictory cells it goes to zero.

`src/resolve.mjs` (`cellTrust`, `untrustedCells`)

---

## P12 — Alias block

`aliases` maps a name pattern to a target pattern, each ending in exactly one
`*`:

```js
aliases: {
  "--screen-height-*": "--device-screen-height-*",
  "--height-screen-*": "--screen-height-*",
}
```

The `*` binds to the leaf of every **emitted** name matching the target, so the
alias set is derived from what was generated rather than maintained by hand.
Patterns expand in declaration order and may target an earlier pattern's
output, which is how a two-hop convention stays two one-line rules. The result
is one `:root` block after the collections.

An alias is a `var()` hop, never a second copy of the value — the token above
stays the single place the value is stated. A collision with a generated name,
with a hand-authored global declaration (P2), or with another pattern's output
is a **hard failure**: whichever declaration lost would be silently dead, and
one of the two is a real design-system token. A pattern that matches nothing is
also a hard failure — a config statement about names that no longer exist is
exactly the drift a generated alias block exists to catch.

`aliases` · `src/aliases.mjs`

---

## P14 — Export validation

A document that names `schemaVersion: 8` or `9` is checked against
`schema/design-system-handoff.schema.json` before a line of CSS exists, and
against nothing else — the top level is open, because a plugin that adds a field
must not break every consumer, while the two structures the generator reads by
name are closed: `codeSyntax.WEB` (`value`, `source`) and
`responsiveBehavior.rules[]`. A typo'd key in either is an error rather than a
silently-defaulted value.

Schema 9 (2026-09-11) is the **same JSON shape** as schema 8 — compared field
by field (top-level keys, `units.policy` shape, `responsiveBehavior` rule
keys) across a real export at each version before deciding this. What changed
is semantic, stated in the export's own `changes.schema[9]`: viewport classes
are now gated by designer signal (a reference-variable group or a
screen-percentage description) rather than by group membership alone, and
`viewportFraction` values are snapped to the nearest whole percent. One schema
file with `schemaVersion: { "enum": [8, 9] }` is the honest fit; a second `v9`
schema file would duplicate a structure that did not change.

Three shape rules carry meaning:

- `codeSyntax.WEB.value` matches `^--[a-z0-9-]+$`. It is the name a build binds,
  so its form is part of the contract.
- A `viewport-width` / `viewport-height` rule must carry a numeric
  `viewportFraction`. Schema 8+ states it; a rule without it is a hint, and a
  hint arriving as a rule is an export defect.
- A `fluid-clamp` rule must carry `css`. The generator emits the export's own
  `clamp()` and never composes one.

A schema-7 export SKIPS validation — it predates both rules — and the result
says `skipped: true` rather than `ok` with no checks run. Dropped in 0.4.0. A
schema version NEWER than every version this module validates (e.g. a future
10) is not skipped: it runs through the schema and fails at `/schemaVersion` —
"unrecognized" must never read as "passed."

The markdown half has no JSON Schema, so its contract is a line grammar:
`schema/design-handoff.v6.grammar.md`, implemented by `src/validate-handoff-md.mjs`.
Its two cross-file checks are `COMPANION_STATE_MISMATCH` (error — the two halves
describe different design-system states, which is the stale-pair defect) and
`POLICY_VERSION_MISMATCH` (warning — a policy version stated twice, disagreeing;
the real 2026-09-10 nav brief carries exactly one, `units` v4 vs v5). The plugin's
2026-09-11 export moved table/footnote/layout notes to a single-meaning `†` sigil,
freeing `⚠` to mean only "raw value that should be bound"; the grammar accepts both
the current `†` and the pre-2026-09-11 `⚠` note form (0.3.2).

`validateExport`, `assertValidExport` · `src/validate-export.mjs`,
`src/validate-handoff-md.mjs`

---

## P15 — Derived viewport fractions round to the input

Operator ruling, 2026-09-11 (memo `2026-09-10-handoff-viewport-tokens-brief`,
Addendum 2): **the export never states a value that was not input into Figma.**
Every ordinary token already meets it — `244` exports as `244` / `15.25rem`. The
single exception is a fraction the plugin DERIVES (value ÷ a screen reference),
where float division turns `244/812` into `0.300493`.

So any fraction this generator takes from the export — an explicit
`responsive.viewport.fraction` field, or a rule's own `viewportFraction` — is
rounded back to the nearest whole percent when one is within
`VIEWPORT_FRACTION_TOLERANCE` (0.005, RELATIVE to the percent). `0.300493` →
`30dvh`; `0.699507` → `70dvh`; `0.900246` → `90dvh`.

The tolerance is relative rather than absolute on the fraction because every
fraction is within 0.005 of SOME whole percent — 0.005 is half the gap between
two of them — so an absolute reading could never fail, and the ruling's "if no
whole percent is within 0.005, keep three decimals and flag the variable" would
be unreachable. Under the relative reading the ruling's own numbers land exactly
where it says they do, and `0.3125` (0.8% away from 31%) does not round.

When nothing is within tolerance, three decimals are emitted and
`VIEWPORT_FRACTION_UNROUNDED` names the variable in the report and the CLI
summary. The DESCRIPTION path is untouched: a description states a percent, it
does not derive one, so `20% of screen height` is emitted verbatim.

`VIEWPORT_FRACTION_TOLERANCE`, `percentFromFraction` · `src/responsive.mjs`

---

## P16 — Consumer conformance

The generator proves the TOKENS are right. `handoff-css conform` proves the CSS
that consumes them binds the names the handoff states, by the mechanisms it
names — the other direction of the same contract.

| Code | Severity | Rule |
| --- | --- | --- |
| `UNKNOWN_NAME` | red | a `var(--x)` that is in neither the export's `codeSyntax.WEB` names nor the generated tokens, after alias hops resolve |
| `LOCAL_ONLY` | amber | the same, but the consumer's own stylesheet declares it — a local value, not drift |
| `UNMAPPED_BINDING` | amber | the handoff states a binding the generated tokens never declare; the fix is upstream |
| `SAMPLE_PX_LITERAL` | red / amber | red for a device/viewport dimension (`812px` is `100dvh` measured on one phone), amber for any other token px sample |
| `GRID_ARITHMETIC` | red | `calc(… / M)` or a `*col-unit*` name where the brief states `col-span N/M` — Build standard 5 names a grid container |
| `PLACEHOLDER_COPY` | amber | a string the brief flags `⚠ placeholder`, shipped as content |

Two deliberate exemptions. A breakpoint inside an `@media` prelude is the one px
a stylesheet cannot state as a custom property. And the DEVICE set is built from
breakpoint families only — the export writes a sample's `widthPx` as the mode's
own numeric name on non-viewport mode sets, so a checker that trusted every
`widthPx` would call `padding: 200px` a device sample.

**The allowlist (0.3.1).** Some names legitimately come from outside the
export: this package asks consumers to supply their own font face, so
`--font-suisse` is a `var()` no export will ever declare, and a permanent red
a consumer has learned to ignore is worse than no check. `--allow-name <name>`
(repeatable) and the config's `conform.allowNames` are the same statement, and
both are additive — an allowed name never raises `UNKNOWN_NAME`.

It answers exactly one question — "this name comes from outside the export" —
and is not a mute button. A name the consumer's own stylesheet declares is
still `LOCAL_ONLY`, because that is a different claim about a different
mistake, and an allowlist entry that silenced it would hide the drift it exists
to find.

Scope: CSS only in 0.3.0. A binding that lives in markup is invisible here, and
that is a named gap rather than a silent one. Exit 1 on any red.

`conform`, `conform.allowNames` · `src/conform.mjs`, `src/conform-cli.mjs`

---

## P17 — Front matter and the `Notes` column (0.3.3)

The plugin's export v4 prepends a `---`-fenced YAML front-matter block to the layer brief and
turns its responsive tables' ragged trailing note cell into a proper fifth `Notes` header
column. Both are additive to the v6 grammar, not a version bump.

**Front matter.** Read by a MINIMAL hand-rolled parser (`src/front-matter.mjs`) — flat keys,
one level of nested mapping, quoted strings, ints; deliberately no YAML dependency, because the
shape needed is narrow. Exposed as `parsed.frontMatter` (`null` when absent). Identity fields it
duplicates from the bold lines (`schemaVersion`, `contract`/lane, the fingerprint state, the
companion block) are cross-checked: a disagreement is `FRONT_MATTER_MISMATCH` (error), naming
the field and both values. A field present in only one source is not a mismatch — the front
matter is additive, not a second required source.

**The `Notes` column.** A table whose last header cell is literally `Notes` routes that column
through its own cell check (empty / `† <note>` / `† row-wrap: <free text>`, `⚠` also accepted)
instead of the closed value-column vocabulary — `row.note` is populated the same way the legacy
ragged trailing cell was, and `row.cells` no longer includes it. Tables without a `Notes` header
keep taking the legacy ragged form.

`design-handoff.v6.grammar.md` §"Front matter"/§"The `Notes` column" · `src/front-matter.mjs`,
`src/validate-handoff-md.mjs` · fixture `fixtures/jhd-v9c-2026-09-11/`

---

## P18 — Header `Source:` names the document, not the download (0.3.4)

The generated header's `Source:` line (tokens/theme headers, the report's `Export` row) prints
`doc.documentName`, falling back to `doc.artifact` and then a fixed string when neither is
present — never `doc.artifactFilename`. A downloaded export gets a suffix so repeated
downloads never overwrite each other (`…-handoff-v6.json`, `…-handoff (1).json`); that suffix
lives in the filename the browser wrote, not in the export's own payload, so it must never
reach generated output. Two exports of the same design-system state that differ only in
`artifactFilename` produce byte-identical `tokensCss`, `themeCss`, `report`, and
`exclusionsJson`.

`src/emit-tokens.mjs`, `src/emit-theme.mjs`, `src/report.mjs` · `test/header-filename-independence.test.mjs`

---

## P19 — Motion (0.4.0)

`config.motion` · `src/resolve.mjs` (`timing`, `easing`), `src/motion.mjs` · `test/motion-v10.test.mjs`

Figma types motion, so the generator does not have to guess at it.

**EASING.** The export publishes the curve itself. A `LINEAR` curve emits the CSS
keyword `linear`; anything else emits `cubic-bezier(x1, y1, x2, y2)` from
`easingFunctionCubicBezier`, rounded once by `num()`. There is no config key: the
export states the value and CSS has exactly one syntax for it.

Naming is P1's job, not this policy's. Operator ruling 2026-09-12 row 1 retires the
role-flavoured names (`quad-out-gill`, `power2-out`, `expo-out-card`) in favour of curve
families — `quad-out`, `cubic-out`, `quart-out`, `expo-out`, `ease-out`, `circ-in-out`,
`linear` — a rename **in Figma**, which arrived through `codeSyntax.WEB` with export v11
and changed no code here. A role name, if one is ever wanted, is a semantic alias layer
(P12), never a second declaration of a curve.

**TIMING.** Figma stores a TIMING variable in SECONDS. `motion.timingUnit` states
which unit the house publishes:

| `timingUnit` | `duration/375` (0.375 stored) |
| --- | --- |
| `"ms"` | `--duration-375: 375ms` |
| `"s"` | `--duration-375: 0.375s` |

Milliseconds are the house choice because operator ruling 2026-09-12 row 2 names each
step for its milliseconds. A token named `--duration-375` whose value read `0.375s`
would be lying about itself in the one place a reader looks.

Float32 noise is rounded off **in seconds, before the scale**. `0.10000000149011612 ×
1000` is `100.00000149011612`, and `num()`'s six decimal places would faithfully
preserve that as `100.000001ms`.

**Delays alias durations — in Figma, and the generator only says so.** Ruling row 4
makes every `motion/delay` step an alias of the `motion/duration` step of the same
value, *"so values can never drift"*. When Figma authors that, the export carries an
ordinary alias hop and P5 emits `--delay-375: var(--duration-375)`, with the
terminal-value comment rendered in the same unit.

**Nothing in the generator pairs a delay with a duration.** Rewriting a literal delay
into `var(--duration-…)` on a value match would look identical today and would silently
overwrite the first delay step that legitimately differs — the class of guess this
package exists to remove. Instead `motion.delayAliasOf` names the two groups and the
generator REPORTS the gap: a delay step holding a duration step's value as its own
literal raises `DELAY_NOT_ALIASED`, naming the variable to re-point at in Figma. A delay
with no matching duration step (`delay/50`, which has no `duration/50`) is not a
finding — the ruling only pairs steps that exist. Stagger is `index × step` in the
consumer's code, not a token.

---

## P20 — Aspect ratios (0.4.0)

`config.aspect` · `src/aspect.mjs` · `test/aspect-v10.test.mjs`

Figma has no aspect-ratio **type**, but it has STRING variables, and as of export v11
the design system authors the four ratios properly:
`core/aspect/{landscape, portrait, square, tall}` hold `"3:2"`, `"4:5"`, `"1:1"`,
`"2:3"`.

So **nothing is derived**. These are ordinary published variables carrying their own
`--aspect-<name>` WEB names under P1, placed by P3 like any other. This policy owns one
rendering rule: a STRING variable under an `aspect.ratioPaths` prefix emits the CSS
ratio `a / b`, because `aspect-ratio: "3:2"` is not a value CSS accepts. Both spellings
(`3:2`, `3/2`) and decimals (`1.85:1`) are read; every STRING *outside* those paths is
quoted exactly as before.

A declared ratio variable holding something that is not a ratio is a **hard failure**,
not a quoted passthrough. The consumer has declared the path to hold a ratio, so a value
that is not one is the design file and the config disagreeing, and emitting
`aspect-ratio: "banana"` would push that discovery into a browser.

**The height groups are a cross-check now, not a source.** Ruling 2026-09-12 row 6:
*"figma has no concept of aspect ratios, I tend to just use the col-span as the
height"*. Those per-column-span heights under `layout/grid/aspect/` are the workaround
and stay EXCLUDED (P7) — ruling 2026-09-06, *"they are just figma hacks"*. They still
describe the ratio they were computed from, so `aspect.descriptionGroup` +
`descriptionPattern` compare each leaf group's descriptions against the authored
variable of the same name and raise `ASPECT_DESCRIPTION_DISAGREES` when they
contradict. **That finding changes no value.** The authored variable is the value,
always; a stale description means a designer is reading the wrong number off the wrong
place, and the fix is one edit in Figma.

*(Superseded before release: 0.4.0's first cut DERIVED the ratios from those
descriptions, because no variable held them. `ASPECT_RATIO_MIXED` and
`ASPECT_RATIO_MISSING` were emission gates then — a contradicting group could publish
nothing at all. Export v11 authored the variables, so the derivation went and the check
stayed. Consistent with this file's standing rule: never keep a heuristic once the
export takes responsibility for the answer.)*

Adopting this means DELETING the consumer's own hand-authored `--aspect-*` block, just
as adopting P12 meant deleting its `--screen-height-*` one — ruling row 5 is explicit
that there are to be *"no hand-authored copies"*. Until that lands, P2 suppresses the
generated token and the report says MATCH.

**Not bridged to Tailwind.** Tailwind v4 owns an `--aspect-*` namespace, but resetting
it would take `aspect-video` / `aspect-square` with it, and these names compose as
arbitrary values — `aspect-(--aspect-landscape)` — with no reset needed.

---

## Determinism

Collections sorted by name, variables by WEB name, numbers rounded to 6 decimal
places (Figma stores float32, so raws arrive as `0.10000000149011612`). Same
inputs → byte-identical output. `--check` writes nothing and exits 1 if any
committed artifact would change, which is what a consumer's CI runs.
