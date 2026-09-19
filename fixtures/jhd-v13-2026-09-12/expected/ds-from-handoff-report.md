# ds-from-handoff — reconciliation report

GENERATED FILE — regenerate with `pnpm run tokens`.

| | |
| --- | --- |
| Export | `JHD-Spec-DesignSystem` |
| Schema | design-system-handoff v13 |
| Exported at | 2026-09-12T13:43:20.353Z |
| designSystemStateHash | `eab3d422694a61d30e30e6961dd690023df3d5db3965ced39a562dcdb98498cc` |
| Tokens in export | 504 |
| MATCH (hand-authored, same value) | 0 |
| VALUE-DRIFT (hand-authored, different value) | 14 |
| NAME-ONLY-IN-EXPORT (newly generated) | 490 |
| NAME-ONLY-IN-HAND (in styles.css, not in export) | see §4 |
| PRIVATE (hidden, but an alias target of a published token — emitted) | 26 |
| HIDDEN (hidden and unreachable — not emitted) | 18 |
| EXCLUDED (`EXCLUDE_PATHS` policy list — not emitted) | 43 |

Statuses compare the export's **default mode** against the value declared in
`src/styles.css`. Anything with a hand-authored declaration is reported here but
**not** emitted into `src/tokens.generated.css` — hand-authored wins (policy P2).
PRIVATE, HIDDEN and EXCLUDED variables (policy P7, §0) are never counted in
MATCH/VALUE-DRIFT/NAME-ONLY-IN-EXPORT — they are not public design-system
tokens. Of the three, **only PRIVATE is emitted**, because published tokens
alias it and a referenced-but-undeclared custom property is invalid at
computed-value time.

## 0. PRIVATE (26), HIDDEN (18) and EXCLUDED (43)

Not public tokens, and excluded from every other class in this report (policy P7
in `docs/handoff-css.md`). Operator ruling 2026-09-06: *"i don't publish
the color primitives because only semantic colors should be used in layout but
the primitive color are alias's in semantic colors"*.

**PRIVATE** — hidden in Figma, but reachable by alias from a published token, so
they **are** emitted (same names, fenced in a marked block). Not publishing a
primitive in Figma means *"don't pick this in a layout"*; it does not mean the
value is unused. CSS has no such distinction — dropping these would leave the
semantic tokens that reference them invalid at computed-value time. Reference the
semantic token in the "Aliased by" column, never the private name.

| Name | Collection | Value | Aliased by |
| --- | --- | --- | --- |
| `--color-palette-cruise-100` | color-primitives | `#d7f0e8` | `--background-positive-lighter`, `--border-positive-lighter`, `--content-positive-lighter` |
| `--color-palette-cruise-200` | color-primitives | `#b2e1d2` | `--background-positive-light`, `--border-positive-light`, `--content-positive-light` |
| `--color-palette-cruise-500` | color-primitives | `#3f9c86` | `--background-positive-dark`, `--background-positive-lighter`, `--border-positive-dark`, `--border-positive-lighter`, `--content-positive-dark`, `--content-positive-lighter` |
| `--color-palette-cruise-600` | color-primitives | `#358876` | `--background-positive-darker`, `--background-positive-light`, `--border-positive-darker`, `--border-positive-light`, `--content-positive-darker`, `--content-positive-light` |
| `--color-palette-cruise-700` | color-primitives | `#327768` | `--background-positive-dark`, `--border-positive-dark`, `--content-positive-dark` |
| `--color-palette-cruise-800` | color-primitives | `#2b5e54` | `--background-positive-darker`, `--border-positive-darker`, `--content-positive-darker` |
| `--color-palette-lightning-yellow-100` | color-primitives | `#fef4c7` | `--background-warning-lighter`, `--border-warning-lighter`, `--content-warning-lighter` |
| `--color-palette-lightning-yellow-200` | color-primitives | `#fde98a` | `--background-warning-light`, `--border-warning-light`, `--content-warning-light` |
| `--color-palette-lightning-yellow-400` | color-primitives | `#fbc117` | — |
| `--color-palette-lightning-yellow-500` | color-primitives | `#f5a40b` | `--background-warning-dark`, `--border-warning-dark`, `--border-warning-lighter`, `--content-warning-dark`, `--content-warning-lighter` |
| `--color-palette-lightning-yellow-600` | color-primitives | `#d97c06` | `--background-warning-darker`, `--background-warning-light`, `--border-warning-darker`, `--border-warning-light`, `--content-warning-darker`, `--content-warning-light` |
| `--color-palette-lightning-yellow-700` | color-primitives | `#bb610c` | `--background-warning-dark`, `--border-warning-dark`, `--content-warning-dark` |
| `--color-palette-lightning-yellow-800` | color-primitives | `#934910` | `--background-warning-darker`, `--border-warning-darker`, `--content-warning-darker` |
| `--color-palette-malibu-100` | color-primitives | `#e3f0fb` | `--background-focused-lighter`, `--content-focused-lighter` |
| `--color-palette-malibu-200` | color-primitives | `#cae4f7` | `--background-focused-light`, `--border-focused-lighter`, `--content-focused-light` |
| `--color-palette-malibu-300` | color-primitives | `#9dd1f6` | `--border-focused-light`, `--border-focused-lighter` |
| `--color-palette-malibu-500` | color-primitives | `#3a96cf` | `--background-focused-dark`, `--background-focused-lighter`, `--border-focused-dark`, `--border-focused-light`, `--content-focused-dark`, `--content-focused-lighter` |
| `--color-palette-malibu-600` | color-primitives | `#2279af` | `--background-focused-darker`, `--background-focused-light`, `--border-focused-dark`, `--border-focused-darker`, `--content-action-primary`, `--content-default-primary`, `--content-focused-darker`, `--content-focused-light` |
| `--color-palette-malibu-700` | color-primitives | `#1c6ca0` | `--background-focused-dark`, `--border-focused-darker`, `--content-focused-dark` |
| `--color-palette-malibu-800` | color-primitives | `#175782` | `--background-action-brand`, `--background-default-brand`, `--background-focused-darker`, `--border-action-brand`, `--border-default-brand`, `--content-action-brand`, `--content-focused-darker` |
| `--color-palette-punch-100` | color-primitives | `#ffe4e1` | `--background-negative-lighter`, `--border-negative-lighter`, `--content-negative-lighter` |
| `--color-palette-punch-200` | color-primitives | `#ffcfc9` | `--background-negative-light`, `--border-negative-light`, `--content-negative-light` |
| `--color-palette-punch-500` | color-primitives | `#f4513f` | `--background-negative-dark`, `--background-negative-lighter`, `--border-negative-dark`, `--border-negative-lighter`, `--content-negative-dark`, `--content-negative-lighter` |
| `--color-palette-punch-600` | color-primitives | `#e23b28` | `--background-negative-darker`, `--background-negative-light`, `--border-negative-darker`, `--border-negative-light`, `--content-negative-dark`, `--content-negative-darker`, `--content-negative-light` |
| `--color-palette-punch-700` | color-primitives | `#bd2918` | `--background-negative-dark`, `--border-negative-dark` |
| `--color-palette-punch-800` | color-primitives | `#9c2518` | `--background-negative-darker`, `--border-negative-darker`, `--content-negative-darker` |

**HIDDEN** — marked `hiddenFromPublishing` / `effectivelyHiddenFromPublishing`
in the export **and** unreachable by alias from anything emitted. Nothing refers
to them, so they are safely dropped. This is the durable signal: once Figma marks
a variable hidden and nothing aliases it, it lands here with no generator change.

| Name | Collection |
| --- | --- |
| `--color-palette-cruise-300` | color-primitives |
| `--color-palette-cruise-400` | color-primitives |
| `--color-palette-cruise-50` | color-primitives |
| `--color-palette-cruise-900` | color-primitives |
| `--color-palette-cruise-950` | color-primitives |
| `--color-palette-lightning-yellow-300` | color-primitives |
| `--color-palette-lightning-yellow-50` | color-primitives |
| `--color-palette-lightning-yellow-900` | color-primitives |
| `--color-palette-lightning-yellow-950` | color-primitives |
| `--color-palette-malibu-400` | color-primitives |
| `--color-palette-malibu-50` | color-primitives |
| `--color-palette-malibu-900` | color-primitives |
| `--color-palette-malibu-950` | color-primitives |
| `--color-palette-punch-300` | color-primitives |
| `--color-palette-punch-400` | color-primitives |
| `--color-palette-punch-50` | color-primitives |
| `--color-palette-punch-900` | color-primitives |
| `--color-palette-punch-950` | color-primitives |

**EXCLUDED** — matched an `EXCLUDE_PATHS` prefix. A policy list applied wholesale
on path identity, regardless of hidden state, and never revived by reachability.
`.utility/` is durable (*".utility ignore all together"*);
`layout/grid/aspect/` is interim — remove it once Figma marks those hidden.

