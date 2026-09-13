# ds-from-handoff — reconciliation report

GENERATED FILE — regenerate with `pnpm run tokens`.

| | |
| --- | --- |
| Export | `JHD-Spec-DesignSystem` |
| Schema | design-system-handoff v9 |
| Exported at | 2026-09-12T07:11:41.254Z |
| designSystemStateHash | `26351f7a09758f626996439752be73090a54f3ec5e5fa371edd44b716e07defc` |
| Tokens in export | 502 |
| MATCH (hand-authored, same value) | 5 |
| VALUE-DRIFT (hand-authored, different value) | 15 |
| NAME-ONLY-IN-EXPORT (newly generated) | 482 |
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

## 2. VALUE-DRIFT (15)

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
| `--duration-1600` | motion | `1600ms` | `1.6s` |
| `--grid-gap` | layout | `var(--dimension-1200)` | `clamp(1.5rem, calc(2.0356vw + 1.0231rem), 2rem)` |
| `--grid-gap-lg` | layout | `var(--dimension-1700)` | `clamp(4rem, calc(2.0356vw + 3.523rem), 4.5rem)` |
| `--radius-full` | core | `62.4375rem` | `999px` |

## 3. MATCH (5)

| Token | Collection | Value |
| --- | --- | --- |
| `--aspect-landscape` | core | `3 / 2` |
| `--aspect-portrait` | core | `4 / 5` |
| `--aspect-square` | core | `1 / 1` |
| `--aspect-tall` | core | `2 / 3` |
| `--easing-linear` | motion | `cubic-bezier(0, 0, 1, 1)` |

## 4. NAME-ONLY-IN-HAND

Every `--*` declared in `src/styles.css` whose name is not a WEB name in the
export. These are composition-layer or product-layer properties (type-role
sizes, z-index, elevation, Tailwind `@theme` namespace aliases) with no Figma
variable behind them, plus the colour tokens styles.css names without the
export's `color-` prefix. Listed for the tidy follow-up, not changed here.

148 names.

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
- `--border-300`
- `--brand`
- `--button-border-100`
- `--button-border-200`
- `--button-border-300`
- `--button-border-400`
- `--button-height-100`
- `--button-height-200`
- `--button-height-300`
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
- `--duration-250`
- `--easing-expo-out-card`
- `--easing-quad-out-gill`
- `--easing-quart-out-flight`
- `--font-heading`
- `--font-sans`
- `--grid-margin`
- `--grid-padding`
- `--icon-dimension-100`
- `--icon-dimension-200`
- `--paragraph-spacing`
- `--radius`
- `--shadow-modal`
- `--shadow-overlay`
- `--shadow-raised`
- `--space-100`
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
- `--text-350`
- `--text-350--letter-spacing`
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

197 generated `@theme` keys across 8 namespaces.
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

Honoured this run: `viewport-height`, `viewport-width`.

82 of 508 emitted variables carry a class — fixed (export): 6 · fixed (rule): 1 · fluid-clamp (export): 14 · mode-stepped (export): 52 · viewport-height (description): 8 · viewport-width (description): 1.
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
| `--grid-col-start-1` | layout | fixed | export | per-mode |
| `--grid-col-start-2` | layout | fluid-clamp | export | per-mode |
| `--grid-columns` | layout | fixed | export | per-mode |
| `--icon-radius-100` | icon | fluid-clamp | export | per-mode |
| `--icon-radius-200` | icon | fluid-clamp | export | per-mode |
| `--icon-radius-300` | icon | fluid-clamp | export | per-mode |
| `--space-button-space-h` | action | fluid-clamp | export | per-mode |
| `--space-button-space-h-offset` | action | fluid-clamp | export | per-mode |
| `--space-spacer-0` | layout | fixed | export | per-mode |
| `--text-body-font-size-100` | layout | fluid-clamp | export | per-mode |
| `--text-body-font-size-200` | layout | fluid-clamp | export | per-mode |
| `--text-body-font-size-300` | layout | fluid-clamp | export | per-mode |
| `--text-body-letter-spacing-100` | layout | fixed | export | per-mode |
| `--text-body-letter-spacing-300` | layout | fixed | export | per-mode |
| `--text-body-paragraph-spacing-100` | layout | fluid-clamp | export | per-mode |
| `--text-body-paragraph-spacing-200` | layout | fluid-clamp | export | per-mode |
| `--text-body-paragraph-spacing-300` | layout | fluid-clamp | export | per-mode |
| `--text-title-font-size-100` | layout | fluid-clamp | export | per-mode |
| `--text-title-font-size-200` | layout | fluid-clamp | export | per-mode |
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

**Warnings (13)** — what the generator would not guess at. A
variable in a `viewport.groups` group with no stated fraction keeps its px
samples: the fix is one description in Figma, not a heuristic here.

| Code | Token | Detail |
| --- | --- | --- |
| `DELAY_NOT_ALIASED` | `--delay-0` | holds the same value as `--duration-0` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-0` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-100` | holds the same value as `--duration-100` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-100` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-1000` | holds the same value as `--duration-1000` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-1000` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-200` | holds the same value as `--duration-200` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-200` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-300` | holds the same value as `--duration-300` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-300` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-375` | holds the same value as `--duration-375` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-375` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-400` | holds the same value as `--duration-400` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-400` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-500` | holds the same value as `--duration-500` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-500` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-600` | holds the same value as `--duration-600` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-600` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-700` | holds the same value as `--duration-700` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-700` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-750` | holds the same value as `--duration-750` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-750` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-800` | holds the same value as `--duration-800` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-800` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |
| `DELAY_NOT_ALIASED` | `--delay-900` | holds the same value as `--duration-900` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at `--duration-900` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself. |

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

## Appendix A — zero-usage tokens (82)

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
- `--duration-300` (motion)
- `--duration-375` (motion)
- `--duration-400` (motion)
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