| Name | Collection | Reason |
| --- | --- | --- |
| `--grid-aspect-landscape-col-span-1` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-10` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-11` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-12` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-2` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-3` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-4` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-5` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-6` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-7` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-8` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-col-span-9` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-landscape-full-width` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-1` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-10` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-11` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-12` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-2` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-3` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-4` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-5` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-6` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-7` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-8` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-col-span-9` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-portrait-full-width` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-1` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-10` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-11` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-12` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-2` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-3` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-4` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-5` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-6` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-7` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-8` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-col-span-9` | layout | EXCLUDE_PATHS (layout) |
| `--grid-aspect-tall-full-width` | layout | EXCLUDE_PATHS (layout) |
| `--utility-space-lg` | .utility | EXCLUDE_PATHS (.utility) |
| `--utility-space-md` | .utility | EXCLUDE_PATHS (.utility) |
| `--utility-space-sm` | .utility | EXCLUDE_PATHS (.utility) |
| `--utility-space-xs` | .utility | EXCLUDE_PATHS (.utility) |

## 1. core/dimension parity

| Token | Export | styles.css | Status |
| --- | --- | --- | --- |
| `--dimension-0` | `0rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-100` | `0.0625rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1000` | `2rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1050` | `2.25rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1100` | `2.5rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1150` | `2.75rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1200` | `3rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1300` | `3.5rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1400` | `4rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1500` | `4.5rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1600` | `5rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1700` | `6rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1800` | `8rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-1900` | `10rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-200` | `0.125rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-2000` | `12rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-2100` | `16rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-2200` | `20rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-300` | `0.25rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-350` | `0.3125rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-400` | `0.5rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-500` | `0.75rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-600` | `1rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-700` | `1.25rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-800` | `1.5rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-900` | `1.75rem` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-button-height` | `var(--dimension-900)` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-button-icon-width` | `var(--dimension-900)` | — | NAME-ONLY-IN-EXPORT |
| `--dimension-button-justified-height` | `var(--dimension-900)` | — | NAME-ONLY-IN-EXPORT |

## 2. VALUE-DRIFT (14)

| Token | Collection | Export | styles.css |
| --- | --- | --- | --- |
| `--border-100` | core | `1px` | `0.0625rem` |
| `--border-1000` | core | `5.5px` | `0.34375rem` |
| `--border-1100` | core | `6px` | `0.375rem` |
| `--border-1200` | core | `6.5px` | `0.40625rem` |
| `--border-200` | core | `1.5px` | `0.09375rem` |
| `--border-400` | core | `2.5px` | `0.15625rem` |
| `--border-500` | core | `3px` | `0.1875rem` |
| `--border-600` | core | `3.5px` | `0.21875rem` |
| `--border-700` | core | `4px` | `0.25rem` |
| `--border-800` | core | `4.5px` | `0.28125rem` |
| `--border-900` | core | `5px` | `0.3125rem` |
| `--grid-gap` | layout | `var(--dimension-1200)` | `clamp(1.5rem, calc(2.0356vw + 1.0231rem), 2rem)` |
| `--grid-gap-lg` | layout | `var(--dimension-1700)` | `clamp(4rem, calc(2.0356vw + 3.523rem), 4.5rem)` |
| `--radius-full` | core | `62.4375rem` | `999px` |

## 3. MATCH (0)

None.

## 4. NAME-ONLY-IN-HAND

Every `--*` declared in `src/styles.css` whose name is not a WEB name in the
export. These are composition-layer or product-layer properties (type-role
sizes, z-index, elevation, Tailwind `@theme` namespace aliases) with no Figma
variable behind them, plus the colour tokens styles.css names without the
export's `color-` prefix. Listed for the tidy follow-up, not changed here.

135 names.

- `--action-radius-elipse`
- `--action-radius-round`
- `--action-radius-sharp`
- `--body-action-style1-100-size`
- `--body-action-style1-100-tracking`
- `--body-action-style1-200-size`
- `--body-action-style1-200-tracking`
- `--body-action-style1-400-tracking`
- `--body-style1-100-size`
- `--body-style1-100-tracking`
- `--body-style1-200-size`
- `--body-style1-200-tracking`
- `--body-style1-300-size`
- `--body-style1-300-tracking`
- `--body-style1-400-size`
- `--body-style1-400-tracking`
- `--brand`
- `--button-border-100`
- `--button-border-200`
- `--button-border-300`
- `--button-border-400`
- `--button-height-100`
- `--button-height-400`
- `--button-icon-width-100`
- `--button-icon-width-200`
- `--button-icon-width-300`
- `--button-icon-width-400`
- `--button-space-h-100`
- `--button-space-h-200`
- `--button-space-h-300`
- `--button-space-h-400`
- `--button-space-h-offset-100`
- `--button-space-h-offset-200`
- `--button-space-h-offset-300`
- `--button-space-h-offset-400`
- `--button-space-v-100`
- `--button-space-v-200`
- `--button-space-v-300`
- `--button-space-v-400`
- `--caption-100-size`
- `--caption-100-tracking`
- `--color-brand`
- `--color-content-brand`
- `--color-state-focused`
- `--color-state-negative`
- `--color-state-positive`
- `--color-state-warning`
- `--container-lg`
- `--container-max`
- `--content-brand`
- `--font-heading`
- `--font-sans`
- `--icon-dimension-100`
- `--paragraph-spacing`
- `--radius`
- `--shadow-modal`
- `--shadow-overlay`
- `--shadow-raised`
- `--space-200`
- `--space-300`
- `--space-400`
- `--space-500`
- `--space-600`
- `--space-md`
- `--space-xs`
- `--state-focused`
- `--state-negative`
- `--state-positive`
- `--state-warning`
- `--text-050`
- `--text-050--letter-spacing`
- `--text-100`
- `--text-100--letter-spacing`
- `--text-1000`
- `--text-1000--letter-spacing`
- `--text-1100`
- `--text-1100--letter-spacing`
- `--text-1200`
- `--text-1200--letter-spacing`
- `--text-1300`
- `--text-1300--letter-spacing`
- `--text-1400`
- `--text-1400--letter-spacing`
- `--text-1500`
- `--text-1500--letter-spacing`
- `--text-1600`
- `--text-1600--letter-spacing`
- `--text-1700`
- `--text-1700--letter-spacing`
- `--text-200`
- `--text-200--letter-spacing`
- `--text-300`
- `--text-300--letter-spacing`
- `--text-400`
- `--text-400--letter-spacing`
- `--text-500`
- `--text-500--letter-spacing`
- `--text-600`
- `--text-600--letter-spacing`
- `--text-700`
- `--text-700--letter-spacing`
- `--text-800`
- `--text-800--letter-spacing`
- `--text-900`
- `--text-900--letter-spacing`
- `--text-body-lg`
- `--text-body-lg--letter-spacing`
- `--text-body-lg--line-height`
- `--text-body-sm`
- `--text-body-sm--letter-spacing`
- `--text-body-sm--line-height`
- `--text-border-width-100`
- `--text-border-width-200`
- `--text-border-width-300`
- `--text-border-width-400`
- `--title-style1-100-size`
- `--title-style1-100-tracking`
- `--title-style1-200-size`
- `--title-style1-200-tracking`
- `--title-style1-300-size`
- `--title-style1-300-tracking`
- `--title-style1-400-size`
- `--title-style1-400-tracking`
- `--z-base`
- `--z-dropdown`
- `--z-index-base`
- `--z-index-dropdown`
- `--z-index-modal`
- `--z-index-overlay`
- `--z-index-sticky`
- `--z-index-toast`
- `--z-modal`
- `--z-overlay`
- `--z-sticky`
- `--z-toast`

## 5. Unresolved aliases (0)

None. Every alias in the export resolves to a variable that is also in the export.

## 6. UNCONVERTED (19)

Tokens where the export names a `conversionStrategy` it could not carry out,
so no `convertedValue` is published. The generator emits the raw source value
with an inline `UNCONVERTED:` comment — it does **not** invent the missing
divisor (P4).

| Token | Collection | Strategy | buildUnit | Confidence | Emitted |
| --- | --- | --- | --- | --- | --- |
| `--letter-spacing-050` | text-primitives | divide-by-associated-font-size | em | medium | `0px` |
| `--letter-spacing-100` | text-primitives | divide-by-associated-font-size | em | medium | `0px` |
| `--letter-spacing-1000` | text-primitives | divide-by-associated-font-size | em | medium | `-1.75px` |
| `--letter-spacing-1100` | text-primitives | divide-by-associated-font-size | em | medium | `-2.25px` |
| `--letter-spacing-1200` | text-primitives | divide-by-associated-font-size | em | medium | `-2.75px` |
| `--letter-spacing-1300` | text-primitives | divide-by-associated-font-size | em | medium | `-3.25px` |
| `--letter-spacing-1400` | text-primitives | divide-by-associated-font-size | em | medium | `-3.25px` |
| `--letter-spacing-1500` | text-primitives | divide-by-associated-font-size | em | medium | `-4.75px` |
| `--letter-spacing-1600` | text-primitives | divide-by-associated-font-size | em | medium | `-5.75px` |
| `--letter-spacing-1700` | text-primitives | divide-by-associated-font-size | em | medium | `-10.75px` |
| `--letter-spacing-200` | text-primitives | divide-by-associated-font-size | em | medium | `0px` |
| `--letter-spacing-300` | text-primitives | divide-by-associated-font-size | em | medium | `-0.25px` |
| `--letter-spacing-350` | text-primitives | divide-by-associated-font-size | em | medium | `-0.25px` |
| `--letter-spacing-400` | text-primitives | divide-by-associated-font-size | em | medium | `-0.25px` |
| `--letter-spacing-500` | text-primitives | divide-by-associated-font-size | em | medium | `-0.25px` |
| `--letter-spacing-600` | text-primitives | divide-by-associated-font-size | em | medium | `-0.5px` |
| `--letter-spacing-700` | text-primitives | divide-by-associated-font-size | em | medium | `-0.75px` |
| `--letter-spacing-800` | text-primitives | divide-by-associated-font-size | em | medium | `-1px` |
| `--letter-spacing-900` | text-primitives | divide-by-associated-font-size | em | medium | `-1.25px` |

## 7. Layout modes — media queries (resolved)

The export's own `breakpoints.entries` (schema 6) states that layout's
sm/md/lg/xl and their flush / sidebar-main variants are **responsive layout
variants, never themes**, and publishes each mode's `widthPx` directly — the
generator no longer scans the collection for a `device/width` variable.

All 10 layout modes resolve to a width, so they are emitted as
mobile-first `@media (min-width: …)` blocks in ascending width order. The
second axis — `layoutVariant` — is a selector, not a width: `default` lands on
`:root`, every other variant on `[data-jhd-layout-variant="<variant>"]` inside
the same media block.

| Mode | Width | layoutVariant | Emitted as |
| --- | --- | --- | --- |
| `lg` | 1280px | default | `@media (min-width: 1280px) { :root }` |
| `sm` | 375px | default | `@media (min-width: 375px) { :root }` (also the unconditional `:root` base) |
| `md` | 768px | default | `@media (min-width: 768px) { :root }` |
| `xl` | 1920px | default | `@media (min-width: 1920px) { :root }` |
| `lg-flush` | 1280px | flush | `@media (min-width: 1280px) { [data-jhd-layout-variant="flush"] }` |
| `sm-flush` | 375px | flush | `@media (min-width: 375px) { [data-jhd-layout-variant="flush"] }` |
| `md-flush` | 768px | flush | `@media (min-width: 768px) { [data-jhd-layout-variant="flush"] }` |
| `xl-flush` | 1920px | flush | `@media (min-width: 1920px) { [data-jhd-layout-variant="flush"] }` |
| `lg-sidebar-main` | 1280px | sidebar-main | `@media (min-width: 1280px) { [data-jhd-layout-variant="sidebar-main"] }` |
| `lg-sidebar-main-flush` | 1280px | sidebar-main-flush | `@media (min-width: 1280px) { [data-jhd-layout-variant="sidebar-main-flush"] }` |

**P6 (2026-09-05, parent decision) — base moved from `lg` to `sm`:** the
unconditional base now seeds from the SMALLEST-width `default`-variant mode
(`sm`), not the collection's `defaultModeId` (`lg`). `lg` is now purely an
ascending `@media (min-width)` block like every other width, exactly the same
as `md`/`xl`. Superseded: the previous generator (schema 5, `lg` = collection
default) seeded the base from `lg`, so every layout token below `lg`'s width
silently fell back to `lg`'s value instead of `sm`'s — inverting mobile-first.
Viewports narrower than the smallest published sample (`sm`) still resolve to
`sm`'s value; there is no published design intent below that width.

## 8. Hand-authored but SCOPED (0)

Names `styles.css` declares only inside a scoped or conditional block
(`.dark`, `@media`, `@supports`, `@utility`) and never globally. A scoped
declaration cannot supersede the token everywhere, so it does **not** suppress
generation — the generated global declaration is what the scoped one overrides.

None.

## 9. P8 — Tailwind namespace reconciliation

`src/theme.generated.css` emits ONE `@theme` block: a `--<namespace>-*: initial`
reset per namespace the house populates, then house-keyed entries whose suffixes
come from the export's own WEB names (P8.1). P2 does **not** apply to that file —
a namespace reset is only true if the whole namespace is emitted in one place, so
P8 always emits the full namespace and this section is how the hand-authored
`@theme` entries in `src/styles.css` are settled against it.

**GENERATED-EQUIVALENT** — byte-equal to what P8 emits. The operator ruling of
2026-09-06 is *generated wins*, so these are **deleted from styles.css** and no
computed value changes. **VALUE-DRIFT** — same key, different value: styles.css
keeps it (it overrides the generated entry, being later in the cascade) and the
disagreement needs its own ruling. **HAND-ONLY** — a key P8 does not emit at all,
because the export has no variable behind it.

199 generated `@theme` keys across 8 namespaces.
7 hand-authored `@theme` entries fall inside those namespaces — GENERATED-EQUIVALENT: 0 · VALUE-DRIFT: 1 · HAND-ONLY: 6.

| Key | Namespace | P8 emits | styles.css | Status |
| --- | --- | --- | --- | --- |
| `--color-brand` | color | — | `var(--brand)` | HAND-ONLY |
| `--color-content-brand` | color | — | `var(--content-brand)` | HAND-ONLY |
| `--color-state-focused` | color | — | `var(--state-focused)` | HAND-ONLY |
| `--color-state-negative` | color | — | `var(--state-negative)` | HAND-ONLY |
| `--color-state-positive` | color | — | `var(--state-positive)` | HAND-ONLY |
| `--color-state-warning` | color | — | `var(--state-warning)` | HAND-ONLY |
| `--radius-full` | radius | `62.4375rem` | `999px` | VALUE-DRIFT |

### Namespaces NOT reset (P8.3)

| Namespace | Why it is held |
| --- | --- |
| `--spacing` | Tailwind derives numeric spacing from one multiplier, not a suffix namespace — nothing to reset or populate. `p-4` still compiles by design. |
| `--font-weight-*` | action-base still `@apply font-medium` (separate lane); text-primitives publishes weight/strong as the STRING "Medium". |
| `--text-*` | The hand-authored 050–1700 ramp in styles.css is the blocker: its per-step letter-spacing modifiers have no export equivalent, so a reset would drop them. (`badge-base` no longer `@apply`s `text-xs` as of #18, but `font-medium` still survives in `action-base`.) |
| `--z-index-*` | Tailwind resolves `z-<number>` as a BARE value, not through the namespace, so a reset removes nothing and `z-10` compiles either way. The export also has no z collection to populate it from; styles.css's hand-authored --z-index-base…toast scale stays authoritative. |

### Breakpoints emitted (P8.4)

| Key | Value | Figma |
| --- | --- | --- |
| `--breakpoint-sm` | `23.4375rem` | 375px — Figma sm device width |
| `--breakpoint-md` | `48rem` | 768px — Figma md device width |
| `--breakpoint-lg` | `80rem` | 1280px — Figma lg device width |
| `--breakpoint-xl` | `120rem` | 1920px — Figma xl device width |

Tailwind's own `sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280 / `2xl` 1536 are gone
with the reset. `2xl` has no replacement because Figma publishes no fifth device
width. The `flush` and `sidebar-main` rows in `breakpoints.entries` are layout
VARIANTS, not breakpoints: they share their family's width and are selected by
`[data-jhd-layout-variant]` (P3), so bridging them here would invent duplicate
widths.

## 10. Responsive classes (P11) and aliases (P12)

How each variable became CSS. **Class** is the export's own responsive class —
`viewport-width` / `viewport-height` (a fraction of the screen), `fluid-clamp`
(one `clamp()` across the range), `mode-stepped` (per-breakpoint samples),
`fixed` (equal at every mode), `sample-only` (one published sample). **Source**
is where the class came from: a `responsive` **field** on the variable, the
`"N% of screen height|width"` **description** convention, the export's own
`responsiveBehavior` (**export**), or none of the three (**default**).
**Effect** is what this run emitted — only a class named in
`responsive.honourClasses` changes it; every other class takes the per-mode
path, so parity can be pinned.

Honoured this run: `viewport-height`, `viewport-width`, `fluid-clamp`, `fixed`.

82 of 516 emitted variables carry a class — fixed (export): 6 · fixed (rule): 1 · fluid-clamp (export): 14 · mode-stepped (export): 52 · viewport-height (description): 8 · viewport-width (description): 1.
Strategy counts: fixed: 7 · fluid-clamp: 14 · mode-stepped: 52 · viewport-height: 8 · viewport-width: 1.
The other 52 are `mode-stepped` or `sample-only`, which IS the
per-mode path, so they are not listed individually: their output is unchanged.

| Token | Collection | Class | Source | Effect |
| --- | --- | --- | --- | --- |
| `--device-container-max-width` | layout | fixed | rule | 2156px once on the base scope |
| `--device-screen-height-100` | layout | viewport-height | description | 20dvh once on the base scope |
| `--device-screen-height-200` | layout | viewport-height | description | 30dvh once on the base scope |
| `--device-screen-height-300` | layout | viewport-height | description | 40dvh once on the base scope |
| `--device-screen-height-400` | layout | viewport-height | description | 50dvh once on the base scope |
| `--device-screen-height-500` | layout | viewport-height | description | 70dvh once on the base scope |
| `--device-screen-height-600` | layout | viewport-height | description | 80dvh once on the base scope |
| `--device-screen-height-700` | layout | viewport-height | description | 90dvh once on the base scope |
| `--device-screen-height-full` | layout | viewport-height | description | 100dvh once on the base scope |
| `--device-width` | layout | viewport-width | description | 100vw once on the base scope |
| `--grid-col-start-1` | layout | fixed | export | fixed once per layout variant |
| `--grid-col-start-2` | layout | fluid-clamp | export | default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed once per layout variant |
| `--grid-columns` | layout | fixed | export | fixed once per layout variant |
| `--icon-radius-100` | icon | fluid-clamp | export | per-mode |
| `--icon-radius-200` | icon | fluid-clamp | export | per-mode |
| `--icon-radius-300` | icon | fluid-clamp | export | per-mode |
| `--space-button-space-h` | action | fluid-clamp | export | per-mode |
| `--space-button-space-h-offset` | action | fluid-clamp | export | per-mode |
| `--space-spacer-0` | layout | fixed | export | fixed once per layout variant |
| `--text-body-font-size-100` | layout | fluid-clamp | export | default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed once per layout variant |
| `--text-body-font-size-200` | layout | fluid-clamp | export | default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed once per layout variant |
| `--text-body-font-size-300` | layout | fluid-clamp | export | default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed once per layout variant |
| `--text-body-letter-spacing-100` | layout | fixed | export | per-mode |
| `--text-body-letter-spacing-300` | layout | fixed | export | per-mode |
| `--text-body-paragraph-spacing-100` | layout | fluid-clamp | export | default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed once per layout variant |
| `--text-body-paragraph-spacing-200` | layout | fluid-clamp | export | default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed once per layout variant |
| `--text-body-paragraph-spacing-300` | layout | fluid-clamp | export | default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed once per layout variant |
| `--text-title-font-size-100` | layout | fluid-clamp | export | default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed once per layout variant |
| `--text-title-font-size-200` | layout | fluid-clamp | export | default/flush: fluid-clamp once per layout variant; sidebar-main/sidebar-main-flush: fixed once per layout variant |
| `--text-title-letter-spacing-200` | layout | fixed | export | per-mode |

**Untrusted build cells (0)** (P13) — cells that contradict
themselves, so the generator will not let them state the value: an
`identity` conversion whose `rawValue` and `convertedValue` differ, or a
`css` unit that is not the `buildUnit` the same cell published. Each one
emits the raw source value instead — unless a `responsive` field or a
`"N% of screen height|width"` description states the fraction, which outranks
the cell entirely. This is a property of the EXPORT, not of this run: a fixed
plugin export takes the count to zero.

None.

**Warnings (63)** — what the generator would not guess at. A
variable in a `viewport.groups` group with no stated fraction keeps its px
samples: the fix is one description in Figma, not a heuristic here.

| Code | Token | Detail |
| --- | --- | --- |
| `FIXED_VARIES_BY_MODE` | `--text-body-letter-spacing-100` | `fixed` at layout variant `default`, but its modes resolve to 2 different values — per-mode samples emitted instead |
| `FIXED_VARIES_BY_MODE` | `--text-body-letter-spacing-300` | `fixed` at layout variant `default`, but its modes resolve to 2 different values — per-mode samples emitted instead |
| `FIXED_VARIES_BY_MODE` | `--text-title-letter-spacing-200` | `fixed` at layout variant `default`, but its modes resolve to 2 different values — per-mode samples emitted instead |
| `STYLE_CLASS_FONT_BOUND` | `.body-action-style1-100` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.body-action-style1-200` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.body-action-style1-300` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.body-action-style1-400` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.body-style1-100` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.body-style1-200` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.body-style1-300` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.body-style1-400` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-050` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-100` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-1000` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-1100` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-1200` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-1300` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-1400` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-1500` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-1600` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-1700` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-200` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-300` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-400` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-500` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-600` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-700` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-800` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-body-900` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-050` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-100` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-1000` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-1100` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-1200` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-1300` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-1400` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-1500` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-1600` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-1700` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-200` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-300` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-400` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-500` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-600` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-700` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-800` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.text-primitives-title-900` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.title-action-style1-100` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.title-action-style1-200` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.title-action-style1-300` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.title-action-style1-400` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.title-style1-100` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.title-style1-200` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.title-style1-300` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_FONT_BOUND` | `.title-style1-400` | `font-family` literal "Suisse Intl" bound to `--family-font-sans` (`family/font-sans`), the export's own font-family variable of the same value. |
| `STYLE_CLASS_PARAGRAPH_SPACING_BOUND` | `.body-action-style1-100` | `paragraphSpacing` bound to `--text-body-paragraph-spacing-100` (`text/body/paragraph-spacing-100`), stated nowhere in this style's own `cssClass.declarations` — appended as `margin-block-end: var(--text-body-paragraph-spacing-100, 13px)` (P23, spacer-margins policy). |
| `STYLE_CLASS_PARAGRAPH_SPACING_BOUND` | `.body-action-style1-200` | `paragraphSpacing` bound to `--text-body-paragraph-spacing-200` (`text/body/paragraph-spacing-200`), stated nowhere in this style's own `cssClass.declarations` — appended as `margin-block-end: var(--text-body-paragraph-spacing-200, 15px)` (P23, spacer-margins policy). |
| `STYLE_CLASS_PARAGRAPH_SPACING_BOUND` | `.body-action-style1-300` | `paragraphSpacing` bound to `--text-body-paragraph-spacing-200` (`text/body/paragraph-spacing-200`), stated nowhere in this style's own `cssClass.declarations` — appended as `margin-block-end: var(--text-body-paragraph-spacing-200, 15px)` (P23, spacer-margins policy). |
| `STYLE_CLASS_PARAGRAPH_SPACING_BOUND` | `.body-action-style1-400` | `paragraphSpacing` bound to `--text-body-paragraph-spacing-300` (`text/body/paragraph-spacing-300`), stated nowhere in this style's own `cssClass.declarations` — appended as `margin-block-end: var(--text-body-paragraph-spacing-300, 19px)` (P23, spacer-margins policy). |
| `STYLE_CLASS_PARAGRAPH_SPACING_BOUND` | `.body-style1-100` | `paragraphSpacing` bound to `--text-body-paragraph-spacing-100` (`text/body/paragraph-spacing-100`), stated nowhere in this style's own `cssClass.declarations` — appended as `margin-block-end: var(--text-body-paragraph-spacing-100, 13px)` (P23, spacer-margins policy). |
| `STYLE_CLASS_PARAGRAPH_SPACING_BOUND` | `.body-style1-200` | `paragraphSpacing` bound to `--text-body-paragraph-spacing-200` (`text/body/paragraph-spacing-200`), stated nowhere in this style's own `cssClass.declarations` — appended as `margin-block-end: var(--text-body-paragraph-spacing-200, 15px)` (P23, spacer-margins policy). |
| `STYLE_CLASS_PARAGRAPH_SPACING_BOUND` | `.body-style1-300` | `paragraphSpacing` bound to `--text-body-paragraph-spacing-300` (`text/body/paragraph-spacing-300`), stated nowhere in this style's own `cssClass.declarations` — appended as `margin-block-end: var(--text-body-paragraph-spacing-300, 19px)` (P23, spacer-margins policy). |
| `STYLE_CLASS_PARAGRAPH_SPACING_BOUND` | `.body-style1-400` | `paragraphSpacing` bound to `--text-body-paragraph-spacing-400` (`text/body/paragraph-spacing-400`), stated nowhere in this style's own `cssClass.declarations` — appended as `margin-block-end: var(--text-body-paragraph-spacing-400, 27px)` (P23, spacer-margins policy). |

**Aliases (16)** — published names that are a `var()` hop onto a
generated token, expanded from `aliases` over the emitted leaves. The token is
still the single place the value is stated.

| Alias | Target | Pattern |
| --- | --- | --- |
| `--screen-height-100` | `--device-screen-height-100` | `--screen-height-*` |
| `--screen-height-200` | `--device-screen-height-200` | `--screen-height-*` |
| `--screen-height-300` | `--device-screen-height-300` | `--screen-height-*` |
| `--screen-height-400` | `--device-screen-height-400` | `--screen-height-*` |
| `--screen-height-500` | `--device-screen-height-500` | `--screen-height-*` |
| `--screen-height-600` | `--device-screen-height-600` | `--screen-height-*` |
| `--screen-height-700` | `--device-screen-height-700` | `--screen-height-*` |
| `--screen-height-full` | `--device-screen-height-full` | `--screen-height-*` |
| `--height-screen-100` | `--screen-height-100` | `--height-screen-*` |
| `--height-screen-200` | `--screen-height-200` | `--height-screen-*` |
| `--height-screen-300` | `--screen-height-300` | `--height-screen-*` |
| `--height-screen-400` | `--screen-height-400` | `--height-screen-*` |
| `--height-screen-500` | `--screen-height-500` | `--height-screen-*` |
| `--height-screen-600` | `--screen-height-600` | `--height-screen-*` |
| `--height-screen-700` | `--screen-height-700` | `--height-screen-*` |
| `--height-screen-full` | `--screen-height-full` | `--height-screen-*` |

## 11. Styles (P21) and font weights (P22)

One class per Figma style, from the export's own `cssClass` — **selector and
declarations verbatim, in the export's order**. Nothing here is recomputed from
a style name or from `properties`: a style the export gives no declarations
for is listed and not emitted. Hand-authored wins per class exactly as it does
per token (P2): a selector `styles.css` declares at top level is reported
MATCH / VALUE-DRIFT and left to the consumer.

| | |
| --- | --- |
| Styles in export | 74 |
| GENERATED (written to `src/styles.generated.css`) | 74 |
| MATCH (hand-authored, same declarations) | 0 |
| VALUE-DRIFT (hand-authored, different declarations) | 0 |
| NO-DECLARATIONS (no `cssClass.declarations` — not a class) | 0 |
| Shadowed by a hand-authored `@utility` of the same name | 16 |

| Style | Type | Selector | Status | Declarations | Also `@utility` |
| --- | --- | --- | --- | --- | --- |
| `title-style1/100` | TEXT | `.title-style1-100` | GENERATED | `font-size: var(--text-title-font-size-100, 1rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-300, -0.015625em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | yes |
| `title-style1/200` | TEXT | `.title-style1-200` | GENERATED | `font-size: var(--text-title-font-size-200, 1.25rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-400, -0.0125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | yes |
| `title-style1/300` | TEXT | `.title-style1-300` | GENERATED | `font-size: var(--text-title-font-size-300, 2.5rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-900, -0.03125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | yes |
| `title-style1/400` | TEXT | `.title-style1-400` | GENERATED | `font-size: var(--text-title-font-size-400, 5rem)`<br>`line-height: 1.05`<br>`letter-spacing: var(--letter-spacing-1200, -0.034375em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | yes |
| `title-action-style1/100` | TEXT | `.title-action-style1-100` | GENERATED | `font-size: var(--text-title-font-size-100, 1rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-300, -0.015625em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`text-decoration: underline` | yes |
| `title-action-style1/200` | TEXT | `.title-action-style1-200` | GENERATED | `font-size: var(--text-title-font-size-200, 1.25rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-400, -0.0125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`text-decoration: underline` | yes |
| `title-action-style1/300` | TEXT | `.title-action-style1-300` | GENERATED | `font-size: var(--text-title-font-size-300, 2.5rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-900, -0.03125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`text-decoration: underline` | yes |
| `title-action-style1/400` | TEXT | `.title-action-style1-400` | GENERATED | `font-size: var(--text-title-font-size-400, 5rem)`<br>`line-height: 1.05`<br>`letter-spacing: var(--letter-spacing-1200, -0.034375em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`text-decoration: underline` | yes |
| `body-style1/100` | TEXT | `.body-style1-100` | GENERATED | `font-size: var(--text-body-font-size-100, 0.875rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--text-body-letter-spacing-100, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`margin-block-end: var(--text-body-paragraph-spacing-100, 13px)` | yes |
| `body-style1/200` | TEXT | `.body-style1-200` | GENERATED | `font-size: var(--text-body-font-size-200, 1rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--text-body-letter-spacing-200, -0.015625em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`margin-block-end: var(--text-body-paragraph-spacing-200, 15px)` | yes |
| `body-style1/300` | TEXT | `.body-style1-300` | GENERATED | `font-size: var(--text-body-font-size-300, 1.25rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--text-body-letter-spacing-300, -0.0125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`margin-block-end: var(--text-body-paragraph-spacing-300, 19px)` | yes |
| `body-style1/400` | TEXT | `.body-style1-400` | GENERATED | `font-size: var(--text-body-font-size-400, 1.75rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--text-body-letter-spacing-400, -0.017857em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`margin-block-end: var(--text-body-paragraph-spacing-400, 27px)` | yes |
| `body-action-style1/100` | TEXT | `.body-action-style1-100` | GENERATED | `font-size: var(--size-100, 0.75rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-100, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`text-decoration: underline`<br>`margin-block-end: var(--text-body-paragraph-spacing-100, 13px)` | yes |
| `body-action-style1/200` | TEXT | `.body-action-style1-200` | GENERATED | `font-size: var(--size-200, 0.875rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-200, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`text-decoration: underline`<br>`margin-block-end: var(--text-body-paragraph-spacing-200, 15px)` | yes |
| `body-action-style1/300` | TEXT | `.body-action-style1-300` | GENERATED | `font-size: var(--text-body-font-size-200, 1rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-300, -0.015625em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`text-decoration: underline`<br>`margin-block-end: var(--text-body-paragraph-spacing-200, 15px)` | yes |
| `body-action-style1/400` | TEXT | `.body-action-style1-400` | GENERATED | `font-size: var(--text-body-font-size-300, 1.25rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-400, -0.0125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")`<br>`text-decoration: underline`<br>`margin-block-end: var(--text-body-paragraph-spacing-300, 19px)` | yes |
| `.text-primitives/title/050` | TEXT | `.text-primitives-title-050` | GENERATED | `font-size: var(--size-050, 0.625rem)`<br>`line-height: 1.15`<br>`letter-spacing: var(--letter-spacing-050, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/100` | TEXT | `.text-primitives-title-100` | GENERATED | `font-size: var(--size-100, 0.75rem)`<br>`line-height: 1.15`<br>`letter-spacing: var(--letter-spacing-100, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/200` | TEXT | `.text-primitives-title-200` | GENERATED | `font-size: var(--size-200, 0.875rem)`<br>`line-height: 1.15`<br>`letter-spacing: var(--letter-spacing-200, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/300` | TEXT | `.text-primitives-title-300` | GENERATED | `font-size: var(--size-300, 1rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-300, -0.015625em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/400` | TEXT | `.text-primitives-title-400` | GENERATED | `font-size: var(--size-400, 1.25rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-400, -0.0125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/500` | TEXT | `.text-primitives-title-500` | GENERATED | `font-size: var(--size-500, 1.5rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-500, -0.010417em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/600` | TEXT | `.text-primitives-title-600` | GENERATED | `font-size: var(--size-600, 1.75rem)`<br>`line-height: 1.1`<br>`letter-spacing: var(--letter-spacing-600, -0.017857em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/700` | TEXT | `.text-primitives-title-700` | GENERATED | `font-size: var(--size-700, 2rem)`<br>`line-height: 1.05`<br>`letter-spacing: var(--letter-spacing-700, -0.023437em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/800` | TEXT | `.text-primitives-title-800` | GENERATED | `font-size: var(--size-800, 2.5rem)`<br>`line-height: 1.05`<br>`letter-spacing: var(--letter-spacing-800, -0.025em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/900` | TEXT | `.text-primitives-title-900` | GENERATED | `font-size: var(--size-900, 3rem)`<br>`line-height: 1.05`<br>`letter-spacing: var(--letter-spacing-900, -0.026042em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/1000` | TEXT | `.text-primitives-title-1000` | GENERATED | `font-size: var(--size-1000, 3.5rem)`<br>`line-height: 1.5`<br>`letter-spacing: var(--letter-spacing-1000, -0.03125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/1100` | TEXT | `.text-primitives-title-1100` | GENERATED | `font-size: var(--size-1100, 4rem)`<br>`line-height: 1.05`<br>`letter-spacing: var(--letter-spacing-1100, -0.035156em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/1200` | TEXT | `.text-primitives-title-1200` | GENERATED | `font-size: var(--size-1200, 5rem)`<br>`line-height: 1.05`<br>`letter-spacing: var(--letter-spacing-1200, -0.034375em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/1300` | TEXT | `.text-primitives-title-1300` | GENERATED | `font-size: var(--size-1300, 5.5rem)`<br>`line-height: 1`<br>`letter-spacing: var(--letter-spacing-1300, -0.036932em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/1400` | TEXT | `.text-primitives-title-1400` | GENERATED | `font-size: var(--size-1400, 6rem)`<br>`line-height: 1`<br>`letter-spacing: var(--letter-spacing-1400, -0.033854em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/1500` | TEXT | `.text-primitives-title-1500` | GENERATED | `font-size: var(--size-1500, 8rem)`<br>`line-height: 1`<br>`letter-spacing: var(--letter-spacing-1500, -0.037109em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/1600` | TEXT | `.text-primitives-title-1600` | GENERATED | `font-size: var(--size-1600, 10rem)`<br>`line-height: 1`<br>`letter-spacing: var(--letter-spacing-1600, -0.035937em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/title/1700` | TEXT | `.text-primitives-title-1700` | GENERATED | `font-size: var(--size-1700, 16rem)`<br>`line-height: 1`<br>`letter-spacing: var(--letter-spacing-1700, -0.041992em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/100` | TEXT | `.text-primitives-body-100` | GENERATED | `font-size: var(--size-100, 0.75rem)`<br>`line-height: 1.45`<br>`letter-spacing: var(--letter-spacing-body-100, 0.041667em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/050` | TEXT | `.text-primitives-body-050` | GENERATED | `font-size: var(--size-100, 0.75rem)`<br>`line-height: 1.45`<br>`letter-spacing: var(--letter-spacing-body-100, 0.041667em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/200` | TEXT | `.text-primitives-body-200` | GENERATED | `font-size: var(--size-200, 0.875rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-200, 0.053571em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/300` | TEXT | `.text-primitives-body-300` | GENERATED | `font-size: var(--size-300, 1rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-300, 0.046875em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/400` | TEXT | `.text-primitives-body-400` | GENERATED | `font-size: var(--size-400, 1.25rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-400, 0.0375em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/500` | TEXT | `.text-primitives-body-500` | GENERATED | `font-size: var(--size-500, 1.5rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-500, 0.010417em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/600` | TEXT | `.text-primitives-body-600` | GENERATED | `font-size: var(--size-600, 1.75rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-600, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/700` | TEXT | `.text-primitives-body-700` | GENERATED | `font-size: var(--size-700, 2rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-700, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/800` | TEXT | `.text-primitives-body-800` | GENERATED | `font-size: var(--size-800, 2.5rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-800, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/900` | TEXT | `.text-primitives-body-900` | GENERATED | `font-size: var(--size-900, 3rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-900, 0em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/1000` | TEXT | `.text-primitives-body-1000` | GENERATED | `font-size: var(--size-1000, 3.5rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-1000, -0.004464em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/1100` | TEXT | `.text-primitives-body-1100` | GENERATED | `font-size: var(--size-1100, 4rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-1100, -0.011719em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/1200` | TEXT | `.text-primitives-body-1200` | GENERATED | `font-size: var(--size-1200, 5rem)`<br>`line-height: 0.13`<br>`letter-spacing: var(--letter-spacing-body-1200, -0.015625em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/1300` | TEXT | `.text-primitives-body-1300` | GENERATED | `font-size: var(--size-1300, 5.5rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-1300, -0.022727em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/1400` | TEXT | `.text-primitives-body-1400` | GENERATED | `font-size: var(--size-1400, 6rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-1400, -0.03125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/1500` | TEXT | `.text-primitives-body-1500` | GENERATED | `font-size: var(--size-1500, 8rem)`<br>`line-height: 1.3`<br>`letter-spacing: var(--letter-spacing-body-1500, -0.03125em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/1600` | TEXT | `.text-primitives-body-1600` | GENERATED | `font-size: var(--size-1600, 10rem)`<br>`line-height: 1.2`<br>`letter-spacing: var(--letter-spacing-1600, -0.035937em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `.text-primitives/body/1700` | TEXT | `.text-primitives-body-1700` | GENERATED | `font-size: var(--size-1700, 16rem)`<br>`line-height: 1.2`<br>`letter-spacing: var(--letter-spacing-1700, -0.041992em)`<br>`font-weight: 500`<br>`font-family: var(--family-font-sans, "Suisse Intl")` | — |
| `border/border-focused` | EFFECT | `.effect-border-border-focused` | GENERATED | `box-shadow: 0px 0px 0px 2px var(--border-focused-dark, #3A96CFFF)` | — |
| `effect/blur/blur-0` | EFFECT | `.effect-effect-blur-blur-0` | GENERATED | `filter: blur(var(--blur-0, 0px))` | — |
| `effect/blur/blur-100` | EFFECT | `.effect-effect-blur-blur-100` | GENERATED | `filter: blur(var(--blur-100, 12px))` | — |
| `effect/blur/blur-200` | EFFECT | `.effect-effect-blur-blur-200` | GENERATED | `filter: blur(var(--blur-200, 32px))` | — |
| `effect/blur/blur-300` | EFFECT | `.effect-effect-blur-blur-300` | GENERATED | `filter: blur(var(--blur-300, 50px))` | — |
| `effect/material-blur/material-blur-0` | EFFECT | `.effect-effect-material-blur-material-blur-0` | GENERATED | `backdrop-filter: blur(var(--blur-0, 0px))` | — |
| `effect/material-blur/material-blur-100` | EFFECT | `.effect-effect-material-blur-material-blur-100` | GENERATED | `backdrop-filter: blur(var(--blur-100, 12px))` | — |
| `effect/material-blur/material-blur-200` | EFFECT | `.effect-effect-material-blur-material-blur-200` | GENERATED | `backdrop-filter: blur(var(--blur-200, 32px))` | — |
| `effect/material-blur/material-blur-300` | EFFECT | `.effect-effect-material-blur-material-blur-300` | GENERATED | `backdrop-filter: blur(var(--blur-300, 50px))` | — |
| `effect/shadow/drop-shadow-0` | EFFECT | `.effect-effect-shadow-drop-shadow-0` | GENERATED | `box-shadow: 0px 0px 0px var(--elevation-0, rgba(0, 0, 0, 0))` | — |
| `effect/shadow/drop-shadow-100` | EFFECT | `.effect-effect-shadow-drop-shadow-100` | GENERATED | `box-shadow: 0px 0px 1px var(--elevation-600, rgba(0, 0, 0, 0.1)), 0px 2px 2px var(--elevation-500, rgba(0, 0, 0, 0.07)), 0px 4px 2px var(--elevation-300, rgba(0, 0, 0, 0.05)), 0px 7px 3px var(--elevation-100, rgba(0, 0, 0, 0.01)), 0px 11px 3px var(--elevation-0, rgba(0, 0, 0, 0))` | — |
| `effect/shadow/drop-shadow-200` | EFFECT | `.effect-effect-shadow-drop-shadow-200` | GENERATED | `box-shadow: 0px 0px 2px var(--elevation-800, rgba(0, 0, 0, 0.2)), 0px 4px 4px var(--elevation-700, rgba(0, 0, 0, 0.15)), 0px 9px 5px var(--elevation-400, rgba(0, 0, 0, 0.06)), 0px 16px 6px var(--elevation-200, rgba(0, 0, 0, 0.02)), 0px 25px 7px var(--elevation-0, rgba(0, 0, 0, 0))` | — |
| `effect/shadow/inner-shadow-0` | EFFECT | `.effect-effect-shadow-inner-shadow-0` | GENERATED | `box-shadow: inset 0px 0px 0px var(--elevation-0, rgba(0, 0, 0, 0))` | — |
| `effect/shadow/inner-shadow-100` | EFFECT | `.effect-effect-shadow-inner-shadow-100` | GENERATED | `box-shadow: inset 0px 0px 2px var(--elevation-600, rgba(0, 0, 0, 0.1)), inset 0px 2px 2px var(--elevation-500, rgba(0, 0, 0, 0.07)), inset 0px 4px 2px var(--elevation-300, rgba(0, 0, 0, 0.05)), inset 0px 7px 3px var(--elevation-100, rgba(0, 0, 0, 0.01)), inset 0px 11px 3px var(--elevation-0, rgba(0, 0, 0, 0))` | — |
| `effect/shadow/inner-shadow-200` | EFFECT | `.effect-effect-shadow-inner-shadow-200` | GENERATED | `box-shadow: inset 0px 0px 2px var(--elevation-800, rgba(0, 0, 0, 0.2)), inset 0px 4px 4px var(--elevation-700, rgba(0, 0, 0, 0.15)), inset 0px 9px 5px var(--elevation-400, rgba(0, 0, 0, 0.06)), inset 0px 16px 6px var(--elevation-200, rgba(0, 0, 0, 0.02)), inset 0px 25px 7px var(--elevation-0, rgba(0, 0, 0, 0))` | — |
| `default` | GRID | `.grid-default` | GENERATED | `display: grid`<br>`grid-template-columns: repeat(12, 1fr)`<br>`column-gap: var(--grid-gap, 48px)` | — |
| `default-margin-sm` | GRID | `.grid-default-margin-sm` | GENERATED | `display: grid`<br>`grid-template-columns: repeat(12, 1fr)`<br>`column-gap: var(--grid-gap, 48px)` | — |
| `default-xl` | GRID | `.grid-default-xl` | GENERATED | `display: grid`<br>`grid-template-columns: repeat(12, 1fr)`<br>`column-gap: var(--grid-gap, 48px)` | — |
| `default-xl-margin-sm` | GRID | `.grid-default-xl-margin-sm` | GENERATED | `display: grid`<br>`grid-template-columns: repeat(12, 1fr)`<br>`column-gap: var(--grid-gap, 48px)` | — |
| `flush` | GRID | `.grid-flush` | GENERATED | `display: grid`<br>`grid-template-columns: repeat(12, 1fr)`<br>`column-gap: var(--grid-gap, 48px)` | — |
| `sidebar-aside` | GRID | `.grid-sidebar-aside` | GENERATED | `display: grid`<br>`grid-template-columns: repeat(1, 1fr)`<br>`column-gap: var(--grid-gap, 48px)` | — |
| `sidebar-main` | GRID | `.grid-sidebar-main` | GENERATED | `display: grid`<br>`grid-template-columns: repeat(12, 1fr)`<br>`column-gap: var(--grid-gap, 48px)` | — |

**`@utility` shadows (16)** — Tailwind compiles `@utility foo` to
`.foo`, so a hand-authored utility of the same name and a generated class are
the SAME selector from two files. It is not an unconditional declaration of the
selector (P2 takes the same reading of `@utility` for custom properties), so it
does not suppress generation — the consumer deletes the utility when it adopts
the class. Listed so the swap is a checklist, not a surprise.

**Font weights (P22, 1)** — a STRING variable holding a Figma
font-style name is a `font-weight`, and `font-weight: "Medium"` is not a value
CSS accepts. Schema 12 states the number on the variable itself
(`fontWeightNumeric`), so the token carries the export's own `css` verbatim.
The style name and confidence are the export's; nothing here maps a name to a
number.

| Token | Collection | Value | Figma style name | Confidence | Emitted |
| --- | --- | --- | --- | --- | --- |
| `--weight-strong` | text-primitives | `500` | `Medium` | high | yes |

**`cssCustomPropertySheets` cross-check (653 differences)** — schema 12
publishes its own `:root` / theme blocks. They are **never emitted**: the
consumer's policies (colour format, ratio form, motion unit, cell trust,
hand-authored-wins) decide what a token reads as, and shipping the plugin's
sheet alongside would put two disagreeing stylesheets in one repo. They are
compared instead — same variable, same mode, this run's value against the
export's. A row below is one of the two disagreeing, and neither is silently
resolved: a house policy difference belongs here as the record of a deliberate
choice, and anything else is an export defect to fix in the plugin.

Per collection: action: 36 · color: 51 · color-primitives: 134 · core: 4 · icon: 32 · layout: 330 · motion: 46 · text-primitives: 20.

| Token | Collection | Mode | Sheet says | Generated |
| --- | --- | --- | --- | --- |
| `--aspect-landscape` | core | default | `3:2` | `3 / 2` |
| `--aspect-portrait` | core | default | `4:5` | `4 / 5` |
| `--aspect-square` | core | default | `1:1` | `1 / 1` |
| `--aspect-tall` | core | default | `2:3` | `2 / 3` |
| `--background-action-primary` | color | dark | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-thinnest)` |
| `--background-action-primary` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--background-action-secondary` | color | dark | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-thin)` |
| `--background-action-secondary` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--background-disabled-dark` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-500))` | `var(--background-material-base-inverse)` |
| `--background-disabled-dark` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-600))` | `var(--background-material-base-inverse)` |
| `--background-disabled-darker` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-600))` | `var(--background-material-inverse-thick)` |
| `--background-disabled-darker` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-700))` | `var(--background-material-inverse-thick)` |
| `--background-disabled-darker` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-600))` | `var(--background-material-inverse-thick)` |
| `--background-disabled-dark` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-500))` | `var(--background-material-base-inverse)` |
| `--background-disabled-light` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--background-disabled-light` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-200))` | `var(--background-material-inverse-thin)` |
| `--background-disabled-lighter` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--background-disabled-lighter` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-100))` | `var(--background-material-inverse-thinnest)` |
| `--background-disabled-lighter` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--background-disabled-light` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--background-input-disabled` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--background-input-disabled` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-200))` | `var(--background-material-inverse-thin)` |
| `--background-input-disabled` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--background-input-primary` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--background-input-primary` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-100))` | `var(--background-material-inverse-thinnest)` |
| `--background-input-primary` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--background-warning-lighter` | color | dark | `var(--warning-base)` | `#f5a40b` |
| `--border-action-primary-inverse` | color | bttf | `rgb(from var(--color-core-white) r g b / var(--opacity-100))` | `var(--background-material-thinnest)` |
| `--border-action-primary-inverse` | color | dark | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-thinnest)` |
| `--border-action-primary-inverse` | color | light | `rgb(from var(--color-core-white) r g b / var(--opacity-100))` | `var(--background-material-thinnest)` |
| `--border-action-primary` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-200))` | `var(--background-material-inverse-thin)` |
| `--border-action-primary` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--border-action-secondary` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--border-action-secondary` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-600))` | `var(--background-material-base-inverse)` |
| `--border-action-secondary` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--border-default-primary` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--border-default-primary` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-100))` | `var(--background-material-inverse-thinnest)` |
| `--border-default-primary` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--border-default-secondary` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--border-default-secondary` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-200))` | `var(--background-material-inverse-thin)` |
| `--border-default-secondary` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--border-disabled-dark` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-500))` | `var(--background-material-base-inverse)` |
| `--border-disabled-dark` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-600))` | `var(--background-material-base-inverse)` |
| `--border-disabled-darker` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-600))` | `var(--background-material-inverse-thick)` |
| `--border-disabled-darker` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-700))` | `var(--background-material-inverse-thick)` |
| `--border-disabled-darker` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-600))` | `var(--background-material-inverse-thick)` |
| `--border-disabled-dark` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-500))` | `var(--background-material-base-inverse)` |
| `--border-disabled-light` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--border-disabled-light` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-200))` | `var(--background-material-inverse-thin)` |
| `--border-disabled-lighter` | color | bttf | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--border-disabled-lighter` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-100))` | `var(--background-material-inverse-thinnest)` |
| `--border-disabled-lighter` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-50))` | `var(--background-material-inverse-thinnest)` |
| `--border-disabled-light` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-100))` | `var(--background-material-inverse-thin)` |
| `--border-width-button-border-width` | action | 100 | `1px` | `var(--border-100)` |
| `--border-width-button-border-width` | action | 200 | `1.5px` | `var(--border-200)` |
| `--border-width-button-border-width` | action | 300 | `2.5px` | `var(--border-400)` |
| `--border-width-button-border-width` | action | 400 | `3.5px` | `var(--border-600)` |
| `--border-width-button-justified-border-width` | action | 100 | `2px` | `var(--border-300-primary)` |
| `--border-width-button-justified-border-width` | action | 200 | `2px` | `var(--border-300-primary)` |
| `--border-width-button-justified-border-width` | action | 300 | `2.5px` | `var(--border-400)` |
| `--border-width-button-justified-border-width` | action | 400 | `3px` | `var(--border-500)` |
| `--border-width-text-border-width` | action | 100 | `1.5px` | `var(--border-200)` |
| `--border-width-text-border-width` | action | 200 | `2px` | `var(--border-300-primary)` |
| `--border-width-text-border-width` | action | 300 | `4px` | `var(--border-700)` |
| `--border-width-text-border-width` | action | 400 | `6.5px` | `var(--border-1200)` |
| `--color-core-black` | color-primitives | default | `#000000FF` | `#000000` |
| `--color-core-white` | color-primitives | default | `#FFFFFFFF` | `#ffffff` |
| `--color-palette-cod-grey-100` | color-primitives | default | `#EDEDEDFF` | `#ededed` |
| `--color-palette-cod-grey-200` | color-primitives | default | `#D1D1D1FF` | `#d1d1d1` |
| `--color-palette-cod-grey-300` | color-primitives | default | `#BDBDBDFF` | `#bdbdbd` |
| `--color-palette-cod-grey-400` | color-primitives | default | `#989898FF` | `#989898` |
| `--color-palette-cod-grey-500` | color-primitives | default | `#7C7C7CFF` | `#7c7c7c` |
| `--color-palette-cod-grey-50` | color-primitives | default | `#F6F6F6FF` | `#f6f6f6` |
| `--color-palette-cod-grey-600` | color-primitives | default | `#696969FF` | `#696969` |
| `--color-palette-cod-grey-700` | color-primitives | default | `#575757FF` | `#575757` |
| `--color-palette-cod-grey-800` | color-primitives | default | `#4A4A4AFF` | `#4a4a4a` |
| `--color-palette-cod-grey-900` | color-primitives | default | `#383838FF` | `#383838` |
| `--color-palette-cod-grey-950` | color-primitives | default | `#0A0A0AFF` | `#0a0a0a` |
| `--color-palette-cognac-100` | color-primitives | default | `#FFEAD2FF` | `#ffead2` |
| `--color-palette-cognac-200` | color-primitives | default | `#FDD5AAFF` | `#fdd5aa` |
| `--color-palette-cognac-300` | color-primitives | default | `#FDBB7CFF` | `#fdbb7c` |
| `--color-palette-cognac-400` | color-primitives | default | `#FC974FFF` | `#fc974f` |
| `--color-palette-cognac-500` | color-primitives | default | `#EE701BFF` | `#ee701b` |
| `--color-palette-cognac-50` | color-primitives | default | `#FFF6EBFF` | `#fff6eb` |
| `--color-palette-cognac-600` | color-primitives | default | `#E45107FF` | `#e45107` |
| `--color-palette-cognac-700` | color-primitives | default | `#C73F05FF` | `#c73f05` |
| `--color-palette-cognac-800` | color-primitives | default | `#A33001FF` | `#a33001` |
| `--color-palette-cognac-900` | color-primitives | default | `#7F2601FF` | `#7f2601` |
| `--color-palette-cognac-950` | color-primitives | default | `#4A1300FF` | `#4a1300` |
| `--color-palette-deep-teal-100` | color-primitives | default | `#C9FEF1FF` | `#c9fef1` |
| `--color-palette-deep-teal-200` | color-primitives | default | `#92FDE3FF` | `#92fde3` |
| `--color-palette-deep-teal-300` | color-primitives | default | `#54F4D4FF` | `#54f4d4` |
| `--color-palette-deep-teal-400` | color-primitives | default | `#21E0BFFF` | `#21e0bf` |
| `--color-palette-deep-teal-500` | color-primitives | default | `#08C4A7FF` | `#08c4a7` |
| `--color-palette-deep-teal-50` | color-primitives | default | `#EFFEFAFF` | `#effefa` |
| `--color-palette-deep-teal-600` | color-primitives | default | `#03AA94FF` | `#03aa94` |
| `--color-palette-deep-teal-700` | color-primitives | default | `#089180FF` | `#089180` |
| `--color-palette-deep-teal-800` | color-primitives | default | `#0D6D60FF` | `#0d6d60` |
| `--color-palette-deep-teal-900` | color-primitives | default | `#0F524BFF` | `#0f524b` |
| `--color-palette-deep-teal-950` | color-primitives | default | `#013C38FF` | `#013c38` |
| `--color-palette-desert-storm-100` | color-primitives | default | `#F3EFEDFF` | `#f3efed` |
| `--color-palette-desert-storm-200` | color-primitives | default | `#E9E2DFFF` | `#e9e2df` |
| `--color-palette-desert-storm-300` | color-primitives | default | `#D9CDC8FF` | `#d9cdc8` |
| `--color-palette-desert-storm-400` | color-primitives | default | `#C5B3ACFF` | `#c5b3ac` |
| `--color-palette-desert-storm-500` | color-primitives | default | `#AA9289FF` | `#aa9289` |
| `--color-palette-desert-storm-50` | color-primitives | default | `#F9F8F7FF` | `#f9f8f7` |
| `--color-palette-desert-storm-600` | color-primitives | default | `#94796EFF` | `#94796e` |
| `--color-palette-desert-storm-700` | color-primitives | default | `#7D6358FF` | `#7d6358` |
| `--color-palette-desert-storm-800` | color-primitives | default | `#68534DFF` | `#68534d` |
| `--color-palette-desert-storm-900` | color-primitives | default | `#52413DFF` | `#52413d` |
| `--color-palette-desert-storm-950` | color-primitives | default | `#2D2522FF` | `#2d2522` |
| `--color-palette-elm-100` | color-primitives | default | `#C5FFFDFF` | `#c5fffd` |
| `--color-palette-elm-200` | color-primitives | default | `#8BFFFBFF` | `#8bfffb` |
| `--color-palette-elm-300` | color-primitives | default | `#4AFEFAFF` | `#4afefa` |
| `--color-palette-elm-400` | color-primitives | default | `#15EBECFF` | `#15ebec` |
| `--color-palette-elm-500` | color-primitives | default | `#00CCD0FF` | `#00ccd0` |
| `--color-palette-elm-50` | color-primitives | default | `#EEFFFDFF` | `#eefffd` |
| `--color-palette-elm-600` | color-primitives | default | `#00B1B8FF` | `#00b1b8` |
| `--color-palette-elm-700` | color-primitives | default | `#009199FF` | `#009199` |
| `--color-palette-elm-800` | color-primitives | default | `#06686FFF` | `#06686f` |
| `--color-palette-elm-900` | color-primitives | default | `#09494EFF` | `#09494e` |
| `--color-palette-elm-950` | color-primitives | default | `#002F35FF` | `#002f35` |
| `--color-palette-fun-green-100` | color-primitives | default | `#D8FFE9FF` | `#d8ffe9` |
| `--color-palette-fun-green-200` | color-primitives | default | `#B4FED3FF` | `#b4fed3` |
| `--color-palette-fun-green-300` | color-primitives | default | `#79FCB2FF` | `#79fcb2` |
| `--color-palette-fun-green-400` | color-primitives | default | `#38F087FF` | `#38f087` |
| `--color-palette-fun-green-500` | color-primitives | default | `#0ED967FF` | `#0ed967` |
| `--color-palette-fun-green-50` | color-primitives | default | `#EEFFF4FF` | `#eefff4` |
| `--color-palette-fun-green-600` | color-primitives | default | `#05BD56FF` | `#05bd56` |
| `--color-palette-fun-green-700` | color-primitives | default | `#09A44EFF` | `#09a44e` |
| `--color-palette-fun-green-800` | color-primitives | default | `#0F8041FF` | `#0f8041` |
| `--color-palette-fun-green-900` | color-primitives | default | `#0B562DFF` | `#0b562d` |
| `--color-palette-fun-green-950` | color-primitives | default | `#003318FF` | `#003318` |
| `--color-palette-lavender-gray-100` | color-primitives | default | `#F0F0F7FF` | `#f0f0f7` |
| `--color-palette-lavender-gray-200` | color-primitives | default | `#E3E3F1FF` | `#e3e3f1` |
| `--color-palette-lavender-gray-300` | color-primitives | default | `#D5D2EAFF` | `#d5d2ea` |
| `--color-palette-lavender-gray-400` | color-primitives | default | `#BEBADDFF` | `#bebadd` |
| `--color-palette-lavender-gray-500` | color-primitives | default | `#A097C9FF` | `#a097c9` |
| `--color-palette-lavender-gray-50` | color-primitives | default | `#F7F7FBFF` | `#f7f7fb` |
| `--color-palette-lavender-gray-600` | color-primitives | default | `#8A7CB6FF` | `#8a7cb6` |
| `--color-palette-lavender-gray-700` | color-primitives | default | `#72639CFF` | `#72639c` |
| `--color-palette-lavender-gray-800` | color-primitives | default | `#5C4F82FF` | `#5c4f82` |
| `--color-palette-lavender-gray-900` | color-primitives | default | `#483E65FF` | `#483e65` |
| `--color-palette-lavender-gray-950` | color-primitives | default | `#322C49FF` | `#322c49` |
| `--color-palette-mulberry-wood-100` | color-primitives | default | `#F9EAF5FF` | `#f9eaf5` |
| `--color-palette-mulberry-wood-200` | color-primitives | default | `#F5D5ECFF` | `#f5d5ec` |
| `--color-palette-mulberry-wood-300` | color-primitives | default | `#EEB3DBFF` | `#eeb3db` |
| `--color-palette-mulberry-wood-400` | color-primitives | default | `#E590C8FF` | `#e590c8` |
| `--color-palette-mulberry-wood-500` | color-primitives | default | `#D96EB2FF` | `#d96eb2` |
| `--color-palette-mulberry-wood-50` | color-primitives | default | `#FBF4F9FF` | `#fbf4f9` |
| `--color-palette-mulberry-wood-600` | color-primitives | default | `#CF4F9AFF` | `#cf4f9a` |
| `--color-palette-mulberry-wood-700` | color-primitives | default | `#B1357AFF` | `#b1357a` |
| `--color-palette-mulberry-wood-800` | color-primitives | default | `#952864FF` | `#952864` |
| `--color-palette-mulberry-wood-900` | color-primitives | default | `#73214FFF` | `#73214f` |
| `--color-palette-mulberry-wood-950` | color-primitives | default | `#561538FF` | `#561538` |
| `--color-palette-pear-100` | color-primitives | default | `#F0F7CAFF` | `#f0f7ca` |
| `--color-palette-pear-200` | color-primitives | default | `#E5F098FF` | `#e5f098` |
| `--color-palette-pear-300` | color-primitives | default | `#DAE75DFF` | `#dae75d` |
| `--color-palette-pear-400` | color-primitives | default | `#D6DF36FF` | `#d6df36` |
| `--color-palette-pear-500` | color-primitives | default | `#CDCF23FF` | `#cdcf23` |
| `--color-palette-pear-50` | color-primitives | default | `#F8FBEBFF` | `#f8fbeb` |
| `--color-palette-pear-600` | color-primitives | default | `#BDB81EFF` | `#bdb81e` |
| `--color-palette-pear-700` | color-primitives | default | `#A29B1AFF` | `#a29b1a` |
| `--color-palette-pear-800` | color-primitives | default | `#83771BFF` | `#83771b` |
| `--color-palette-pear-900` | color-primitives | default | `#5E5217FF` | `#5e5217` |
| `--color-palette-pear-950` | color-primitives | default | `#3B2D0DFF` | `#3b2d0d` |
| `--color-palette-shocking-100` | color-primitives | default | `#FCE7F2FF` | `#fce7f2` |
| `--color-palette-shocking-200` | color-primitives | default | `#FBCFE6FF` | `#fbcfe6` |
| `--color-palette-shocking-300` | color-primitives | default | `#F892C5FF` | `#f892c5` |
| `--color-palette-shocking-400` | color-primitives | default | `#F571B0FF` | `#f571b0` |
| `--color-palette-shocking-500` | color-primitives | default | `#ED4792FF` | `#ed4792` |
| `--color-palette-shocking-50` | color-primitives | default | `#FDF2F8FF` | `#fdf2f8` |
| `--color-palette-shocking-600` | color-primitives | default | `#DE3176FF` | `#de3176` |
| `--color-palette-shocking-700` | color-primitives | default | `#C21959FF` | `#c21959` |
| `--color-palette-shocking-800` | color-primitives | default | `#9D1646FF` | `#9d1646` |
| `--color-palette-shocking-900` | color-primitives | default | `#7A1539FF` | `#7a1539` |
| `--color-palette-shocking-950` | color-primitives | default | `#500721FF` | `#500721` |
| `--color-palette-tangerine-100` | color-primitives | default | `#FEF1D6FF` | `#fef1d6` |
| `--color-palette-tangerine-200` | color-primitives | default | `#FCDFACFF` | `#fcdfac` |
| `--color-palette-tangerine-300` | color-primitives | default | `#FAC677FF` | `#fac677` |
| `--color-palette-tangerine-400` | color-primitives | default | `#F7A340FF` | `#f7a340` |
| `--color-palette-tangerine-500` | color-primitives | default | `#F58C21FF` | `#f58c21` |
| `--color-palette-tangerine-50` | color-primitives | default | `#FFF9EDFF` | `#fff9ed` |
| `--color-palette-tangerine-600` | color-primitives | default | `#E66D10FF` | `#e66d10` |
| `--color-palette-tangerine-700` | color-primitives | default | `#CB5810FF` | `#cb5810` |
| `--color-palette-tangerine-800` | color-primitives | default | `#A54718FF` | `#a54718` |
| `--color-palette-tangerine-900` | color-primitives | default | `#79320CFF` | `#79320c` |
| `--color-palette-tangerine-950` | color-primitives | default | `#421B08FF` | `#421b08` |
| `--color-palette-twine-100` | color-primitives | default | `#F0E3D1FF` | `#f0e3d1` |
| `--color-palette-twine-200` | color-primitives | default | `#E3C7A5FF` | `#e3c7a5` |
| `--color-palette-twine-300` | color-primitives | default | `#CC985FFF` | `#cc985f` |
| `--color-palette-twine-400` | color-primitives | default | `#C4864BFF` | `#c4864b` |
| `--color-palette-twine-500` | color-primitives | default | `#B5723DFF` | `#b5723d` |
| `--color-palette-twine-50` | color-primitives | default | `#F9F4EDFF` | `#f9f4ed` |
| `--color-palette-twine-600` | color-primitives | default | `#A15C35FF` | `#a15c35` |
| `--color-palette-twine-700` | color-primitives | default | `#894934FF` | `#894934` |
| `--color-palette-twine-800` | color-primitives | default | `#6F3C2FFF` | `#6f3c2f` |
| `--color-palette-twine-900` | color-primitives | default | `#512B24FF` | `#512b24` |
| `--color-palette-twine-950` | color-primitives | default | `#341814FF` | `#341814` |
| `--content-action-secondary` | color | dark | `rgb(from var(--color-core-white) r g b / var(--opacity-700))` | `var(--background-material-inverse-thick)` |
| `--content-action-secondary` | color | light | `rgb(from var(--color-core-black) r g b / var(--opacity-600))` | `var(--background-material-inverse-thick)` |
| `--delay-0` | motion | Mode 1 | `[object Object]` | `var(--duration-0)` |
| `--delay-1000` | motion | Mode 1 | `[object Object]` | `var(--duration-1000)` |
| `--delay-100` | motion | Mode 1 | `[object Object]` | `var(--duration-100)` |
| `--delay-200` | motion | Mode 1 | `[object Object]` | `var(--duration-200)` |
| `--delay-300` | motion | Mode 1 | `[object Object]` | `var(--duration-300)` |
| `--delay-375` | motion | Mode 1 | `[object Object]` | `var(--duration-375)` |
| `--delay-400` | motion | Mode 1 | `[object Object]` | `var(--duration-400)` |
| `--delay-500` | motion | Mode 1 | `[object Object]` | `var(--duration-500)` |
| `--delay-50` | motion | Mode 1 | `[object Object]` | `var(--duration-50)` |
| `--delay-600` | motion | Mode 1 | `[object Object]` | `var(--duration-600)` |
| `--delay-700` | motion | Mode 1 | `[object Object]` | `var(--duration-700)` |
| `--delay-750` | motion | Mode 1 | `[object Object]` | `var(--duration-750)` |
| `--delay-800` | motion | Mode 1 | `[object Object]` | `var(--duration-800)` |
| `--delay-900` | motion | Mode 1 | `[object Object]` | `var(--duration-900)` |
| `--dimension-button-height` | action | 100 | `1.75rem` | `var(--dimension-900)` |
| `--dimension-button-height` | action | 200 | `2rem` | `var(--dimension-1000)` |
| `--dimension-button-height` | action | 300 | `2.75rem` | `var(--dimension-1150)` |
| `--dimension-button-height` | action | 400 | `6rem` | `var(--dimension-1700)` |
| `--dimension-button-icon-width` | action | 100 | `1.75rem` | `var(--dimension-900)` |
| `--dimension-button-icon-width` | action | 200 | `2rem` | `var(--dimension-1000)` |
| `--dimension-button-icon-width` | action | 300 | `2.75rem` | `var(--dimension-1150)` |
| `--dimension-button-icon-width` | action | 400 | `6rem` | `var(--dimension-1700)` |
| `--dimension-button-justified-height` | action | 100 | `1.75rem` | `var(--dimension-900)` |
| `--dimension-button-justified-height` | action | 200 | `2rem` | `var(--dimension-1000)` |
| `--dimension-button-justified-height` | action | 300 | `2.75rem` | `var(--dimension-1150)` |
| `--dimension-button-justified-height` | action | 400 | `6rem` | `var(--dimension-1700)` |
| `--duration-0` | motion | Mode 1 | `0` | `0ms` |
| `--duration-1000` | motion | Mode 1 | `1` | `1000ms` |
| `--duration-100` | motion | Mode 1 | `0.10000000149011612` | `100ms` |
| `--duration-1100` | motion | Mode 1 | `1.100000023841858` | `1100ms` |
| `--duration-1200` | motion | Mode 1 | `1.2000000476837158` | `1200ms` |
| `--duration-1300` | motion | Mode 1 | `1.2999999523162842` | `1300ms` |
| `--duration-1400` | motion | Mode 1 | `1.399999976158142` | `1400ms` |
| `--duration-1500` | motion | Mode 1 | `1.5` | `1500ms` |
| `--duration-1600` | motion | Mode 1 | `1.600000023841858` | `1600ms` |
| `--duration-1700` | motion | Mode 1 | `1.7000000476837158` | `1700ms` |
| `--duration-1800` | motion | Mode 1 | `1.7999999523162842` | `1800ms` |
| `--duration-1900` | motion | Mode 1 | `1.899999976158142` | `1900ms` |
| `--duration-2000` | motion | Mode 1 | `2` | `2000ms` |
| `--duration-200` | motion | Mode 1 | `0.20000000298023224` | `200ms` |
| `--duration-250` | motion | Mode 1 | `0.25` | `250ms` |
| `--duration-300` | motion | Mode 1 | `0.30000001192092896` | `300ms` |
| `--duration-375` | motion | Mode 1 | `0.375` | `375ms` |
| `--duration-400` | motion | Mode 1 | `0.4000000059604645` | `400ms` |
| `--duration-500` | motion | Mode 1 | `0.5` | `500ms` |
| `--duration-50` | motion | Mode 1 | `0.05000000074505806` | `50ms` |
| `--duration-600` | motion | Mode 1 | `0.6000000238418579` | `600ms` |
| `--duration-700` | motion | Mode 1 | `0.699999988079071` | `700ms` |
| `--duration-750` | motion | Mode 1 | `0.75` | `750ms` |
| `--duration-800` | motion | Mode 1 | `0.800000011920929` | `800ms` |
| `--duration-900` | motion | Mode 1 | `0.8999999761581421` | `900ms` |
| `--easing-circ-in-out` | motion | Mode 1 | `[object Object]` | `cubic-bezier(0.85, 0, 0.15, 1)` |
| `--easing-cubic-out` | motion | Mode 1 | `[object Object]` | `cubic-bezier(0.215, 0.61, 0.355, 1)` |
| `--easing-ease-out` | motion | Mode 1 | `[object Object]` | `cubic-bezier(0, 0, 0.2, 1)` |
| `--easing-expo-out` | motion | Mode 1 | `[object Object]` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--easing-linear` | motion | Mode 1 | `[object Object]` | `cubic-bezier(0, 0, 1, 1)` |
| `--easing-quad-out` | motion | Mode 1 | `[object Object]` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` |
| `--easing-quart-out` | motion | Mode 1 | `[object Object]` | `cubic-bezier(0.25, 1, 0.5, 1)` |
| `--family-font-sans` | text-primitives | value | `Suisse Intl` | `"Suisse Intl"` |
| `--grid-gap-lg` | layout | lg | `6rem` | `var(--dimension-1700)` |
| `--grid-gap-lg` | layout | lg-flush | `6rem` | `var(--dimension-1700)` |
| `--grid-gap-lg` | layout | lg-sidebar-main | `6rem` | `var(--dimension-1700)` |
| `--grid-gap-lg` | layout | lg-sidebar-main-flush | `6rem` | `var(--dimension-1700)` |
| `--grid-gap-lg` | layout | md | `4.5rem` | `var(--dimension-1500)` |
| `--grid-gap-lg` | layout | md-flush | `4.5rem` | `var(--dimension-1500)` |
| `--grid-gap-lg` | layout | sm | `4rem` | `var(--dimension-1400)` |
| `--grid-gap-lg` | layout | sm-flush | `4rem` | `var(--dimension-1400)` |
| `--grid-gap-lg` | layout | xl | `6rem` | `var(--dimension-1700)` |
| `--grid-gap-lg` | layout | xl-flush | `6rem` | `var(--dimension-1700)` |
| `--grid-gap-md` | layout | lg | `3.5rem` | `var(--dimension-1300)` |
| `--grid-gap-md` | layout | lg-flush | `3.5rem` | `var(--dimension-1300)` |
| `--grid-gap-md` | layout | lg-sidebar-main | `3.5rem` | `var(--dimension-1300)` |
| `--grid-gap-md` | layout | lg-sidebar-main-flush | `3.5rem` | `var(--dimension-1300)` |
| `--grid-gap-md` | layout | md | `2.5rem` | `var(--dimension-1100)` |
| `--grid-gap-md` | layout | md-flush | `2.5rem` | `var(--dimension-1100)` |
| `--grid-gap-md` | layout | sm | `2rem` | `var(--dimension-1000)` |
| `--grid-gap-md` | layout | sm-flush | `2rem` | `var(--dimension-1000)` |
| `--grid-gap-md` | layout | xl | `3.5rem` | `var(--dimension-1300)` |
| `--grid-gap-md` | layout | xl-flush | `3.5rem` | `var(--dimension-1300)` |
| `--grid-gap-sm` | layout | lg | `1.5rem` | `var(--dimension-800)` |
| `--grid-gap-sm` | layout | lg-flush | `1.5rem` | `var(--dimension-800)` |
| `--grid-gap-sm` | layout | lg-sidebar-main | `1.5rem` | `var(--dimension-800)` |
| `--grid-gap-sm` | layout | lg-sidebar-main-flush | `1.5rem` | `var(--dimension-800)` |
| `--grid-gap-sm` | layout | md | `1.25rem` | `var(--dimension-700)` |
| `--grid-gap-sm` | layout | md-flush | `1.25rem` | `var(--dimension-700)` |
| `--grid-gap-sm` | layout | sm | `1rem` | `var(--dimension-600)` |
| `--grid-gap-sm` | layout | sm-flush | `1rem` | `var(--dimension-600)` |
| `--grid-gap-sm` | layout | xl | `1.5rem` | `var(--dimension-800)` |
| `--grid-gap-sm` | layout | xl-flush | `1.5rem` | `var(--dimension-800)` |
| `--grid-gap` | layout | lg | `3rem` | `var(--dimension-1200)` |
| `--grid-gap` | layout | lg-flush | `3rem` | `var(--dimension-1200)` |
| `--grid-gap` | layout | lg-sidebar-main | `3rem` | `var(--dimension-1200)` |
| `--grid-gap` | layout | lg-sidebar-main-flush | `3rem` | `var(--dimension-1200)` |
| `--grid-gap` | layout | md | `2rem` | `var(--dimension-1000)` |
| `--grid-gap` | layout | md-flush | `2rem` | `var(--dimension-1000)` |
| `--grid-gap` | layout | sm | `1.5rem` | `var(--dimension-800)` |
| `--grid-gap` | layout | sm-flush | `1.5rem` | `var(--dimension-800)` |
| `--grid-gap` | layout | xl | `3rem` | `var(--dimension-1200)` |
| `--grid-gap` | layout | xl-flush | `3rem` | `var(--dimension-1200)` |
| `--grid-margin-default` | layout | lg | `3rem` | `var(--dimension-1200)` |
| `--grid-margin-default` | layout | lg-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-default` | layout | lg-sidebar-main | `3rem` | `var(--dimension-1200)` |
| `--grid-margin-default` | layout | lg-sidebar-main-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-default` | layout | md | `2rem` | `var(--dimension-1000)` |
| `--grid-margin-default` | layout | md-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-default` | layout | sm | `1.5rem` | `var(--dimension-800)` |
| `--grid-margin-default` | layout | sm-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-default` | layout | xl | `3rem` | `var(--dimension-1200)` |
| `--grid-margin-default` | layout | xl-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-offset` | layout | lg | `2.25rem` | `var(--dimension-1050)` |
| `--grid-margin-offset` | layout | lg-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-offset` | layout | lg-sidebar-main | `2.25rem` | `var(--dimension-1050)` |
| `--grid-margin-offset` | layout | lg-sidebar-main-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-offset` | layout | md | `1rem` | `var(--dimension-600)` |
| `--grid-margin-offset` | layout | md-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-offset` | layout | sm | `1rem` | `var(--dimension-600)` |
| `--grid-margin-offset` | layout | sm-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-offset` | layout | xl | `2.25rem` | `var(--dimension-1050)` |
| `--grid-margin-offset` | layout | xl-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-sm` | layout | lg | `2rem` | `var(--dimension-1000)` |
| `--grid-margin-sm` | layout | lg-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-sm` | layout | lg-sidebar-main | `2rem` | `var(--dimension-1000)` |
| `--grid-margin-sm` | layout | lg-sidebar-main-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-sm` | layout | md | `1rem` | `var(--dimension-600)` |
| `--grid-margin-sm` | layout | md-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-sm` | layout | sm | `1rem` | `var(--dimension-600)` |
| `--grid-margin-sm` | layout | sm-flush | `0rem` | `var(--dimension-0)` |
| `--grid-margin-sm` | layout | xl | `2rem` | `var(--dimension-1000)` |
| `--grid-margin-sm` | layout | xl-flush | `0rem` | `var(--dimension-0)` |
| `--grid-padding-default` | layout | lg | `3rem` | `var(--dimension-1200)` |
| `--grid-padding-default` | layout | lg-flush | `3rem` | `var(--dimension-1200)` |
| `--grid-padding-default` | layout | lg-sidebar-main | `3rem` | `var(--dimension-1200)` |
| `--grid-padding-default` | layout | lg-sidebar-main-flush | `3rem` | `var(--dimension-1200)` |
| `--grid-padding-default` | layout | md | `2rem` | `var(--dimension-1000)` |
| `--grid-padding-default` | layout | md-flush | `2rem` | `var(--dimension-1000)` |
| `--grid-padding-default` | layout | sm | `1.5rem` | `var(--dimension-800)` |
| `--grid-padding-default` | layout | sm-flush | `1.5rem` | `var(--dimension-800)` |
| `--grid-padding-default` | layout | xl | `3rem` | `var(--dimension-1200)` |
| `--grid-padding-default` | layout | xl-flush | `3rem` | `var(--dimension-1200)` |
| `--grid-padding-offset` | layout | lg | `2.25rem` | `var(--dimension-1050)` |
| `--grid-padding-offset` | layout | lg-flush | `2.25rem` | `var(--dimension-1050)` |
| `--grid-padding-offset` | layout | lg-sidebar-main | `2.25rem` | `var(--dimension-1050)` |
| `--grid-padding-offset` | layout | lg-sidebar-main-flush | `2.25rem` | `var(--dimension-1050)` |
| `--grid-padding-offset` | layout | md | `1rem` | `var(--dimension-600)` |
| `--grid-padding-offset` | layout | md-flush | `1rem` | `var(--dimension-600)` |
| `--grid-padding-offset` | layout | sm | `1rem` | `var(--dimension-600)` |
| `--grid-padding-offset` | layout | sm-flush | `1rem` | `var(--dimension-600)` |
| `--grid-padding-offset` | layout | xl | `2.25rem` | `var(--dimension-1050)` |
| `--grid-padding-offset` | layout | xl-flush | `2.25rem` | `var(--dimension-1050)` |
| `--grid-padding-sm` | layout | lg | `2rem` | `var(--dimension-1000)` |
| `--grid-padding-sm` | layout | lg-flush | `2rem` | `var(--dimension-1000)` |
| `--grid-padding-sm` | layout | lg-sidebar-main | `2rem` | `var(--dimension-1000)` |
| `--grid-padding-sm` | layout | lg-sidebar-main-flush | `2rem` | `var(--dimension-1000)` |
| `--grid-padding-sm` | layout | md | `1rem` | `var(--dimension-600)` |
| `--grid-padding-sm` | layout | md-flush | `1rem` | `var(--dimension-600)` |
| `--grid-padding-sm` | layout | sm | `1rem` | `var(--dimension-600)` |
| `--grid-padding-sm` | layout | sm-flush | `1rem` | `var(--dimension-600)` |
| `--grid-padding-sm` | layout | xl | `2rem` | `var(--dimension-1000)` |
| `--grid-padding-sm` | layout | xl-flush | `2rem` | `var(--dimension-1000)` |
| `--icon-dimension-height` | icon | 100 | `1rem` | `var(--dimension-600)` |
| `--icon-dimension-height` | icon | 200 | `1.25rem` | `var(--dimension-700)` |
| `--icon-dimension-height` | icon | 300 | `3rem` | `var(--dimension-1200)` |
| `--icon-dimension-height` | icon | 400 | `5rem` | `var(--dimension-1600)` |
| `--icon-dimension-width` | icon | 100 | `1rem` | `var(--dimension-600)` |
| `--icon-dimension-width` | icon | 200 | `1.25rem` | `var(--dimension-700)` |
| `--icon-dimension-width` | icon | 300 | `3rem` | `var(--dimension-1200)` |
| `--icon-dimension-width` | icon | 400 | `5rem` | `var(--dimension-1600)` |
| `--icon-radius-100` | icon | 100 | `0.0625rem` | `var(--radius-100)` |
| `--icon-radius-100` | icon | 200 | `0.125rem` | `var(--radius-200)` |
| `--icon-radius-100` | icon | 300 | `0.125rem` | `var(--radius-200)` |
| `--icon-radius-100` | icon | 400 | `0.125rem` | `var(--radius-200)` |
| `--icon-radius-200` | icon | 100 | `0.125rem` | `var(--radius-200)` |
| `--icon-radius-200` | icon | 200 | `0.125rem` | `var(--radius-200)` |
| `--icon-radius-200` | icon | 300 | `0.125rem` | `var(--radius-200)` |
| `--icon-radius-200` | icon | 400 | `0.25rem` | `var(--radius-400)` |
| `--icon-radius-300` | icon | 100 | `0.1875rem` | `var(--radius-300)` |
| `--icon-radius-300` | icon | 200 | `0.1875rem` | `var(--radius-300)` |
| `--icon-radius-300` | icon | 300 | `0.1875rem` | `var(--radius-300)` |
| `--icon-radius-300` | icon | 400 | `0.375rem` | `var(--radius-500)` |
| `--icon-radius-400` | icon | 100 | `0.25rem` | `var(--radius-400)` |
| `--icon-radius-400` | icon | 200 | `0.25rem` | `var(--radius-400)` |
| `--icon-radius-400` | icon | 300 | `0.25rem` | `var(--radius-400)` |
| `--icon-radius-400` | icon | 400 | `0.5rem` | `var(--radius-600)` |
| `--icon-weight-primary` | icon | 100 | `1.5px` | `var(--border-200)` |
| `--icon-weight-primary` | icon | 200 | `2px` | `var(--border-300-primary)` |
| `--icon-weight-primary` | icon | 300 | `4px` | `var(--border-700)` |
| `--icon-weight-primary` | icon | 400 | `6.5px` | `var(--border-1200)` |
| `--icon-weight-strikethrough` | icon | 100 | `3.5px` | `var(--border-600)` |
| `--icon-weight-strikethrough` | icon | 200 | `4px` | `var(--border-700)` |
| `--icon-weight-strikethrough` | icon | 300 | `5px` | `var(--border-900)` |
| `--icon-weight-strikethrough` | icon | 400 | `6px` | `var(--border-1100)` |
| `--letter-spacing-050` | text-primitives | value | `0` | `0px` |
| `--letter-spacing-1000` | text-primitives | value | `-1.75` | `-1.75px` |
| `--letter-spacing-100` | text-primitives | value | `0` | `0px` |
| `--letter-spacing-1100` | text-primitives | value | `-2.25` | `-2.25px` |
| `--letter-spacing-1200` | text-primitives | value | `-2.75` | `-2.75px` |
| `--letter-spacing-1300` | text-primitives | value | `-3.25` | `-3.25px` |
| `--letter-spacing-1400` | text-primitives | value | `-3.25` | `-3.25px` |
| `--letter-spacing-1500` | text-primitives | value | `-4.75` | `-4.75px` |
| `--letter-spacing-1600` | text-primitives | value | `-5.75` | `-5.75px` |
| `--letter-spacing-1700` | text-primitives | value | `-10.75` | `-10.75px` |
| `--letter-spacing-200` | text-primitives | value | `0` | `0px` |
| `--letter-spacing-300` | text-primitives | value | `-0.25` | `-0.25px` |
| `--letter-spacing-350` | text-primitives | value | `-0.25` | `-0.25px` |
| `--letter-spacing-400` | text-primitives | value | `-0.25` | `-0.25px` |
| `--letter-spacing-500` | text-primitives | value | `-0.25` | `-0.25px` |
| `--letter-spacing-600` | text-primitives | value | `-0.5` | `-0.5px` |
| `--letter-spacing-700` | text-primitives | value | `-0.75` | `-0.75px` |
| `--letter-spacing-800` | text-primitives | value | `-1` | `-1px` |
| `--letter-spacing-900` | text-primitives | value | `-1.25` | `-1.25px` |
| `--space-button-space-h-offset` | action | 100 | `0.75rem` | `var(--dimension-500)` |
| `--space-button-space-h-offset` | action | 200 | `1rem` | `var(--dimension-600)` |
| `--space-button-space-h-offset` | action | 300 | `1.5rem` | `var(--dimension-800)` |
| `--space-button-space-h-offset` | action | 400 | `1.75rem` | `var(--dimension-900)` |
| `--space-button-space-h` | action | 100 | `0.5rem` | `var(--dimension-400)` |
| `--space-button-space-h` | action | 200 | `0.75rem` | `var(--dimension-500)` |
| `--space-button-space-h` | action | 300 | `1.25rem` | `var(--dimension-700)` |
| `--space-button-space-h` | action | 400 | `1.5rem` | `var(--dimension-800)` |
| `--space-button-space-v` | action | 100 | `0.125rem` | `var(--dimension-200)` |
| `--space-button-space-v` | action | 200 | `0.3125rem` | `var(--dimension-350)` |
| `--space-button-space-v` | action | 300 | `0.5rem` | `var(--dimension-400)` |
| `--space-button-space-v` | action | 400 | `1rem` | `var(--dimension-600)` |
| `--space-spacer-0` | layout | lg | `0rem` | `var(--dimension-0)` |
| `--space-spacer-0` | layout | lg-flush | `0rem` | `var(--dimension-0)` |
| `--space-spacer-0` | layout | lg-sidebar-main | `0rem` | `var(--dimension-0)` |
| `--space-spacer-0` | layout | lg-sidebar-main-flush | `0rem` | `var(--dimension-0)` |
| `--space-spacer-0` | layout | md | `0rem` | `var(--dimension-0)` |
| `--space-spacer-0` | layout | md-flush | `0rem` | `var(--dimension-0)` |
| `--space-spacer-0` | layout | sm | `0rem` | `var(--dimension-0)` |
| `--space-spacer-0` | layout | sm-flush | `0rem` | `var(--dimension-0)` |
| `--space-spacer-0` | layout | xl | `0rem` | `var(--dimension-0)` |
| `--space-spacer-0` | layout | xl-flush | `0rem` | `var(--dimension-0)` |
| `--space-spacer-100` | layout | lg | `1.5rem` | `var(--dimension-800)` |
| `--space-spacer-100` | layout | lg-flush | `1.5rem` | `var(--dimension-800)` |
| `--space-spacer-100` | layout | lg-sidebar-main | `1.5rem` | `var(--dimension-800)` |
| `--space-spacer-100` | layout | lg-sidebar-main-flush | `1.5rem` | `var(--dimension-800)` |
| `--space-spacer-100` | layout | md | `1rem` | `var(--dimension-600)` |
| `--space-spacer-100` | layout | md-flush | `1rem` | `var(--dimension-600)` |
| `--space-spacer-100` | layout | sm | `0.75rem` | `var(--dimension-500)` |
| `--space-spacer-100` | layout | sm-flush | `0.75rem` | `var(--dimension-500)` |
| `--space-spacer-100` | layout | xl | `1.5rem` | `var(--dimension-800)` |
| `--space-spacer-100` | layout | xl-flush | `1.5rem` | `var(--dimension-800)` |
| `--space-spacer-200` | layout | lg | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-200` | layout | lg-flush | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-200` | layout | lg-sidebar-main | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-200` | layout | lg-sidebar-main-flush | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-200` | layout | md | `1.25rem` | `var(--dimension-700)` |
| `--space-spacer-200` | layout | md-flush | `1.5rem` | `var(--dimension-800)` |
| `--space-spacer-200` | layout | sm | `1rem` | `var(--dimension-600)` |
| `--space-spacer-200` | layout | sm-flush | `1rem` | `var(--dimension-600)` |
| `--space-spacer-200` | layout | xl | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-200` | layout | xl-flush | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-300` | layout | lg | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-300` | layout | lg-flush | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-300` | layout | lg-sidebar-main | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-300` | layout | lg-sidebar-main-flush | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-300` | layout | md | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-300` | layout | md-flush | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-300` | layout | sm | `1.5rem` | `var(--dimension-800)` |
| `--space-spacer-300` | layout | sm-flush | `1.5rem` | `var(--dimension-800)` |
| `--space-spacer-300` | layout | xl | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-300` | layout | xl-flush | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-400` | layout | lg | `4rem` | `var(--dimension-1400)` |
| `--space-spacer-400` | layout | lg-flush | `4rem` | `var(--dimension-1400)` |
| `--space-spacer-400` | layout | lg-sidebar-main | `4rem` | `var(--dimension-1400)` |
| `--space-spacer-400` | layout | lg-sidebar-main-flush | `4rem` | `var(--dimension-1400)` |
| `--space-spacer-400` | layout | md | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-400` | layout | md-flush | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-400` | layout | sm | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-400` | layout | sm-flush | `2rem` | `var(--dimension-1000)` |
| `--space-spacer-400` | layout | xl | `4rem` | `var(--dimension-1400)` |
| `--space-spacer-400` | layout | xl-flush | `4rem` | `var(--dimension-1400)` |
| `--space-spacer-500` | layout | lg | `6rem` | `var(--dimension-1700)` |
| `--space-spacer-500` | layout | lg-flush | `6rem` | `var(--dimension-1700)` |
| `--space-spacer-500` | layout | lg-sidebar-main | `6rem` | `var(--dimension-1700)` |
| `--space-spacer-500` | layout | lg-sidebar-main-flush | `6rem` | `var(--dimension-1700)` |
| `--space-spacer-500` | layout | md | `4rem` | `var(--dimension-1400)` |
| `--space-spacer-500` | layout | md-flush | `4rem` | `var(--dimension-1400)` |
| `--space-spacer-500` | layout | sm | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-500` | layout | sm-flush | `3rem` | `var(--dimension-1200)` |
| `--space-spacer-500` | layout | xl | `6rem` | `var(--dimension-1700)` |
| `--space-spacer-500` | layout | xl-flush | `6rem` | `var(--dimension-1700)` |
| `--space-spacer-600` | layout | lg | `10rem` | `var(--dimension-1900)` |
| `--space-spacer-600` | layout | lg-flush | `10rem` | `var(--dimension-1900)` |
| `--space-spacer-600` | layout | lg-sidebar-main | `10rem` | `var(--dimension-1900)` |
| `--space-spacer-600` | layout | lg-sidebar-main-flush | `10rem` | `var(--dimension-1900)` |
| `--space-spacer-600` | layout | md | `6rem` | `var(--dimension-1700)` |
| `--space-spacer-600` | layout | md-flush | `6rem` | `var(--dimension-1700)` |
| `--space-spacer-600` | layout | sm | `4.5rem` | `var(--dimension-1500)` |
| `--space-spacer-600` | layout | sm-flush | `4.5rem` | `var(--dimension-1500)` |
| `--space-spacer-600` | layout | xl | `10rem` | `var(--dimension-1900)` |
| `--space-spacer-600` | layout | xl-flush | `10rem` | `var(--dimension-1900)` |
| `--text-body-font-size-100` | layout | lg | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-100` | layout | lg-flush | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-100` | layout | lg-sidebar-main | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-100` | layout | lg-sidebar-main-flush | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-100` | layout | md | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-100` | layout | md-flush | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-100` | layout | sm | `0.75rem` | `var(--size-100)` |
| `--text-body-font-size-100` | layout | sm-flush | `0.75rem` | `var(--size-100)` |
| `--text-body-font-size-100` | layout | xl | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-100` | layout | xl-flush | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-200` | layout | lg | `1rem` | `var(--size-300)` |
| `--text-body-font-size-200` | layout | lg-flush | `1rem` | `var(--size-300)` |
| `--text-body-font-size-200` | layout | lg-sidebar-main | `1rem` | `var(--size-300)` |
| `--text-body-font-size-200` | layout | lg-sidebar-main-flush | `1rem` | `var(--size-300)` |
| `--text-body-font-size-200` | layout | md | `1rem` | `var(--size-300)` |
| `--text-body-font-size-200` | layout | md-flush | `1rem` | `var(--size-300)` |
| `--text-body-font-size-200` | layout | sm | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-200` | layout | sm-flush | `0.875rem` | `var(--size-200)` |
| `--text-body-font-size-200` | layout | xl | `1rem` | `var(--size-300)` |
| `--text-body-font-size-200` | layout | xl-flush | `1rem` | `var(--size-300)` |
| `--text-body-font-size-300` | layout | lg | `1.25rem` | `var(--size-400)` |
| `--text-body-font-size-300` | layout | lg-flush | `1.25rem` | `var(--size-400)` |
| `--text-body-font-size-300` | layout | lg-sidebar-main | `1.25rem` | `var(--size-400)` |
| `--text-body-font-size-300` | layout | lg-sidebar-main-flush | `1.25rem` | `var(--size-400)` |
| `--text-body-font-size-300` | layout | md | `1.25rem` | `var(--size-400)` |
| `--text-body-font-size-300` | layout | md-flush | `1.25rem` | `var(--size-400)` |
| `--text-body-font-size-300` | layout | sm | `1.125rem` | `var(--size-350)` |
| `--text-body-font-size-300` | layout | sm-flush | `1.125rem` | `var(--size-350)` |
| `--text-body-font-size-300` | layout | xl | `1.25rem` | `var(--size-400)` |
| `--text-body-font-size-300` | layout | xl-flush | `1.25rem` | `var(--size-400)` |
| `--text-body-font-size-400` | layout | lg | `1.75rem` | `var(--size-600)` |
| `--text-body-font-size-400` | layout | lg-flush | `1.75rem` | `var(--size-600)` |
| `--text-body-font-size-400` | layout | lg-sidebar-main | `1.75rem` | `var(--size-600)` |
| `--text-body-font-size-400` | layout | lg-sidebar-main-flush | `1.75rem` | `var(--size-600)` |
| `--text-body-font-size-400` | layout | md | `1.75rem` | `var(--size-600)` |
| `--text-body-font-size-400` | layout | md-flush | `1.75rem` | `var(--size-600)` |
| `--text-body-font-size-400` | layout | sm | `1.5rem` | `var(--size-500)` |
| `--text-body-font-size-400` | layout | sm-flush | `1.5rem` | `var(--size-500)` |
| `--text-body-font-size-400` | layout | xl | `1.75rem` | `var(--size-600)` |
| `--text-body-font-size-400` | layout | xl-flush | `1.75rem` | `var(--size-600)` |
| `--text-body-letter-spacing-100` | layout | lg | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-100` | layout | lg-flush | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-100` | layout | lg-sidebar-main | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-100` | layout | lg-sidebar-main-flush | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-100` | layout | md | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-100` | layout | md-flush | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-100` | layout | sm | `[object Object]` | `var(--letter-spacing-100)` |
| `--text-body-letter-spacing-100` | layout | sm-flush | `[object Object]` | `var(--letter-spacing-100)` |
| `--text-body-letter-spacing-100` | layout | xl | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-100` | layout | xl-flush | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-200` | layout | lg | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-body-letter-spacing-200` | layout | lg-flush | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-body-letter-spacing-200` | layout | lg-sidebar-main | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-body-letter-spacing-200` | layout | lg-sidebar-main-flush | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-body-letter-spacing-200` | layout | md | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-body-letter-spacing-200` | layout | md-flush | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-body-letter-spacing-200` | layout | sm | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-200` | layout | sm-flush | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-body-letter-spacing-200` | layout | xl | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-body-letter-spacing-200` | layout | xl-flush | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-body-letter-spacing-300` | layout | lg | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-body-letter-spacing-300` | layout | lg-flush | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-body-letter-spacing-300` | layout | lg-sidebar-main | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-body-letter-spacing-300` | layout | lg-sidebar-main-flush | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-body-letter-spacing-300` | layout | md | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-body-letter-spacing-300` | layout | md-flush | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-body-letter-spacing-300` | layout | sm | `[object Object]` | `var(--letter-spacing-350)` |
| `--text-body-letter-spacing-300` | layout | sm-flush | `[object Object]` | `var(--letter-spacing-350)` |
| `--text-body-letter-spacing-300` | layout | xl | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-body-letter-spacing-300` | layout | xl-flush | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-body-letter-spacing-400` | layout | lg | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-body-letter-spacing-400` | layout | lg-flush | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-body-letter-spacing-400` | layout | lg-sidebar-main | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-body-letter-spacing-400` | layout | lg-sidebar-main-flush | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-body-letter-spacing-400` | layout | md | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-body-letter-spacing-400` | layout | md-flush | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-body-letter-spacing-400` | layout | sm | `[object Object]` | `var(--letter-spacing-500)` |
| `--text-body-letter-spacing-400` | layout | sm-flush | `[object Object]` | `var(--letter-spacing-500)` |
| `--text-body-letter-spacing-400` | layout | xl | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-body-letter-spacing-400` | layout | xl-flush | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-title-font-size-100` | layout | lg | `1rem` | `var(--size-300)` |
| `--text-title-font-size-100` | layout | lg-flush | `1rem` | `var(--size-300)` |
| `--text-title-font-size-100` | layout | lg-sidebar-main | `1rem` | `var(--size-300)` |
| `--text-title-font-size-100` | layout | lg-sidebar-main-flush | `1rem` | `var(--size-300)` |
| `--text-title-font-size-100` | layout | md | `1rem` | `var(--size-300)` |
| `--text-title-font-size-100` | layout | md-flush | `1rem` | `var(--size-300)` |
| `--text-title-font-size-100` | layout | sm | `0.875rem` | `var(--size-200)` |
| `--text-title-font-size-100` | layout | sm-flush | `0.875rem` | `var(--size-200)` |
| `--text-title-font-size-100` | layout | xl | `1rem` | `var(--size-300)` |
| `--text-title-font-size-100` | layout | xl-flush | `1rem` | `var(--size-300)` |
| `--text-title-font-size-200` | layout | lg | `1.25rem` | `var(--size-400)` |
| `--text-title-font-size-200` | layout | lg-flush | `1.25rem` | `var(--size-400)` |
| `--text-title-font-size-200` | layout | lg-sidebar-main | `1.25rem` | `var(--size-400)` |
| `--text-title-font-size-200` | layout | lg-sidebar-main-flush | `1.25rem` | `var(--size-400)` |
| `--text-title-font-size-200` | layout | md | `1.25rem` | `var(--size-400)` |
| `--text-title-font-size-200` | layout | md-flush | `1.25rem` | `var(--size-400)` |
| `--text-title-font-size-200` | layout | sm | `1.125rem` | `var(--size-350)` |
| `--text-title-font-size-200` | layout | sm-flush | `1.125rem` | `var(--size-350)` |
| `--text-title-font-size-200` | layout | xl | `1.25rem` | `var(--size-400)` |
| `--text-title-font-size-200` | layout | xl-flush | `1.25rem` | `var(--size-400)` |
| `--text-title-font-size-300` | layout | lg | `2.5rem` | `var(--size-800)` |
| `--text-title-font-size-300` | layout | lg-flush | `2.5rem` | `var(--size-800)` |
| `--text-title-font-size-300` | layout | lg-sidebar-main | `2.5rem` | `var(--size-800)` |
| `--text-title-font-size-300` | layout | lg-sidebar-main-flush | `2.5rem` | `var(--size-800)` |
| `--text-title-font-size-300` | layout | md | `2.5rem` | `var(--size-800)` |
| `--text-title-font-size-300` | layout | md-flush | `1.75rem` | `var(--size-600)` |
| `--text-title-font-size-300` | layout | sm | `1.75rem` | `var(--size-600)` |
| `--text-title-font-size-300` | layout | sm-flush | `1.75rem` | `var(--size-600)` |
| `--text-title-font-size-300` | layout | xl | `2.5rem` | `var(--size-800)` |
| `--text-title-font-size-300` | layout | xl-flush | `1.75rem` | `var(--size-600)` |
| `--text-title-font-size-400` | layout | lg | `5rem` | `var(--size-1200)` |
| `--text-title-font-size-400` | layout | lg-flush | `5rem` | `var(--size-1200)` |
| `--text-title-font-size-400` | layout | lg-sidebar-main | `5rem` | `var(--size-1200)` |
| `--text-title-font-size-400` | layout | lg-sidebar-main-flush | `5rem` | `var(--size-1200)` |
| `--text-title-font-size-400` | layout | md | `5rem` | `var(--size-1200)` |
| `--text-title-font-size-400` | layout | md-flush | `5rem` | `var(--size-1200)` |
| `--text-title-font-size-400` | layout | sm | `3.5rem` | `var(--size-1000)` |
| `--text-title-font-size-400` | layout | sm-flush | `3.5rem` | `var(--size-1000)` |
| `--text-title-font-size-400` | layout | xl | `5rem` | `var(--size-1200)` |
| `--text-title-font-size-400` | layout | xl-flush | `5rem` | `var(--size-1200)` |
| `--text-title-letter-spacing-100` | layout | lg | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-title-letter-spacing-100` | layout | lg-flush | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-title-letter-spacing-100` | layout | lg-sidebar-main | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-title-letter-spacing-100` | layout | lg-sidebar-main-flush | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-title-letter-spacing-100` | layout | md | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-title-letter-spacing-100` | layout | md-flush | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-title-letter-spacing-100` | layout | sm | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-title-letter-spacing-100` | layout | sm-flush | `[object Object]` | `var(--letter-spacing-200)` |
| `--text-title-letter-spacing-100` | layout | xl | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-title-letter-spacing-100` | layout | xl-flush | `[object Object]` | `var(--letter-spacing-300)` |
| `--text-title-letter-spacing-200` | layout | lg | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-title-letter-spacing-200` | layout | lg-flush | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-title-letter-spacing-200` | layout | lg-sidebar-main | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-title-letter-spacing-200` | layout | lg-sidebar-main-flush | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-title-letter-spacing-200` | layout | md | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-title-letter-spacing-200` | layout | md-flush | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-title-letter-spacing-200` | layout | sm | `[object Object]` | `var(--letter-spacing-350)` |
| `--text-title-letter-spacing-200` | layout | sm-flush | `[object Object]` | `var(--letter-spacing-350)` |
| `--text-title-letter-spacing-200` | layout | xl | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-title-letter-spacing-200` | layout | xl-flush | `[object Object]` | `var(--letter-spacing-400)` |
| `--text-title-letter-spacing-300` | layout | lg | `[object Object]` | `var(--letter-spacing-800)` |
| `--text-title-letter-spacing-300` | layout | lg-flush | `[object Object]` | `var(--letter-spacing-800)` |
| `--text-title-letter-spacing-300` | layout | lg-sidebar-main | `[object Object]` | `var(--letter-spacing-800)` |
| `--text-title-letter-spacing-300` | layout | lg-sidebar-main-flush | `[object Object]` | `var(--letter-spacing-800)` |
| `--text-title-letter-spacing-300` | layout | md | `[object Object]` | `var(--letter-spacing-800)` |
| `--text-title-letter-spacing-300` | layout | md-flush | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-title-letter-spacing-300` | layout | sm | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-title-letter-spacing-300` | layout | sm-flush | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-title-letter-spacing-300` | layout | xl | `[object Object]` | `var(--letter-spacing-800)` |
| `--text-title-letter-spacing-300` | layout | xl-flush | `[object Object]` | `var(--letter-spacing-600)` |
| `--text-title-letter-spacing-400` | layout | lg | `[object Object]` | `var(--letter-spacing-1200)` |
| `--text-title-letter-spacing-400` | layout | lg-flush | `[object Object]` | `var(--letter-spacing-1200)` |
| `--text-title-letter-spacing-400` | layout | lg-sidebar-main | `[object Object]` | `var(--letter-spacing-1200)` |
| `--text-title-letter-spacing-400` | layout | lg-sidebar-main-flush | `[object Object]` | `var(--letter-spacing-1200)` |
| `--text-title-letter-spacing-400` | layout | md | `[object Object]` | `var(--letter-spacing-1200)` |
| `--text-title-letter-spacing-400` | layout | md-flush | `[object Object]` | `var(--letter-spacing-1200)` |
| `--text-title-letter-spacing-400` | layout | sm | `[object Object]` | `var(--letter-spacing-1000)` |
| `--text-title-letter-spacing-400` | layout | sm-flush | `[object Object]` | `var(--letter-spacing-1000)` |
| `--text-title-letter-spacing-400` | layout | xl | `[object Object]` | `var(--letter-spacing-1200)` |
| `--text-title-letter-spacing-400` | layout | xl-flush | `[object Object]` | `var(--letter-spacing-1200)` |

## Appendix A — zero-usage tokens (85)

Generated anyway, per the operator ruling of 2026-09-05 (all collections,
superseding the 2026-07-26 used-only rule).

- `--aspect-landscape` (core)
- `--aspect-portrait` (core)
- `--aspect-square` (core)
- `--aspect-tall` (core)
- `--blur-0` (effect)
- `--delay-0` (motion)
- `--delay-100` (motion)
- `--delay-1000` (motion)
- `--delay-200` (motion)
- `--delay-300` (motion)
- `--delay-375` (motion)
- `--delay-400` (motion)
- `--delay-50` (motion)
- `--delay-500` (motion)
- `--delay-600` (motion)
- `--delay-700` (motion)
- `--delay-750` (motion)
- `--delay-800` (motion)
- `--delay-900` (motion)
- `--device-screen-height-600` (layout)
- `--dimension-1050` (core)
- `--dimension-1150` (core)
- `--duration-0` (motion)
- `--duration-100` (motion)
- `--duration-1000` (motion)
- `--duration-1100` (motion)
- `--duration-1200` (motion)
- `--duration-1300` (motion)
- `--duration-1400` (motion)
- `--duration-1500` (motion)
- `--duration-1600` (motion)
- `--duration-1700` (motion)
- `--duration-1800` (motion)
- `--duration-1900` (motion)
- `--duration-200` (motion)
- `--duration-2000` (motion)
- `--duration-250` (motion)
- `--duration-300` (motion)
- `--duration-375` (motion)
- `--duration-400` (motion)
- `--duration-50` (motion)
- `--duration-500` (motion)
- `--duration-600` (motion)
- `--duration-700` (motion)
- `--duration-750` (motion)
- `--duration-800` (motion)
- `--duration-900` (motion)
- `--easing-circ-in-out` (motion)
- `--easing-cubic-out` (motion)
- `--easing-ease-out` (motion)
- `--easing-expo-out` (motion)
- `--easing-linear` (motion)
- `--easing-quad-out` (motion)
- `--easing-quart-out` (motion)
- `--grid-columns` (layout)
- `--grid-gap-md` (layout)
- `--grid-margin-sm` (layout)
- `--icon-radius-100` (icon)
- `--icon-radius-200` (icon)
- `--icon-radius-300` (icon)
- `--icon-radius-400` (icon)
- `--letter-spacing-350` (text-primitives)
- `--opacity-10` (core)
- `--opacity-150` (core)
- `--opacity-20` (core)
- `--opacity-250` (core)
- `--opacity-30` (core)
- `--opacity-40` (core)
- `--opacity-50` (core)
- `--opacity-60` (core)
- `--opacity-70` (core)
- `--opacity-80` (core)
- `--opacity-90` (core)
- `--opacity-950` (core)
- `--radius-100` (core)
- `--radius-200` (core)
- `--radius-300` (core)
- `--radius-action-radius-elipse` (core)
- `--radius-action-radius-sharp` (core)
- `--size-350` (text-primitives)
- `--space-spacer-0` (layout)
- `--text-title-letter-spacing-100` (layout)
- `--text-title-letter-spacing-200` (layout)
- `--text-title-letter-spacing-300` (layout)
- `--text-title-letter-spacing-400` (layout)

## Appendix C — codeNameChanged (0)

Schema 6's `changes.variables.codeNameChanged` — variables whose emitted WEB
name changed since the export's diff baseline, its own class distinct from
renamed/valueChanged/aliasRetargeted (a name change is a breaking change for
every consumer that binds to it by string; a value or alias change is not).
Reported as its own class, not merged into MATCH/VALUE-DRIFT/NAME-ONLY-IN-EXPORT.

None.

## Appendix B — styles (not generated this slice)

Typography/paint classes are out of scope for this slice; this is the summary
the export publishes, so the follow-up knows what it is taking on.

| Type | Styles | Groups |
| --- | --- | --- |
| PAINT | 0 | — |
| TEXT | 52 | title-style1, title-action-style1, body-style1, body-action-style1, .text-primitives |
| EFFECT | 15 | border, effect |
| GRID | 7 | Ungrouped |

## Open questions for the operator

1. **Layout modes — CLOSED by schema 5, base fixed by P6 (schema 6).**
   `breakpoints.entries` publishes resolvable widths + `layoutVariant` per
   mode, so the generator emits real media queries (§7) instead of the
   `[data-jhd-layout-mode="…"]` placeholder. P6 (2026-09-05) additionally moves
   the unconditional base from the collection's default mode (`lg`) to the
   smallest-width `default`-variant mode (`sm`) — see §7. Nothing left to
   decide unless the widths themselves are wrong.
2. **Unresolved units — CLOSED by schema 5; typography residue CLOSED by
   schema 17.** Every FLOAT mode carries a `build` cell (`units.policy` v4), so
   `core/border/*` emits `px`, opacity emits a fraction, effect blur emits
   `px`, and grid columns emit unitless — verbatim from the export, no
   generator-side scope heuristic. The residue was §6 UNCONVERTED: the
   `divide-by-associated-font-size` tokens (letter-spacing, line-height) that
   needed a font size the export did not carry for a standalone variable. RULING
   (2026-09-13, `units.policy` v6 / schema 17): the PLUGIN resolves them, at the
   variable level, per mode — the divisor comes from a sibling variable
   (same-step `size/<n>` for primitives, `text/<fam>/font-size-<step>` for
   layout collections) and is never invented. The generator emits the resulting
   `build.css` verbatim (`0em`, `-0.01em`, `1.15`), never raw px. An
   association the plugin still cannot resolve stays `status: "unresolved"` and
   keeps P13's behaviour: raw source value emitted, listed as §6 UNCONVERTED
   (19 on this run).
3. **Colour name prefix — CLOSED by schema 5.** `policies.naming` v3 drops the
   `color-` prefix, so the export's WEB names now match the hand-authored ones
   exactly (`--background-default-primary`). 0 colour tokens
   therefore flip from NAME-ONLY-IN-EXPORT (emitted, prefixed) to hand-authored
   collisions that are skipped under P2 — no computed value changes; the tidy
   follow-up simply has one naming question fewer.
4. **Easing drift.** `--easing-power2-out` is
   `cubic-bezier(0.215, 0.61, 0.355, 1)` in Figma vs
   `cubic-bezier(0.22, 0.61, 0.35, 1)` in `styles.css`. Adopt Figma's, or
   correct Figma?
