// ---------------------------------------------------------------------------
// handoff-css — generate production-ready CSS custom properties, a Tailwind v4
// `@theme` bridge and a reconciliation report from a Design Handoff export
// (schema `design-system-handoff`).
//
// Library entry:  generate(handoffJson, config, { handAuthoredCss })
// CLI:            handoff-css [--config <mjs>] [--input <json>] [--out <css>]
//                             [--theme <css>] [--report <md>]
//                             [--exclusions <json>] [--check]
//
// `--check` writes nothing and exits 1 if a committed output would change.
//
// ---------------------------------------------------------------------------
// POLICIES THIS GENERATOR APPLIES
//
// Everything the export publishes is read from the export. The decisions below
// are NOT published by the export and are stated here so the output is
// auditable rather than magic. Open questions are repeated in the report.
//
// Schema 6 moves two more of these from "generator guesses" to "export
// states": every FLOAT mode now carries a final `build` cell (P4) instead of a
// `unitHint` the generator had to interpret, and layout breakpoints publish as
// a first-class `breakpoints.entries` array (P3) instead of a `device/width`
// variable the generator had to go find. The generator consumes both
// generically — it must never re-introduce a scope heuristic or an
// export-scan the export has taken responsibility for.
//
// Schema 7 moves a THIRD: every COMPOSE_COLOR mode now also carries a final
// `build` cell (`build.status: "resolved"`, `build.css` a relative-colour-
// syntax string, `build.literal` an 8-digit hex fallback) instead of the
// generator having to interpret the raw `VARIABLE_EXPRESSION` itself. P4's
// contract — `build.status === "resolved"` -> emit `build.css` verbatim —
// therefore now covers COMPOSE_COLOR too; P9 no longer derives a `color-mix()`
// of its own and exists solely to validate the shape and hard-fail on an
// unresolved compose cell (`build.status !== "resolved"`), never to compute a
// value the export has already stated.
//
// P1. NAMES — `codeSyntax.WEB.value`, verbatim. Never re-derived. A variable
//     without one is a hard failure (the export's naming.policy guarantees one
//     for every variable, so its absence means the export is malformed).
//
// P2. HAND-AUTHORED WINS (GLOBAL SCOPE ONLY) — a custom property already
//     declared GLOBALLY in src/styles.css is NOT emitted here. Rationale is cascade-mechanical, not
//     stylistic: styles.css declares its scales inside `@theme inline`, which
//     Tailwind emits into `@layer theme`. An unlayered `:root` from this file
//     would beat the theme layer, so emitting a colliding name would silently
//     invert authorship (and, for colour, detach `.dark` from the token the
//     utility resolves). Skipping is the only ordering-independent way to keep
//     "hand-authored wins" true. Every skipped name is reported as MATCH or
//     VALUE-DRIFT.
//     STATE (after the 2026-09-05 tidy slice): MATCH is now 0 — every token
//     whose hand-authored value already equalled the export has had its
//     duplicate deleted from styles.css and now emits from here. The skip set
//     is therefore exactly the 25 remaining VALUE-DRIFT names, each a real
//     disagreement awaiting its own ruling rather than a duplicate:
//       - 10 colour tokens, where styles.css holds a literal (#000000,
//         rgb(0 0 0 / 5%)) and the export holds a semantic alias
//         (var(--color-core-black), var(--background-material-inverse-*)).
//       - 11 core/border steps, where styles.css is in rem and the export is
//         in px. Numerically equal at a 16px root; not byte-equal.
//       - --radius-full (999px vs the export's 62.4375rem) and --easing-linear
//         (a bezier vs the keyword `linear`) — equivalent, not identical.
//       - --grid-gap / --grid-gap-lg, which the operator ruled OUT of scope on
//         2026-09-05: they stay hand-authored fluid clamps, and their
//         VALUE-DRIFT rows are expected output, not a defect to close.
//     A NEW MATCH row now means a duplicate has crept back into styles.css —
//     test/ds-from-handoff.test.mjs asserts MATCH stays empty for that reason.
//     SCOPE: "globally" means a top-level `:root`/`html` or a `@theme` block.
//     A declaration inside `.dark`, `@media`, `@supports` or `@utility` only
//     applies when its condition holds, so it cannot supersede the token
//     everywhere — treating it as a suppressor would leave the token undefined
//     outside that condition. Those names are reported in the report's §8.
//
// P3. MODES — the export publishes `breakpoints.entries`, one row per layout
//     mode: `widthPx`, `layoutVariant`, `isTheme`. layout's sm/md/lg/xl (+
//     flush / sidebar-main) are responsive layout variants, never themes. So:
//       - single-mode collection            -> `:root`
//       - `color`  default mode (light)     -> `:root`
//       - `color`  non-default mode (dark)  -> `.dark`   (the package already
//         ships `@custom-variant dark (&:is(.dark *))` and a hand-authored
//         `.dark` block; this is the house selector, not a new invention)
//       - `layout`, every mode -> `@media (min-width: <widthPx>)`, emitted
//         mobile-first in ascending width order. The second axis is a
//         selector, not a width: `layoutVariant === "default"` lands on
//         `:root`, any other variant on
//         `[data-jhd-layout-variant="<variant>"]`.
//       - P6 (2026-09-05, supersedes the schema-5 rule below): the
//         UNCONDITIONAL base seeds from the SMALLEST-width `default`-variant
//         mode (`sm`), not the collection's `defaultModeId` (`lg`). Wider
//         modes — including `lg` itself — arrive only via their own ascending
//         `@media (min-width)` block. Superseded rule: the collection's
//         default mode (`lg`) used to also seed the base, so every layout
//         token below `lg`'s width fell back to `lg`'s value; that inverted
//         mobile-first and is the bug P6 fixes.
//         If `breakpoints.entries` does not resolve a width for every layout
//         mode, the generator falls back to the `[data-jhd-layout-mode="…"]`
//         placeholder rather than guessing breakpoints.
//       - any other multi-mode collection (`icon`, `action`): default mode ->
//         `:root`, every other mode -> `[data-jhd-<collection>-mode="<name>"]`
//         (the export publishes no width or theme semantics for these).
//
// P4. UNITS — driven ENTIRELY by the per-mode `build` cell the export
//     publishes (`units.policy` v4). The generator applies NO scope heuristics
//     of its own:
//       - `build.status === "resolved"` -> emit `build.css` verbatim. A
//         `build.raw` that disagrees with the mode's own `raw` is a hard
//         failure, never a silent pick of one side. Where `unitHint.sourceUnit`
//         is px and `build.unit` is not, the source px value goes in a
//         trailing comment.
//         So `divide-by-100` -> `--opacity-500: 0.5`, `identity`+px ->
//         `--blur-100: 12px`, `divide-by-root-font-size` -> `3rem /* 48px */`.
//         Effect blur radii and integral grid column counts are unaffected by
//         scope heuristics either way — the export's own `build.unit` (px /
//         unitless) is taken verbatim like every other FLOAT.
//       - `build.status === "unresolved"` (in practice
//         `divide-by-associated-font-size`, which needs a font size the
//         export does not carry for a standalone variable) -> emit the raw
//         source value with an `UNCONVERTED:` comment and list it in the
//         report's §6. The divisor is never invented.
//     Non-FLOAT types are still rendered by type, since unit does not apply:
//       TIMING -> seconds (`0.375s`); EASING -> `cubic-bezier(…)`, LINEAR ->
//       `linear`; COLOR -> `#rrggbb` at full alpha else `rgb(r g b / P%)`
//       (the package's existing convention in styles.css); STRING -> quoted.
//
// P5. ALIASES — `var(--<next hop's WEB name>)` from `alias.chain[0]`, so the
//     semantic -> primitive relationship survives into CSS. `terminalValue`
//     goes in a trailing comment. If the next hop is not present in the export
//     (a remote library variable), the terminal value is emitted instead and
//     the token is listed under UNRESOLVED ALIASES in the report.
//
// P6. See P3 above — recorded here too since it is a standalone parent
//     decision (2026-09-05), not just a mechanical consequence of schema 6.
//
// P7. PRIVATE / HIDDEN / EXCLUDED — Figma-only scaffolding never becomes a
//     PUBLIC design-system token. But hidden-in-Figma does NOT mean
//     absent-from-CSS, and conflating the two ships broken CSS.
//
//     Operator ruling 2026-09-06: "i think for code, we need a slightly
//     different interpretation of no published because this in reality how it
//     works in figma. i don't publish the color primitives because only
//     semantic colors should be used in layout but the primitive color are
//     alias's in semantic colors" · ".utility ignore all together".
//
//     In Figma, "don't publish" means "don't offer this in the picker" — it is
//     a CONSUMPTION rule for designers, not a statement that the value is
//     unused. The primitives stay very much alive as the alias targets behind
//     the semantic tokens. CSS custom properties have no such distinction: a
//     name is either declared or it is not. `--background-default-primary:
//     var(--color-palette-cruise-500)` with no `--color-palette-cruise-500`
//     declaration is INVALID AT COMPUTED-VALUE TIME — the semantic token
//     resolves to nothing and the element renders unstyled. So the emit set is
//     the alias closure, not the published set:
//
//       emit = published ∪ { reachable by alias from an emitted variable }
//
//     Three classes, reported separately:
//       - PRIVATE: hidden, but reachable by alias from an emitted variable
//         (walk `alias.chain[0]` transitively, across every effective mode —
//         light and dark can alias different primitives). EMITTED, under the
//         SAME name, because the aliases have to resolve. Fenced in a clearly
//         marked block so the file states the intent Figma's publish flag was
//         carrying: these exist to be aliased, not to be used directly.
//         PRIVATE is never a public row — never MATCH/VALUE-DRIFT/
//         NAME-ONLY-IN-EXPORT, and never MISSING or EXTRA downstream.
//       - HIDDEN: hidden AND unreachable. Nothing refers to it, so dropping it
//         breaks nothing. Never emitted. This is the export's own signal and
//         the durable fix — once Figma marks a variable hidden, it lands here
//         with no generator change needed.
//       - EXCLUDED: the variable's `"<collection.name>/<v.name>"` path starts
//         with an entry in `EXCLUDE_PATHS` below. A POLICY list, applied
//         WHOLESALE on path identity regardless of hidden state, and NEVER
//         revived by reachability — if product code must not consume it, an
//         alias to it is a design-file bug we want to surface, not paper over.
//         Today: `.utility/*` ("ignore all together", 2026-09-06) and the
//         `layout/grid/aspect/{landscape,portrait,tall}/*` aspect-ratio
//         authoring hacks (the file needs a variable to drive an aspect-ratio
//         constraint), never consumed by product code, per the same ruling
//         (`projects/portfolio/audits/2026-09-04-dimension-token-parity.md`).
//         The aspect entry is INTERIM — remove it the moment those variables
//         are marked `hiddenFromPublishing` in Figma. `.utility` is durable.
//     PRIVATE/HIDDEN/EXCLUDED are all excluded from `rows` (so MATCH/VALUE-DRIFT/NAME-ONLY-
//     IN-EXPORT never reflect them) and from CSS emission, and are reported
//     as their own named classes. Only PRIVATE is emitted.
//
// P8. TAILWIND NAMESPACES (2026-09-06, operator ruling
//     `fleet/rulings/tailwind-for-everything-house-names.md`) — a SECOND
//     output, `src/theme.generated.css`, holding ONE `@theme` block so that
//     Tailwind's generated utilities speak house vocabulary
//     (`bg-background-default-primary`, `rounded-300`, `lg:` = Figma 1280)
//     and Tailwind's own default scale is gone. `tokens.generated.css` stays
//     Figma-fidelity-only and never gains a Tailwind bridge; the bridge is
//     this file, and it is generated rather than hand-authored.
//
//     P8.1 SUFFIX RULE. The `@theme` key is `--<namespace>-<leaf>`. The leaf
//     is the token's WEB name minus its leading `--`, minus its leading group
//     segment WHEN that group is the namespace (or a documented alias of it).
//     So:
//       --radius-300            -> --radius-300      (not --radius-radius-300)
//       --radius-action-radius-elipse -> --radius-action-radius-elipse
//       --easing-power2-out     -> --ease-power2-out (alias easing -> ease)
//       --letter-spacing-100    -> --tracking-100    (alias letter-spacing -> tracking)
//       --background-default-primary -> --color-background-default-primary
//     Groups are never re-derived from Figma paths here — the leaf is cut off
//     the WEB name P1 already published, so P8 inherits P1's naming policy
//     instead of running a second, divergent one.
//
//     P8.2 VALUE — always `var(--<token WEB name>)`, never the token's
//     resolved literal, and the block is `@theme inline`. Both halves of that
//     were established by measurement, not preference:
//       - `@theme inline` substitutes the value TEXT into the utility and does
//         not emit the key as a custom property. So the utility ends up
//         `background-color: var(--background-default-primary)` and resolves
//         the token AT THE ELEMENT, picking up `.dark` and any scoped
//         override on the way down.
//       - A plain `@theme` was tried first and is WRONG. It emits
//         `--color-background-default-primary: var(--background-default-primary)`
//         into `:root`, which resolves there and then INHERITS the :root
//         answer downward, so a subtree that re-declares
//         `--content-default-primary` no longer reaches the utility. The
//         breakpoint probe caught this as a real regression: the ControlMedia
//         toggle on project pages, which sits under a locally inverted scope,
//         went white -> black at every width. This is the same hazard P2's
//         comment names ("detach `.dark` from the token the utility
//         resolves"), reached from the other direction.
//     EXCEPTION — SAME-NAME. When the computed key EQUALS the token's WEB name
//     (`--radius-300`, `--blur-100`), `var()` is a self-reference and MUST NOT
//     be emitted. Under `inline` Tailwind does not drop such a key; it
//     re-declares it inside the utility rule, producing
//     `.rounded-300 { --radius-300: var(--radius-300); border-radius:
//     var(--radius-300) }`. That is a cycle, so the custom property is invalid
//     at computed-value time and the utility silently computes to 0 — measured
//     in Chromium: the cyclic case yields `border-radius: 0px` where the plain
//     one yields 3px. No error, no warning, just a radius that is not there.
//     Those keys therefore emit the token's resolved default-mode LITERAL,
//     with the token named in a trailing comment. Safe because every
//     same-name namespace (core/radius, effect/blur) is single-mode, so the
//     literal cannot go stale against a `.dark` or `@media` override; and both
//     halves come from the same export in the same pass, so they cannot drift
//     from each other. Colour is never same-name (`--color-` prefix), so the
//     namespace that actually needs element-level resolution always gets it.
//
//     P8.3 RESETS. Each namespace the house populates opens with
//     `--<namespace>-*: initial`, so Tailwind's defaults (`rounded-xl`,
//     `bg-neutral-500`, `duration-200`, `lg:`=1024) stop compiling. NOT reset:
//       - `--spacing`. Tailwind v4 derives every numeric spacing utility from
//         a single `--spacing` MULTIPLIER (`p-4` = `calc(var(--spacing) * 4)`),
//         not from per-key `--spacing-*` entries, so there is no namespace to
//         populate with Figma suffixes and `--spacing-*: initial` would remove
//         nothing. Spacing stays codemod + lint discipline (markup consumes
//         `p-[var(--dimension-600)]`), and `p-4` deliberately still compiles.
//       - `--font-weight-*`. HELD, not declined: the DS's own `action-base`
//         recipe body still `@apply font-medium`, and that body is a separate
//         lane (it needs a Figma Action check before any swap), so a reset
//         would fail the package build today. Also open on the Figma side:
//         text-primitives publishes `weight/strong` as the STRING "Medium",
//         not a numeric font-weight.
//       - `--text-*`. HELD on an independent blocker: the house 050–1700 type
//         ramp is hand-authored in styles.css because its per-step
//         letter-spacing modifiers have no export equivalent, so the reset
//         would strip a ramp P8 cannot regenerate. (`badge-base` stopped
//         `@apply`ing `text-xs` in #18; that recipe is no longer the reason.)
//       - `--z-index-*`. HELD because `z-<number>` is a BARE-VALUE utility
//         with no theme namespace behind it at all: Tailwind ships no
//         `--z-index-*` namespace, so `--z-index-*: initial` removes nothing
//         and `z-10` compiles either way. The export also has no z collection
//         to repopulate from, so styles.css's hand-authored
//         `--z-index-base…toast` scale stays authoritative.
//     Each held namespace is listed in the report's §9 so the hold is a
//     visible decision rather than an omission.
//
//     P8.6 MOTION IS BRIDGED, under Tailwind's OWN namespace names. The
//     duration/delay utilities are NOT bare-value-only: Tailwind v4 reads
//     `--transition-duration-*` and `--transition-delay-*`, and a namespace
//     entry WINS over the bare-millisecond fallback. Compiled against
//     tailwindcss 4.3.3: with `--transition-duration-300: 0.375s` present,
//     `duration-300` emits `transition-duration: 0.375s`; without it, the
//     bare path emits `300ms`. So P8 bridges the Figma motion collection into
//     both namespaces keyed by the FIGMA suffix — `--transition-duration-300`
//     = `var(--duration-300)` = motion/duration-300 = 0.375s.
//     What the resets do and do NOT do, measured: Tailwind ships no
//     `--transition-duration-*` / `--transition-delay-*` theme entries at all
//     (theme.css has only `--default-transition-duration`), so like
//     `--z-index-*` the `: initial` lines REMOVE nothing. They are emitted for
//     P8.5 whole-namespace consistency and to fence a future Tailwind default.
//     The bare-ms fallback also SURVIVES for suffixes Figma does not publish:
//     `delay-150` still compiles to `150ms`, because the reset clears theme
//     entries, not the bare-value path. Only a lint can close that; the win
//     here is that every suffix Figma DOES publish now resolves to the Figma
//     value instead of a coincidental millisecond.
//     The house names `--duration-*` / `--delay-*` remain the token layer;
//     the `--transition-*` keys are the bridge, and the two never collide, so
//     P8.2's same-name literal rule does not fire.
//     `duration-motion-300` is NOT the shape — the namespace suffix is the
//     bare Figma leaf, and a `motion-` prefixed candidate emits nothing.
//     `--ease-*` is the same collection under Tailwind's `--ease-*` name.
//     P8.4 BREAKPOINTS. `--breakpoint-<family>` from `breakpoints.entries`,
//     `default` layoutVariant only, px converted to rem at a 16px root. The
//     `flush` / `sidebar-main` rows are LAYOUT VARIANTS, not breakpoints —
//     they share their family's width and are selected by
//     `[data-jhd-layout-variant]` (P3), so emitting them here would invent
//     four duplicate widths. Tailwind's `2xl` disappears with the reset
//     because Figma publishes no fifth device width.
//
//     P8.5 HAND-AUTHORED. P2 does NOT apply to this file. A namespace reset
//     is only true if the whole namespace is emitted in one place, so P8
//     always emits the full house namespace and the report's §9 classifies
//     every hand-authored `@theme` entry in styles.css as
//     GENERATED-EQUIVALENT / VALUE-DRIFT / HAND-ONLY. GENERATED-EQUIVALENT
//     entries — byte-equal to what P8 emits — are deleted from styles.css, so
//     generated wins where the two already agree and nothing else moves.
//
// P9. COMPOSE_COLOR (2026-09-09, handoff 7; retargeted 2026-09-09 to schema 7
//     / handoff 8) — a COLOR variable's mode `raw` can be a
//     `VARIABLE_EXPRESSION` (`expressionFunction: COMPOSE_COLOR`): exactly two
//     `VARIABLE_ALIAS` arguments, arg 1 a colour, arg 2 a `core`
//     `opacity/opacity-*` FLOAT. This is Figma's replacement for the alpha
//     black/white ramp handoff 6 hand-authored.
//
//     SCHEMA 7 CHANGE — the export now resolves the expression itself. Every
//     COMPOSE_COLOR mode carries a `build` cell exactly like a FLOAT's (P4):
//     `build.status: "resolved"`, `build.css` (relative colour syntax,
//     `rgb(from var(--<colour>) r g b / var(--<opacity>))`, both arguments
//     still live `var()` references so `.dark`/theme-mode overrides on either
//     half keep flowing through), `build.literal` (an 8-digit hex fallback),
//     `build.conversionStrategy: "compose-color"`. Under P4's own contract —
//     `build.status === "resolved"` -> emit `build.css` verbatim, never
//     re-derive it — the generator now emits `build.css` as-is and no longer
//     computes a `color-mix()` of its own (the branch handoff 7 shipped under
//     the OLD, schema-6, unresolved-expression export). `composeColor` is
//     retained ONLY as a validating pass-through: it still walks
//     `expressionArguments` to resolve both operands' WEB names (needed for
//     P9.2 reachability and for the terminal-value comment further down an
//     alias chain, P5), and it still hard-fails on any `VARIABLE_EXPRESSION`
//     shape it does not recognise or on `build.status !== "resolved"` — an
//     unresolved compose cell is exactly the shape the OLD P9 used to handle
//     by computing its own mix, and schema 7 states plainly that this is now
//     the export's job, not the generator's, so an unresolved cell is a hard
//     failure rather than a silent fallback.
//     RELATIVE COLOUR SYNTAX BASELINE — `rgb(from …)` lands in Baseline later
//     (Chrome 119 / Safari 16.4 / Firefox 128) than `color-mix()` (Chrome 111
//     / Safari 16.2 / Firefox 113); noted for the record, not overridden — the
//     export states the value and P4 says emit it verbatim.
//     The `bttf`-mode inline-number opacity case handoff 7 found (a bare
//     number, `60.000003814697266`, instead of a second `VARIABLE_ALIAS`) is
//     NOT present in the handoff 8 export — every COMPOSE_COLOR occurrence
//     (66 mode entries) resolves through two aliases. `composeColorArgs`
//     keeps the literal-number branch as a defensive fallback (never
//     exercised by this export) rather than deleting it, since nothing proves
//     Figma cannot reintroduce the shape; flagged for the operator as an
//     export fact, not re-derived here.
//
//     P9.2 REACHABILITY. `privateIds`'s alias closure (P7) must also walk a
//     COMPOSE_COLOR mode's two `expressionArguments` (read from `mode.raw`,
//     unchanged by schema 7 — the raw expression is still published alongside
//     `build`), not just `mode.alias.chain[0]` — both arguments are emitted
//     as `var()` and are therefore load-bearing the same way an alias hop is.
//     Missing this wrongly drops a hidden colour/opacity primitive as HIDDEN
//     instead of keeping it PRIVATE, leaving the composing token's `var()`
//     dangling.
//
//     P9.1 THEME MODES, DRIVEN BY THE EXPORT'S OWN `isTheme` FLAG. Schema 7's
//     `breakpoints.entries` rows for the `color` collection now carry
//     `isTheme: true` / `theme: "<name>"` / `source: "theme-name"` for every
//     mode (`light`, `dark`, `bttf`), alongside the pre-existing layout rows
//     (`isTheme: false`). P3's mode-selector rule is driven by that flag
//     directly (`themeModeIds`, below) rather than a `collection.name ===
//     "color"` string check: any mode whose id appears in the export's own
//     isTheme set gets `:root` (default) or `.<mode-name>` (non-default) —
//     `bttf` lands on `.bttf` through the same mechanism as `.dark`, with no
//     hardcoded collection name and no new code path. No semantics beyond
//     that are assumed for `bttf` here.
//
// P10. BTTF IS A TOTAL MODE (2026-09-09, lock rows 3 & 7: bttf "replaces
//     light and dark entirely" / "i think i would prefer to just use bttf in
//     bttf mode"). While `.bttf` is on the document root, a nested `.dark`
//     (per-media or per-section ground mode, e.g. portfolio's
//     `section-landmark.tsx` / `media.tsx`) must not re-point tokens back to
//     dark's values — proximity should not beat the root theme.
//
//     Checked and rejected: a generic "exclusive theme" policy driven by an
//     export-published flag, per this file's own rule of never inventing a
//     heuristic the export doesn't state. `breakpoints.entries` rows for
//     `light`/`dark`/`bttf` carry only `isTheme`/`theme`/`source`/
//     `confidence` (P9.1) — no exclusivity/ordering field exists to hang a
//     generic rule on. This is therefore a NAMED, bttf-specific rule, not a
//     collection-wide mechanism: only the `bttf` mode gets it, applied
//     verbatim here rather than derived from the export.
//
//     Also rejected: emitting `.dark` as `.dark:not(.bttf *)` instead. That
//     would require touching every consumer of `.dark`'s specificity
//     assumptions (the hand-authored block AND the generated block share one
//     selector) for a mode (`dark`) that has no reason to know `bttf` exists;
//     putting the exclusion on `bttf`'s own selector keeps the total-mode
//     concept contained to the one mode that claims it.
//
//     MECHANISM: the `bttf` mode's generated block is selected by
//     `.bttf, .bttf .dark` instead of plain `.bttf`. `.bttf .dark` (0,2,0)
//     outguns the hand-authored `.dark` block and the generated `.dark`
//     block (both 0,1,0) regardless of source order — BUT ONLY FOR A TOKEN
//     A `.bttf .dark`-matching BLOCK ACTUALLY DECLARES (reviewer round-1 red
//     2: specificity decides which of two competing declarations wins; it
//     cannot make a rule win a token neither `.bttf` nor `.bttf .dark`
//     declares at all — that token just keeps resolving through whatever
//     `.dark` rule DOES declare it). Every theme-bearing token must
//     therefore be either generated (so P10 covers it automatically) or
//     explicitly hand-mirrored under `.bttf, .bttf .dark` — a token declared
//     only in the hand-authored `.dark` block is a bttf leak by construction,
//     no matter what this selector's specificity is. Plain `.bttf` still
//     needs no source-order help against `:root` (0,1,0 vs 0,1,0) beyond
//     what already shipped with P9.1 — `:root` sorts first in
//     `renderGroups`, so `.bttf` wins ties by position alone, unaffected by
//     this change.
//
//     The `dark:` custom variant (`src/styles.css`) is handled the same way:
//     `@custom-variant dark (&:is(.dark:not(.bttf, .bttf *) *))` — a `.dark`
//     ancestor that is itself `.bttf` or inside `.bttf` no longer arms the
//     variant, so `dark:` utilities go inert under bttf exactly like the
//     token block does. A consumer does nothing beyond applying `.bttf` at
//     the root; no change to how `.dark` is applied anywhere.
//
// Determinism: collections sorted by name, variables by WEB name, numbers
// rounded to 6 decimal places (Figma stores float32, so raws arrive as
// 0.10000000149011612). Same inputs -> byte-identical output.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// P7 — the EXCLUDED policy list, matched against `"<collection.name>/<v.name>"`.
// Applied wholesale on path identity: hidden state is irrelevant, and
// reachability never revives an entry (see P7 above).
//
//   `.utility/`           durable. Operator ruling 2026-09-06: ".utility ignore
//                         all together" — a Figma authoring scratch collection.
//   `layout/grid/aspect/` INTERIM, pending Figma marking these hidden. Operator
//                         ruling 2026-09-06: "we didn't bring in aspect ratio
//                         related variables like portrait, tall and landscape.
//                         They are just figma hacks because i can actually add
//                         an aspect ratio."
const EXCLUDE_PATHS = ["layout/grid/aspect/", ".utility/"];

const isHidden = (v) => v.hiddenFromPublishing === true || v.effectivelyHiddenFromPublishing === true;

const isExcluded = (collection, v) =>
  EXCLUDE_PATHS.some((prefix) => `${collection.name}/${v.name}`.startsWith(prefix));

// P7 — the alias closure. Returns the set of variable ids that are hidden but
// reachable by alias from an emitted variable, and therefore MUST still be
// declared or the referring token is invalid at computed-value time.
//
// Seeded with everything emitted on its own merit (published, not excluded),
// then walked transitively: a PRIVATE token's own alias targets are PRIVATE
// too, or the private token dangles in turn. EXCLUDED paths are never revived.
function privateIds(doc) {
  const byId = new Map();
  const collectionOf = new Map();
  for (const c of doc.collections) {
    for (const v of c.variables) {
      byId.set(v.id, v);
      collectionOf.set(v.id, c);
    }
  }

  // Every effective mode, not just the default: light and dark routinely alias
  // different primitives, and both declarations get emitted.
  //
  // P9: a COMPOSE_COLOR mode has no `mode.alias` at all — its two arguments
  // live in `mode.raw.expressionArguments` and are emitted as `var()`
  // references exactly like an alias hop, so they must feed the same
  // reachability closure or a hidden colour/opacity primitive behind a
  // COMPOSE_COLOR argument would wrongly land HIDDEN (dropped) instead of
  // PRIVATE (emitted) and the composing token would dangle.
  const hops = (v) =>
    v.modes
      .filter((m) => m.effective !== false)
      .flatMap((m) => {
        const aliasHop = m.alias?.chain?.[0]?.variableId;
        if (aliasHop) return [aliasHop];
        const raw = m.raw;
        if (raw?.type === "VARIABLE_EXPRESSION" && raw.expressionFunction === "COMPOSE_COLOR") {
          return (raw.expressionArguments ?? [])
            .filter((a) => a?.type === "VARIABLE_ALIAS")
            .map((a) => a.id);
        }
        return [];
      });

  const seen = new Set();
  const queue = [];
  for (const c of doc.collections) {
    for (const v of c.variables) {
      if (isExcluded(c, v) || isHidden(v)) continue;
      seen.add(v.id);
      queue.push(v.id);
    }
  }

  const priv = new Set();
  while (queue.length) {
    const v = byId.get(queue.pop());
    if (!v) continue; // remote / not in the export — P5 inlines its terminal
    for (const targetId of hops(v)) {
      if (seen.has(targetId) || priv.has(targetId)) continue;
      const target = byId.get(targetId);
      if (!target || isExcluded(collectionOf.get(targetId), target)) continue;
      if (!isHidden(target)) continue; // already emitted on its own merit
      priv.add(targetId);
      queue.push(targetId);
    }
  }
  return priv;
}

// --- helpers ---------------------------------------------------------------

const fail = (msg) => {
  throw new Error(`ds-from-handoff: ${msg}`);
};

/** Figma stores float32; round off the representation noise deterministically. */
const num = (n) => {
  if (typeof n !== "number" || !Number.isFinite(n)) fail(`non-finite number ${n}`);
  const r = Math.round(n * 1e6) / 1e6;
  return String(r === 0 ? 0 : r);
};

/** `#RRGGBBAA` (the export's COLOR form) -> the package's CSS convention. */
const color = (hex8) => {
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/.exec(hex8);
  if (!m) {
    if (/^#[0-9a-fA-F]{6}$/.test(hex8)) return hex8.toLowerCase();
    fail(`unrecognised COLOR value ${JSON.stringify(hex8)}`);
  }
  const [, rgb, aa] = m;
  if (aa.toLowerCase() === "ff") return `#${rgb.toLowerCase()}`;
  const ch = (i) => parseInt(rgb.slice(i, i + 2), 16);
  const pct = num((parseInt(aa, 16) / 255) * 100);
  return `rgb(${ch(0)} ${ch(2)} ${ch(4)} / ${pct}%)`;
};

const easing = (raw) => {
  const b = raw.easingFunctionCubicBezier;
  if (raw.type === "LINEAR") return "linear";
  if (!b) fail(`EASING without cubic bezier: ${JSON.stringify(raw)}`);
  return `cubic-bezier(${num(b.x1)}, ${num(b.y1)}, ${num(b.x2)}, ${num(b.y2)})`;
};

const webName = (v) => {
  const n = v.codeSyntax?.WEB?.value;
  if (!n) fail(`variable ${v.id} (${v.name}) has no codeSyntax.WEB.value`);
  return n;
};

/**
 * Suffix per `buildUnit`. The export names the unit the build should use; this
 * map is the only place CSS syntax is attached to it. A `buildUnit` this map
 * does not know is a hard failure — silently dropping the unit is exactly the
 * class of bug the per-mode `unitHint` exists to remove.
 */
const BUILD_UNIT_SUFFIX = {
  rem: "rem",
  px: "px",
  em: "em",
  "%": "%",
  unitless: "",
};

/** Render an alias chain's terminal value the way the token itself would read. */
const terminalNote = (v, mode, terminal, byId) => {
  if (v.type === "FLOAT" && mode.build?.status === "resolved") return mode.build.css;
  if (v.type === "COLOR" && typeof terminal === "string") return color(terminal);
  // P9: a COMPOSE_COLOR terminal is the expression object, not a hex string —
  // render it the same symbolic way composeColor's own note does rather than
  // stringifying the object.
  if (v.type === "COLOR" && terminal && typeof terminal === "object" && terminal.type === "VARIABLE_EXPRESSION") {
    return composeColorNote(v, terminal, byId);
  }
  return String(terminal);
};

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * P9 — COMPOSE_COLOR (schema 7 / handoff 8). `expressionFunction:
 * "COMPOSE_COLOR"` with exactly two `VARIABLE_ALIAS` arguments — arg 1 a
 * `color-primitives` colour, arg 2 a `core` `opacity/opacity-*` FLOAT — is
 * Figma's replacement for the alpha black/white ramp handoff 6 hand-authored.
 * Schema 7 resolves the expression itself: `mode.build.css` is a ready CSS
 * string (relative colour syntax, `rgb(from var(--<colour>) r g b /
 * var(--<opacity>))`) with both arguments still live `var()` references, so
 * `.dark`/theme-mode overrides on either half keep flowing through. Per P4's
 * contract, `composeColor` emits `build.css` VERBATIM — it does not compute a
 * `color-mix()` or any other value of its own; that was the OLD (schema 6)
 * behaviour, superseded now that the export states the answer.
 */
/**
 * Resolve a COMPOSE_COLOR expression's colour and opacity argument WEB names,
 * for the terminal-value comment (`COMPOSE_COLOR(colour, opacity)`) and as a
 * shape/reachability validation independent of `build`. Shared by
 * `composeColor` (the emitted value) and `composeColorNote` (a terminal
 * comment further down an alias chain) so both fail on the same malformed
 * shape instead of drifting apart.
 *
 * The opacity argument is a `VARIABLE_ALIAS` in every occurrence this export
 * publishes; a bare-number literal (handoff 7's one `bttf`
 * `--content-action-secondary` exception) is kept as a defensive fallback —
 * not exercised by this export, flagged for the operator as an export fact
 * rather than re-derived — handled exactly like the aliased case minus the
 * `var()` indirection: `pct: "60%"` inline. Nothing is invented — the
 * export's own number is used verbatim, rounded once by `num()`.
 */
function composeColorArgs(v, raw, byId) {
  const args = raw.expressionArguments;
  const [colorArg, opacityArg] = args ?? [];
  if (
    raw.expressionFunction !== "COMPOSE_COLOR" ||
    !Array.isArray(args) ||
    args.length !== 2 ||
    colorArg?.type !== "VARIABLE_ALIAS" ||
    !(opacityArg?.type === "VARIABLE_ALIAS" || typeof opacityArg === "number")
  ) {
    fail(`${webName(v)}: unrecognised VARIABLE_EXPRESSION shape ${JSON.stringify(raw)}`);
  }
  const colorTarget = byId.get(colorArg.id);
  if (!colorTarget) fail(`${webName(v)}: COMPOSE_COLOR colour argument ${colorArg.id} not in export`);
  if (colorTarget.type !== "COLOR") {
    fail(`${webName(v)}: COMPOSE_COLOR arg 1 (${webName(colorTarget)}) is ${colorTarget.type}, expected COLOR`);
  }
  const colorName = webName(colorTarget);

  if (typeof opacityArg === "number") {
    return { colorName, note: `${colorName}, ${num(opacityArg)}%` };
  }
  const opacityTarget = byId.get(opacityArg.id);
  if (!opacityTarget) fail(`${webName(v)}: COMPOSE_COLOR opacity argument ${opacityArg.id} not in export`);
  if (opacityTarget.type !== "FLOAT") {
    fail(`${webName(v)}: COMPOSE_COLOR arg 2 (${webName(opacityTarget)}) is ${opacityTarget.type}, expected FLOAT`);
  }
  const opacityName = webName(opacityTarget);
  return { colorName, note: `${colorName}, ${opacityName}` };
}

/**
 * P4/P9 — emit the export's own `build.css` verbatim. `mode.build` for a
 * COMPOSE_COLOR mode carries the same contract as a FLOAT's (`status`, and
 * for "resolved", `css`/`raw`/`literal`): `build.status !== "resolved"` is a
 * hard failure (the export states it is the one who resolves this expression
 * now; an unresolved cell means the export itself could not, and inventing a
 * `color-mix()` in its place would silently re-take a responsibility schema 7
 * moved off the generator), and a `build.raw` that disagrees with `mode.raw`
 * is a hard failure, never a silent pick of one side (mirrors the FLOAT
 * check, P4).
 */
function composeColor(v, mode, byId) {
  const raw = mode.raw;
  const { note } = composeColorArgs(v, raw, byId);
  const b = mode.build;
  if (!b || !b.status) fail(`${webName(v)} mode ${mode.modeName}: no build cell published for COMPOSE_COLOR`);
  if (b.raw && JSON.stringify(b.raw) !== JSON.stringify(raw)) {
    fail(`${webName(v)} mode ${mode.modeName}: build.raw disagrees with raw for COMPOSE_COLOR`);
  }
  if (b.status !== "resolved") {
    fail(`${webName(v)} mode ${mode.modeName}: COMPOSE_COLOR build.status is "${b.status}", not "resolved"`);
  }
  return plain(b.css, `COMPOSE_COLOR(${note})`);
}

function composeColorNote(v, raw, byId) {
  const { note } = composeColorArgs(v, raw, byId);
  return `COMPOSE_COLOR(${note})`;
}

// --- value resolution ------------------------------------------------------

/**
 * @returns {{ value: string, note: string|null, aliasTarget: string|null,
 *             unresolvedAlias: boolean, terminal: string|null }}
 */
function resolveValue(v, mode, byId) {
  if (mode.alias) {
    const hop = mode.alias.chain?.[0];
    const terminal = mode.alias.terminalValue ?? null;
    const target = hop ? byId.get(hop.variableId) : undefined;
    if (target) {
      const name = webName(target);
      return {
        value: `var(${name})`,
        note: terminal == null ? null : terminalNote(v, mode, terminal, byId),
        aliasTarget: name,
        unresolvedAlias: false,
        terminal,
      };
    }
    // Remote / not exported: fall back to the terminal so the token still works.
    if (terminal == null) fail(`${webName(v)}: alias with no resolvable target or terminal`);
    return {
      value: v.type === "COLOR" ? color(terminal) : String(terminal),
      note: `alias target ${hop?.variableName ?? "?"} not in export — terminal value inlined`,
      aliasTarget: null,
      unresolvedAlias: true,
      terminal,
    };
  }

  const raw = mode.raw;
  switch (v.type) {
    case "COLOR":
      if (raw && typeof raw === "object" && raw.type === "VARIABLE_EXPRESSION") {
        return composeColor(v, mode, byId);
      }
      return plain(color(raw));
    case "STRING":
      return plain(JSON.stringify(String(raw)));
    case "TIMING":
      return plain(`${num(raw)}s`);
    case "EASING":
      return plain(easing(raw));
    case "BOOLEAN":
      return plain(String(raw));
    case "FLOAT": {
      const u = mode.unitHint ?? {};
      const b = mode.build;
      if (!b || !b.status) fail(`${webName(v)} mode ${mode.modeName}: no build cell published`);

      // The emitted value comes from `build`, not from `raw`. If the export
      // ever disagreed with itself the generator would silently ship the stale
      // half, so refuse rather than pick a side.
      if (typeof b.raw === "number" && num(b.raw) !== num(raw)) {
        fail(`${webName(v)} mode ${mode.modeName}: build.raw ${b.raw} disagrees with raw ${raw}`);
      }

      if (b.status === "resolved") {
        const note = u.sourceUnit === "px" && b.unit !== "px" ? `${num(raw)}px` : null;
        return plain(b.css, note);
      }

      // status === "unresolved" — in practice `divide-by-associated-font-size`,
      // which needs a font size the export does not carry for a standalone
      // variable. Emit the raw source value rather than inventing a divisor,
      // and list it as UNCONVERTED.
      return {
        ...plain(
          `${num(raw)}${BUILD_UNIT_SUFFIX[u.sourceUnit] ?? ""}`,
          `UNCONVERTED: ${u.conversionStrategy} -> ${u.buildUnit} needs an associated font size the export does not carry (${b.confidence} confidence); raw ${u.sourceUnit ?? "value"} emitted`,
        ),
        unconverted: {
          strategy: u.conversionStrategy,
          buildUnit: u.buildUnit ?? null,
          confidence: b.confidence ?? "none",
          sourceUnit: u.sourceUnit ?? null,
        },
      };
    }
    default:
      return fail(`unhandled variable type ${v.type} on ${webName(v)}`);
  }
}

const plain = (value, note = null) => ({
  value,
  note,
  aliasTarget: null,
  unresolvedAlias: false,
  terminal: null,
  unconverted: null,
});

// --- hand-authored surface -------------------------------------------------

/**
 * A block header counts as GLOBAL only if it is top-level and unconditional —
 * a bare `:root` / `html`, or a `@theme` block (which Tailwind emits into
 * `@layer theme` for every element). Anything else — `.dark`, `@media`,
 * `@supports`, `@utility`, a nested `:root` inside a conditional at-rule —
 * applies only when its condition holds, so it cannot supersede a generated
 * token everywhere and must not suppress generation (see P2).
 */
const isGlobalScope = (stack) =>
  stack.length === 1 && /^(?::root|html|@theme(?:\s|$).*)$/.test(stack[0]);

/**
 * Custom properties declared in the hand-authored stylesheet, split by scope:
 *
 *   `declared` — name -> value for GLOBAL declarations. These win the cascade
 *                unconditionally, so the generator stands down (P2) and the
 *                report calls each one MATCH or VALUE-DRIFT.
 *   `scoped`   — names seen ONLY under a selector or conditional at-rule. The
 *                generated token still needs to exist for the scoped override
 *                to override anything, so these do not suppress generation.
 *
 * Comments are stripped first so a name mentioned in prose is not mistaken for
 * a declaration. Brace/semicolon scanning is sufficient for this stylesheet;
 * it has no braces or semicolons inside strings or url() values.
 */
function readHandAuthored(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const declared = new Map();
  const scoped = new Set();
  const stack = [];
  let buf = "";

  for (const ch of stripped) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      stack.pop();
      buf = "";
    } else if (ch === ";") {
      const m = /^\s*(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]+)$/.exec(buf);
      if (m) {
        if (isGlobalScope(stack)) {
          if (!declared.has(m[1])) declared.set(m[1], m[2].trim());
        } else {
          scoped.add(m[1]);
        }
      }
      buf = "";
    } else {
      buf += ch;
    }
  }

  for (const name of declared.keys()) scoped.delete(name);
  return { declared, scoped };
}

// --- mode -> selector (P3) -------------------------------------------------

/**
 * Layout breakpoints, read from the export's own `breakpoints.entries` (one
 * row per layout mode: `widthPx`, `layoutVariant`) rather than scanning the
 * collection for a `device/width` variable — schema 6 publishes this as a
 * first-class array so the generator never has to go find it. An empty
 * `widths` map means the export did not publish a resolvable width for every
 * layout mode, and the generator falls back to the data-attribute placeholder
 * rather than guessing.
 *
 * P6 (2026-09-05): `baseModeId` is the mode with the SMALLEST `widthPx` among
 * `layoutVariant === "default"` entries — the unconditional base seeds from
 * there (`sm`), not from the collection's `defaultModeId` (`lg`, superseded).
 */
/**
 * P9.1 — the export's own `isTheme` flag on `breakpoints.entries` names every
 * theme mode (light/dark/bttf today) directly, so the generator no longer
 * needs a `collection.name === "color"` string check to decide the
 * `:root`/`.<mode-name>` selector rule: any mode id in this set gets it,
 * whichever collection it belongs to. Falls back to an empty set (no rows) if
 * a future export drops the flag, which restores the old collection-name gate
 * in `placementsFor` below — never silently drops the `.dark`/`.bttf` split.
 */
function themeModeIds(doc) {
  return new Set((doc.breakpoints?.entries ?? []).filter((e) => e.isTheme).map((e) => e.modeId));
}

function layoutBreakpoints(doc) {
  const layout = doc.collections.find((c) => c.name === "layout");
  const entries = (doc.breakpoints?.entries ?? []).filter((e) => e.collectionName === "layout");
  const widths = new Map();
  const variants = new Map();
  let baseModeId = null;
  let baseWidth = Infinity;
  for (const e of entries) {
    if (typeof e.widthPx !== "number" || !Number.isFinite(e.widthPx)) continue;
    widths.set(e.modeId, e.widthPx);
    variants.set(e.modeId, e.layoutVariant ?? "default");
    if ((e.layoutVariant ?? "default") === "default" && e.widthPx < baseWidth) {
      baseWidth = e.widthPx;
      baseModeId = e.modeId;
    }
  }
  const resolved = layout && widths.size === layout.modes.length;
  return resolved ? { widths, variants, baseModeId } : { widths: new Map(), variants: new Map(), baseModeId: null };
}

/**
 * Where a mode's declarations land. `width` is the sort key (mobile-first
 * ascending); -1 is the unconditional base, which sorts first.
 * @returns {Array<{ media: string|null, selector: string, width: number }>}
 */
function placementsFor(collection, mode, ctx) {
  const isDefault = mode.id === collection.defaultModeId;
  if (collection.modes.length === 1) return [{ media: null, selector: ":root", width: -1 }];
  if (ctx.theme.has(mode.id) || (ctx.theme.size === 0 && collection.name === "color")) {
    // P3/P9.1: any mode the export flags `isTheme: true` gets `.<mode-name>`
    // (the house selector mechanism `.dark` already established) — driven by
    // the export's own flag, not a hardcoded `collection.name === "color"`
    // check, so a third mode like `bttf` lands on `.bttf` with no new code.
    // Falls back to the old collection-name gate only if the export ever
    // stops publishing `isTheme` rows at all (ctx.theme.size === 0).
    //
    // P10: `bttf` is additionally selected by `.bttf .dark` so it wins over
    // a nested `.dark` (total-mode rule; named to `bttf` specifically, see
    // P10 above — not derived from any export flag). Also `.bttf.dark`
    // (reviewer round-2 amber 1): when BOTH classes land on the SAME
    // element, plain `.bttf` (0,1,0) ties the generated `.dark` block
    // (0,1,0), and `.dark` sorts later in `renderGroups` so it wins the tie
    // — the same leak `.bttf .dark` prevents for descendants, just on the
    // node itself. `.bttf.dark` is a compound selector (0,2,0) so it
    // outguns plain `.dark` regardless of source order.
    const selector = isDefault ? ":root" : mode.name === "bttf" ? `.${mode.name}, .${mode.name} .dark, .${mode.name}.dark` : `.${mode.name}`;
    return [{ media: null, selector, width: -1 }];
  }

  if (collection.name === "layout" && ctx.layout.widths.size) {
    const width = ctx.layout.widths.get(mode.id);
    const variant = ctx.layout.variants.get(mode.id) ?? "default";
    const selector =
      variant === "default" ? ":root" : `[data-jhd-layout-variant="${variant}"]`;
    const at = { media: `@media (min-width: ${num(width)}px)`, selector, width };
    // P6: the SMALLEST-width default-variant mode seeds the unconditional
    // base (not the collection's defaultModeId), so every layout token still
    // resolves below the smallest published sample width — mobile-first.
    return mode.id === ctx.layout.baseModeId ? [{ media: null, selector, width: -1 }, at] : [at];
  }

  if (isDefault) return [{ media: null, selector: ":root", width: -1 }];
  const slug = collection.name.replace(/^\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return [{ media: null, selector: `[data-jhd-${slug}-mode="${mode.name}"]`, width: -1 }];
}

// --- generation ------------------------------------------------------------

// Mobile-first: the unconditional base (width -1) first, then ascending
// min-width. Within a width, `:root` before the variant selectors that
// override it.
function renderGroups(groups) {
  const out = [];
  const ordered = [...groups.values()].sort(
    (a, b) =>
      a.width - b.width ||
      (a.selector === ":root" ? -1 : b.selector === ":root" ? 1 : cmp(a.selector, b.selector)),
  );
  for (const g of ordered) {
    if (g.media) {
      out.push(`${g.media} {`, `  ${g.selector} {`, ...g.lines.map((l) => `    ${l}`), "  }", "}");
    } else {
      out.push(`${g.selector} {`, ...g.lines.map((l) => `  ${l}`), "}");
    }
  }
  return out;
}

// P7 — which emitted tokens alias this variable, so the PRIVATE report says
// WHY each one had to survive rather than just asserting that it did.
function aliasedByNames(doc, targetId) {
  const names = new Set();
  for (const c of doc.collections) {
    for (const v of c.variables) {
      if (isExcluded(c, v)) continue;
      for (const m of v.modes) {
        if (m.effective === false) continue;
        if (m.alias?.chain?.[0]?.variableId === targetId) names.add(webName(v));
      }
    }
  }
  return [...names].sort(cmp);
}

function tokensFor(doc, handDeclared, cfg) {
  if (doc.schema !== "design-system-handoff") fail(`unexpected schema ${doc.schema}`);
  if (String(doc.schemaVersion) !== "7") fail(`unsupported schemaVersion ${doc.schemaVersion}`);

  const byId = new Map();
  for (const c of doc.collections) for (const v of c.variables) byId.set(v.id, v);

  const ctx = { layout: layoutBreakpoints(doc), theme: themeModeIds(doc) };
  const priv = privateIds(doc); // P7 — hidden but alias-reachable, so still emitted

  const collections = [...doc.collections].sort((a, b) => cmp(a.name, b.name));
  const rows = []; // reconciliation rows, one per (collection, variable)
  const privateRows = []; // P7 — hidden but alias-reachable: emitted, fenced, not public
  const hiddenRows = []; // P7 — hidden AND unreachable: never emitted
  const excludedRows = []; // P7 — EXCLUDE_PATHS policy list
  const blocks = []; // rendered CSS blocks

  for (const c of collections) {
    const variables = [...c.variables].sort((a, b) => cmp(webName(a), webName(b)));
    const groups = new Map(); // "<media>|<selector>" -> { media, selector, width, lines }
    const privGroups = new Map(); // same shape, rendered in the fenced PRIVATE block
    const superseded = [];

    for (const v of variables) {
      const name = webName(v);

      // P7 — EXCLUDED wins over everything: a policy list applied on path
      // identity, never revived by reachability.
      if (isExcluded(c, v)) {
        excludedRows.push({ collection: c.name, name, reason: `EXCLUDE_PATHS (${c.name})` });
        continue;
      }
      // P7 — hidden AND unreachable: nothing refers to it, dropping is safe.
      if (isHidden(v) && !priv.has(v.id)) {
        hiddenRows.push({ collection: c.name, name });
        continue;
      }
      // P7 — hidden but alias-reachable (PRIVATE). Emitted under the same name
      // so the referring semantic tokens resolve, but never a public row.
      const isPrivate = priv.has(v.id);

      const hand = handDeclared.get(name);
      const defaultMode = v.modes.find((m) => m.modeId === c.defaultModeId) ?? v.modes[0];
      const defaultResolved = resolveValue(v, defaultMode, byId);

      if (isPrivate) {
        privateRows.push({
          collection: c.name,
          name,
          type: v.type,
          value: defaultResolved.value,
          aliasedBy: aliasedByNames(doc, v.id),
        });
      } else rows.push({
        collection: c.name,
        name,
        type: v.type,
        generated: defaultResolved.value,
        hand: hand ?? null,
        status: hand == null
          ? "NAME-ONLY-IN-EXPORT"
          : hand === defaultResolved.value
            ? "MATCH"
            : "VALUE-DRIFT",
        usage: v.usage?.directBindingOccurrences ?? 0,
        unresolvedAlias: defaultResolved.unresolvedAlias,
        aliasTarget: defaultResolved.aliasTarget,
        unconverted: defaultResolved.unconverted ?? null,
      });

      if (hand != null) {
        // P2 — already declared globally by hand, so it resolves either way.
        if (!isPrivate) superseded.push(name);
        continue;
      }

      for (const mode of c.modes) {
        const mv = v.modes.find((m) => m.modeId === mode.id);
        if (!mv || mv.effective === false) continue;
        const r = mv.modeId === defaultMode.modeId ? defaultResolved : resolveValue(v, mv, byId);
        const decl = `${name}: ${r.value};${r.note ? ` /* ${r.note} */` : ""}`;
        const target = isPrivate ? privGroups : groups;
        for (const p of placementsFor(c, mode, ctx)) {
          const key = `${p.media ?? ""}|${p.selector}`;
          if (!target.has(key)) target.set(key, { ...p, lines: [] });
          target.get(key).lines.push(decl);
        }
      }
    }

    if (groups.size === 0 && privGroups.size === 0 && superseded.length === 0) continue;

    const head = [`/* --- ${c.name} ${"-".repeat(Math.max(0, 60 - c.name.length))} */`];
    if (superseded.length) {
      head.push(
        `/* ${superseded.length} token${superseded.length === 1 ? "" : "s"} in this collection are declared by hand in styles.css and`,
        `   are therefore not emitted here (see policy P2 in scripts/ds-from-handoff.mjs).`,
        `   Full name-by-name status is in ${cfg.paths.report}. */`,
      );
    }
    head.push(...renderGroups(groups));

    // P7 — PRIVATE: emitted so the published aliases above resolve, but fenced
    // and labelled so the file carries the intent Figma's publish flag meant.
    if (privGroups.size) {
      head.push(
        "",
        `/* private — alias targets of published tokens; not for direct use.`,
        `   These are hidden in Figma (only semantic tokens belong in a layout), but a`,
        `   custom property that is referenced and not declared is invalid at`,
        `   computed-value time — so the names must exist. Reference the semantic`,
        `   token that aliases these, never these. See policy P7 in`,
        `   scripts/ds-from-handoff.mjs and \u00a70 of ${cfg.paths.report}. */`,
        ...renderGroups(privGroups),
      );
    }
    blocks.push(head.join("\n"));
  }

  const header = [
    "/* GENERATED FILE — DO NOT EDIT BY HAND.",
    "",
    `   Source:   ${doc.artifactFilename ?? doc.documentName ?? "design-system handoff export"}`,
    `   Schema:   ${doc.schema} v${doc.schemaVersion}`,
    `   Exported: ${doc.generatedAt}`,
    `   State:    ${doc.fingerprint.designSystemStateHash}`,
    "",
    "   Regenerate with:  node scripts/ds-from-handoff.mjs",
    "   Policies (names, cascade, modes, units, aliases) are documented at the",
    "   top of that script. Hand-authored tokens in styles.css always win and",
    "   are omitted here; the reconciliation report lists every one.",
    "*/",
    "",
    "",
  ].join("\n");

  return { css: `${header}${blocks.join("\n\n")}\n`, rows, privateRows, hiddenRows, excludedRows };
}

// --- P8: Tailwind namespaces ------------------------------------------------

/**
 * Namespaces the house populates. `group` is the token-name segment the
 * namespace claims (P8.1): a token whose WEB name starts `--<group>-` has that
 * segment cut off, so `--easing-power2-out` lands as `--ease-power2-out`.
 * `group === ns` is the ordinary case and the reason `--radius-300` is not
 * `--radius-radius-300`.
 */
const P8_NAMESPACES = [
  { ns: "color", collection: "color", group: null,
    note: "semantic colour only — color-primitives is never bridged (P8.1)" },
  { ns: "radius", collection: "core", group: "radius" },
  { ns: "blur", collection: "effect", group: "blur" },
  { ns: "ease", collection: "motion", group: "easing" },
  { ns: "transition-duration", collection: "motion", group: "duration",
    note: "Tailwind's duration-* utility reads THIS namespace, not `--duration-*`; a namespace entry beats the bare-ms fallback, which still covers unpublished suffixes (P8.6)" },
  { ns: "transition-delay", collection: "motion", group: "delay",
    note: "Tailwind's delay-* utility reads THIS namespace, not `--delay-*`; a namespace entry beats the bare-ms fallback, which still covers unpublished suffixes (P8.6)" },
  { ns: "tracking", collection: "text-primitives", group: "letter-spacing",
    note: "px primitives — the export cannot convert these to em (report §6)" },
  { ns: "shadow", collection: null,
    note: "no Figma shadow collection; the reset clears Tailwind's ramp and styles.css's three house depths stand" },
  { ns: "leading", collection: null,
    note: "no Figma line-height collection; line-height comes from the type ROLE utilities" },
  { ns: "breakpoint", collection: null, note: "from breakpoints.entries (P8.4)" },
];

/** Namespaces deliberately left un-reset, with the blocker (P8.3). */
const P8_HELD = [
  ["--spacing", "Tailwind derives numeric spacing from one multiplier, not a suffix namespace — nothing to reset or populate. `p-4` still compiles by design."],
  ["--font-weight-*", "action-base still `@apply font-medium` (separate lane); text-primitives publishes weight/strong as the STRING \"Medium\"."],
  ["--text-*", "The hand-authored 050–1700 ramp in styles.css is the blocker: its per-step letter-spacing modifiers have no export equivalent, so a reset would drop them. (`badge-base` no longer `@apply`s `text-xs` as of #18, but `font-medium` still survives in `action-base`.)"],
  ["--z-index-*", "Tailwind resolves `z-<number>` as a BARE value, not through the namespace, so a reset removes nothing and `z-10` compiles either way. The export also has no z collection to populate it from; styles.css's hand-authored --z-index-base…toast scale stays authoritative."],
];

const P8_LEAF = (name, group) => {
  const bare = name.replace(/^--/, "");
  return group && bare.startsWith(`${group}-`) ? bare.slice(group.length + 1) : bare;
};

/**
 * One `@theme` block: per-namespace `initial` resets first, then the house
 * entries. Returns the CSS plus the rows §9 reconciles against styles.css.
 */
function themeEntries(doc, byId) {
  const rows = [];
  const byCollection = new Map(doc.collections.map((c) => [c.name, c]));

  for (const spec of P8_NAMESPACES) {
    if (spec.ns === "breakpoint") {
      // P8.4 — default-variant rows only, one per family, px -> rem at 16.
      const seen = new Map();
      for (const e of doc.breakpoints?.entries ?? []) {
        if ((e.layoutVariant ?? "default") !== "default") continue;
        if (typeof e.widthPx !== "number" || !Number.isFinite(e.widthPx)) continue;
        const prev = seen.get(e.family);
        if (prev != null && prev !== e.widthPx) {
          fail(`breakpoint family ${e.family} has two widths (${prev}, ${e.widthPx})`);
        }
        seen.set(e.family, e.widthPx);
      }
      for (const [family, px] of [...seen].sort((a, b) => a[1] - b[1])) {
        rows.push({
          ns: "breakpoint",
          key: `--breakpoint-${family}`,
          value: `${num(px / 16)}rem`,
          note: `${num(px)}px — Figma ${family} device width`,
          source: `breakpoints.entries ${family}`,
        });
      }
      continue;
    }

    const c = spec.collection ? byCollection.get(spec.collection) : null;
    if (spec.collection && !c) fail(`P8: collection ${spec.collection} not in export`);
    if (!c) continue; // reset-only namespace (shadow, leading)

    const vars = [...c.variables].sort((a, b) => cmp(webName(a), webName(b)));
    for (const v of vars) {
      const name = webName(v);
      if (spec.group && !name.startsWith(`--${spec.group}-`)) continue;
      const key = `--${spec.ns}-${P8_LEAF(name, spec.group)}`;
      if (rows.some((r) => r.key === key)) fail(`P8: duplicate @theme key ${key}`);

      // P8.2 — var(token) normally; the literal when key === token name,
      // because that would otherwise be a self-reference cycle that computes
      // to nothing. See the policy header for the measurements behind both.
      let value = `var(${name})`;
      let note = null;
      if (key === name) {
        const dm = v.modes.find((m) => m.modeId === c.defaultModeId) ?? v.modes[0];
        value = resolveValue(v, dm, byId).value;
        note = `literal, not var(${name}): same-name cycle (P8.2)`;
      }
      rows.push({ ns: spec.ns, key, value, note, source: `${c.name}/${name}` });
    }
  }
  return rows;
}

function themeCss(doc, rows, cfg) {
  const lines = [];
  for (const spec of P8_NAMESPACES) {
    const mine = rows.filter((r) => r.ns === spec.ns);
    lines.push(
      "",
      `  /* --- ${spec.ns} ${"-".repeat(Math.max(0, 54 - spec.ns.length))} */`,
      ...(spec.note ? [`  /* ${spec.note} */`] : []),
      `  --${spec.ns}-*: initial;`,
      ...mine.map((r) => `  ${r.key}: ${r.value};${r.note ? ` /* ${r.note} */` : ""}`),
    );
  }

  const header = [
    "/* GENERATED FILE — DO NOT EDIT BY HAND.",
    "",
    "   The Tailwind v4 namespace bridge: house/Figma names as `@theme` keys, so",
    "   every generated utility speaks house vocabulary and Tailwind's own default",
    "   scale is reset away. Policy P8 (suffix rule, values, resets, breakpoints,",
    "   hand-authored reconciliation) is documented at the top of",
    "   scripts/ds-from-handoff.mjs; the name-by-name status of every hand-authored",
    `   \`@theme\` entry is in ${cfg.paths.report} §9.`,
    "",
    `   Source:   ${doc.artifactFilename ?? doc.documentName ?? "design-system handoff export"}`,
    `   Schema:   ${doc.schema} v${doc.schemaVersion}`,
    `   Exported: ${doc.generatedAt}`,
    `   State:    ${doc.fingerprint.designSystemStateHash}`,
    "",
    "   Regenerate with:  node scripts/ds-from-handoff.mjs",
    "",
    "   NOT reset here, each for a stated reason (P8.3):",
    ...P8_HELD.map(([k, why]) => `     ${k} — ${why}`),
    "*/",
    "",
    "@theme inline {",
  ].join("\n");

  return `${header}${lines.join("\n")}\n}\n`;
}

// --- reconciliation report -------------------------------------------------

function report(doc, rows, handNames, handScoped, themeRows, handDeclared,
                privateRows = [], hiddenRows = [], excludedRows = []) {
  const by = (s) => rows.filter((r) => r.status === s);
  const drift = by("VALUE-DRIFT");
  const match = by("MATCH");
  const onlyExport = by("NAME-ONLY-IN-EXPORT");
  const unconverted = rows.filter((r) => r.unconverted).sort((a, b) => cmp(a.name, b.name));
  const scopedOnly = [...handScoped].filter((n) => rows.some((r) => r.name === n)).sort(cmp);
  const colourSuppressed = rows.filter(
    (r) => /^(color|color-primitives)$/.test(r.collection) && r.status !== "NAME-ONLY-IN-EXPORT",
  );
  const layout = layoutBreakpoints(doc);
  const { widths, variants } = layout;
  const codeNameChanged = doc.changes?.variables?.codeNameChanged ?? [];

  const dimension = rows.filter((r) => /^--dimension-/.test(r.name)).sort((a, b) => cmp(a.name, b.name));
  const zeroUsage = rows.filter((r) => r.usage === 0).sort((a, b) => cmp(a.name, b.name));
  const unresolvedAlias = rows.filter((r) => r.unresolvedAlias);
  const styleSummary = (doc.styleSummaries ?? [])
    .map((s) => `| ${s.type} | ${s.styleCount} | ${(s.groups ?? []).map((g) => g.name).join(", ") || "—"} |`)
    .join("\n");

  return `# ds-from-handoff — reconciliation report

GENERATED FILE — regenerate with \`node scripts/ds-from-handoff.mjs\`.

| | |
| --- | --- |
| Export | \`${doc.artifactFilename ?? doc.documentName}\` |
| Schema | ${doc.schema} v${doc.schemaVersion} |
| Exported at | ${doc.generatedAt} |
| designSystemStateHash | \`${doc.fingerprint.designSystemStateHash}\` |
| Tokens in export | ${rows.length} |
| MATCH (hand-authored, same value) | ${match.length} |
| VALUE-DRIFT (hand-authored, different value) | ${drift.length} |
| NAME-ONLY-IN-EXPORT (newly generated) | ${onlyExport.length} |
| NAME-ONLY-IN-HAND (in styles.css, not in export) | see §4 |
| PRIVATE (hidden, but an alias target of a published token — emitted) | ${privateRows.length} |
| HIDDEN (hidden and unreachable — not emitted) | ${hiddenRows.length} |
| EXCLUDED (\`EXCLUDE_PATHS\` policy list — not emitted) | ${excludedRows.length} |

Statuses compare the export's **default mode** against the value declared in
\`src/styles.css\`. Anything with a hand-authored declaration is reported here but
**not** emitted into \`src/tokens.generated.css\` — hand-authored wins (policy P2).
PRIVATE, HIDDEN and EXCLUDED variables (policy P7, §0) are never counted in
MATCH/VALUE-DRIFT/NAME-ONLY-IN-EXPORT — they are not public design-system
tokens. Of the three, **only PRIVATE is emitted**, because published tokens
alias it and a referenced-but-undeclared custom property is invalid at
computed-value time.

## 0. PRIVATE (${privateRows.length}), HIDDEN (${hiddenRows.length}) and EXCLUDED (${excludedRows.length})

Not public tokens, and excluded from every other class in this report (policy P7
in \`scripts/ds-from-handoff.mjs\`). Operator ruling 2026-09-06: *"i don't publish
the color primitives because only semantic colors should be used in layout but
the primitive color are alias's in semantic colors"*.

**PRIVATE** — hidden in Figma, but reachable by alias from a published token, so
they **are** emitted (same names, fenced in a marked block). Not publishing a
primitive in Figma means *"don't pick this in a layout"*; it does not mean the
value is unused. CSS has no such distinction — dropping these would leave the
semantic tokens that reference them invalid at computed-value time. Reference the
semantic token in the "Aliased by" column, never the private name.

${privateRows.length
  ? ["| Name | Collection | Value | Aliased by |", "| --- | --- | --- | --- |",
     ...[...privateRows].sort((a, b) => cmp(a.name, b.name)).map(
       (r) => `| \`${r.name}\` | ${r.collection} | \`${r.value}\` | ${r.aliasedBy.map((n) => `\`${n}\``).join(", ") || "—"} |`)].join("\n")
  : "None."}

**HIDDEN** — marked \`hiddenFromPublishing\` / \`effectivelyHiddenFromPublishing\`
in the export **and** unreachable by alias from anything emitted. Nothing refers
to them, so they are safely dropped. This is the durable signal: once Figma marks
a variable hidden and nothing aliases it, it lands here with no generator change.

${hiddenRows.length
  ? ["| Name | Collection |", "| --- | --- |",
     ...[...hiddenRows].sort((a, b) => cmp(a.name, b.name)).map((r) => `| \`${r.name}\` | ${r.collection} |`)].join("\n")
  : "None."}

**EXCLUDED** — matched an \`EXCLUDE_PATHS\` prefix. A policy list applied wholesale
on path identity, regardless of hidden state, and never revived by reachability.
\`.utility/\` is durable (*".utility ignore all together"*);
\`layout/grid/aspect/\` is interim — remove it once Figma marks those hidden.

${excludedRows.length
  ? ["| Name | Collection | Reason |", "| --- | --- | --- |",
     ...[...excludedRows].sort((a, b) => cmp(a.name, b.name)).map((r) => `| \`${r.name}\` | ${r.collection} | ${r.reason} |`)].join("\n")
  : "None."}

## 1. core/dimension parity

${["| Token | Export | styles.css | Status |", "| --- | --- | --- | --- |",
  ...dimension.map((r) => `| \`${r.name}\` | \`${r.generated}\` | ${r.hand ? `\`${r.hand}\`` : "—" } | ${r.status} |`)].join("\n")}

## 2. VALUE-DRIFT (${drift.length})

${drift.length
  ? ["| Token | Collection | Export | styles.css |", "| --- | --- | --- | --- |",
     ...drift.sort((a, b) => cmp(a.name, b.name)).map((r) => `| \`${r.name}\` | ${r.collection} | \`${r.generated}\` | \`${r.hand}\` |`)].join("\n")
  : "None."}

## 3. MATCH (${match.length})

${match.length
  ? ["| Token | Collection | Value |", "| --- | --- | --- |",
     ...match.sort((a, b) => cmp(a.name, b.name)).map((r) => `| \`${r.name}\` | ${r.collection} | \`${r.generated}\` |`)].join("\n")
  : "None."}

## 4. NAME-ONLY-IN-HAND

Every \`--*\` declared in \`src/styles.css\` whose name is not a WEB name in the
export. These are composition-layer or product-layer properties (type-role
sizes, z-index, elevation, Tailwind \`@theme\` namespace aliases) with no Figma
variable behind them, plus the colour tokens styles.css names without the
export's \`color-\` prefix. Listed for the tidy follow-up, not changed here.

${(() => {
  const exportNames = new Set(rows.map((r) => r.name));
  const handOnly = [...handNames].filter((n) => !exportNames.has(n)).sort(cmp);
  return `${handOnly.length} names.\n\n${handOnly.map((n) => `- \`${n}\``).join("\n")}`;
})()}

## 5. Unresolved aliases (${unresolvedAlias.length})

${unresolvedAlias.length
  ? unresolvedAlias.map((r) => `- \`${r.name}\` — terminal value inlined`).join("\n")
  : "None. Every alias in the export resolves to a variable that is also in the export."}

## 6. UNCONVERTED (${unconverted.length})

Tokens where the export names a \`conversionStrategy\` it could not carry out,
so no \`convertedValue\` is published. The generator emits the raw source value
with an inline \`UNCONVERTED:\` comment — it does **not** invent the missing
divisor (P4).

${unconverted.length
  ? ["| Token | Collection | Strategy | buildUnit | Confidence | Emitted |", "| --- | --- | --- | --- | --- | --- |",
     ...unconverted.map((r) => `| \`${r.name}\` | ${r.collection} | ${r.unconverted.strategy} | ${r.unconverted.buildUnit ?? "—"} | ${r.unconverted.confidence} | \`${r.generated}\` |`)].join("\n")
  : "None."}

## 7. Layout modes — media queries (${widths.size ? "resolved" : "unresolved"})

The export's own \`breakpoints.entries\` (schema 6) states that layout's
sm/md/lg/xl and their flush / sidebar-main variants are **responsive layout
variants, never themes**, and publishes each mode's \`widthPx\` directly — the
generator no longer scans the collection for a \`device/width\` variable.

${widths.size
  ? `All ${widths.size} layout modes resolve to a width, so they are emitted as
mobile-first \`@media (min-width: …)\` blocks in ascending width order. The
second axis — \`layoutVariant\` — is a selector, not a width: \`default\` lands on
\`:root\`, every other variant on \`[data-jhd-layout-variant="<variant>"]\` inside
the same media block.

${["| Mode | Width | layoutVariant | Emitted as |", "| --- | --- | --- | --- |",
   ...(doc.collections.find((c) => c.name === "layout")?.modes ?? []).map((m) => {
     const variant = variants.get(m.id) ?? "default";
     const sel = variant === "default" ? ":root" : `[data-jhd-layout-variant="${variant}"]`;
     const base = m.id === layout.baseModeId ? ` (also the unconditional \`${sel}\` base)` : "";
     return `| \`${m.name}\` | ${num(widths.get(m.id))}px | ${variant} | \`@media (min-width: ${num(widths.get(m.id))}px) { ${sel} }\`${base} |`;
   })].join("\n")}

**P6 (2026-09-05, parent decision) — base moved from \`lg\` to \`sm\`:** the
unconditional base now seeds from the SMALLEST-width \`default\`-variant mode
(\`sm\`), not the collection's \`defaultModeId\` (\`lg\`). \`lg\` is now purely an
ascending \`@media (min-width)\` block like every other width, exactly the same
as \`md\`/\`xl\`. Superseded: the previous generator (schema 5, \`lg\` = collection
default) seeded the base from \`lg\`, so every layout token below \`lg\`'s width
silently fell back to \`lg\`'s value instead of \`sm\`'s — inverting mobile-first.
Viewports narrower than the smallest published sample (\`sm\`) still resolve to
\`sm\`'s value; there is no published design intent below that width.`
  : `The export does not publish a resolvable width for every layout mode in
\`breakpoints.entries\`, so the generator keeps the \`[data-jhd-layout-mode="…"]\`
placeholder rather than guessing breakpoints. **Open question 1 stays open.**`}

## 8. Hand-authored but SCOPED (${scopedOnly.length})

Names \`styles.css\` declares only inside a scoped or conditional block
(\`.dark\`, \`@media\`, \`@supports\`, \`@utility\`) and never globally. A scoped
declaration cannot supersede the token everywhere, so it does **not** suppress
generation — the generated global declaration is what the scoped one overrides.

${scopedOnly.length ? scopedOnly.map((n) => `- \`${n}\``).join("\n") : "None."}

## 9. P8 — Tailwind namespace reconciliation

\`src/theme.generated.css\` emits ONE \`@theme\` block: a \`--<namespace>-*: initial\`
reset per namespace the house populates, then house-keyed entries whose suffixes
come from the export's own WEB names (P8.1). P2 does **not** apply to that file —
a namespace reset is only true if the whole namespace is emitted in one place, so
P8 always emits the full namespace and this section is how the hand-authored
\`@theme\` entries in \`src/styles.css\` are settled against it.

**GENERATED-EQUIVALENT** — byte-equal to what P8 emits. The operator ruling of
2026-09-06 is *generated wins*, so these are **deleted from styles.css** and no
computed value changes. **VALUE-DRIFT** — same key, different value: styles.css
keeps it (it overrides the generated entry, being later in the cascade) and the
disagreement needs its own ruling. **HAND-ONLY** — a key P8 does not emit at all,
because the export has no variable behind it.

${(() => {
  const namespaces = [...new Set(themeRows.map((r) => r.ns))];
  const inNs = (k) => namespaces.find((ns) => k.startsWith(`--${ns}-`));
  const gen = new Map(themeRows.map((r) => [r.key, r.value]));
  const hand = [...handDeclared].filter(([k]) => inNs(k)).sort((a, b) => cmp(a[0], b[0]));
  const cls = (k, v) => (!gen.has(k) ? "HAND-ONLY" : gen.get(k) === v ? "GENERATED-EQUIVALENT" : "VALUE-DRIFT");
  const counts = { "GENERATED-EQUIVALENT": 0, "VALUE-DRIFT": 0, "HAND-ONLY": 0 };
  const table = hand.map(([k, v]) => {
    const c = cls(k, v);
    counts[c] += 1;
    return `| \`${k}\` | ${inNs(k)} | ${gen.has(k) ? `\`${gen.get(k)}\`` : "—"} | \`${v}\` | ${c} |`;
  });
  const summary = Object.entries(counts).map(([c, n]) => `${c}: ${n}`).join(" · ");
  return `${themeRows.length} generated \`@theme\` keys across ${namespaces.length} namespaces.
${hand.length} hand-authored \`@theme\` entries fall inside those namespaces — ${summary}.

${table.length ? ["| Key | Namespace | P8 emits | styles.css | Status |", "| --- | --- | --- | --- | --- |", ...table].join("\n") : "None."}

### Namespaces NOT reset (P8.3)

${["| Namespace | Why it is held |", "| --- | --- |", ...P8_HELD.map(([k, why]) => `| \`${k}\` | ${why} |`)].join("\n")}

### Breakpoints emitted (P8.4)

${["| Key | Value | Figma |", "| --- | --- | --- |",
   ...themeRows.filter((r) => r.ns === "breakpoint").map((r) => `| \`${r.key}\` | \`${r.value}\` | ${r.note} |`)].join("\n")}

Tailwind's own \`sm\` 640 / \`md\` 768 / \`lg\` 1024 / \`xl\` 1280 / \`2xl\` 1536 are gone
with the reset. \`2xl\` has no replacement because Figma publishes no fifth device
width. The \`flush\` and \`sidebar-main\` rows in \`breakpoints.entries\` are layout
VARIANTS, not breakpoints: they share their family's width and are selected by
\`[data-jhd-layout-variant]\` (P3), so bridging them here would invent duplicate
widths.`;
})()}

## Appendix A — zero-usage tokens (${zeroUsage.length})

Generated anyway, per the operator ruling of 2026-09-05 (all collections,
superseding the 2026-07-26 used-only rule).

${zeroUsage.length ? zeroUsage.map((r) => `- \`${r.name}\` (${r.collection})`).join("\n") : "None."}

## Appendix C — codeNameChanged (${codeNameChanged.length})

Schema 6's \`changes.variables.codeNameChanged\` — variables whose emitted WEB
name changed since the export's diff baseline, its own class distinct from
renamed/valueChanged/aliasRetargeted (a name change is a breaking change for
every consumer that binds to it by string; a value or alias change is not).
Reported as its own class, not merged into MATCH/VALUE-DRIFT/NAME-ONLY-IN-EXPORT.

${codeNameChanged.length
  ? codeNameChanged.map((c) => `- \`${JSON.stringify(c)}\``).join("\n")
  : "None."}

## Appendix B — styles (not generated this slice)

Typography/paint classes are out of scope for this slice; this is the summary
the export publishes, so the follow-up knows what it is taking on.

${["| Type | Styles | Groups |", "| --- | --- | --- |", styleSummary].join("\n")}

## Open questions for the operator

1. **Layout modes — CLOSED by schema 5, base fixed by P6 (schema 6).**
   \`breakpoints.entries\` publishes resolvable widths + \`layoutVariant\` per
   mode, so the generator emits real media queries (§7) instead of the
   \`[data-jhd-layout-mode="…"]\` placeholder. P6 (2026-09-05) additionally moves
   the unconditional base from the collection's default mode (\`lg\`) to the
   smallest-width \`default\`-variant mode (\`sm\`) — see §7. Nothing left to
   decide unless the widths themselves are wrong.
2. **Unresolved units — CLOSED by schema 5, final value CLOSED by schema 6.**
   Every FLOAT mode now carries a \`build\` cell (\`units.policy\` v4), so
   \`core/border/*\` emits \`px\`, opacity emits a fraction, effect blur emits
   \`px\`, and grid columns emit unitless — verbatim from the export, no
   generator-side scope heuristic. The residue is §6 UNCONVERTED: ${unconverted.length}
   \`divide-by-associated-font-size\` tokens (letter-spacing) that need a font
   size the export does not carry for a standalone variable. Should the export
   publish an associated font size for these, or should they stay raw px?
3. **Colour name prefix — CLOSED by schema 5.** \`policies.naming\` v3 drops the
   \`color-\` prefix, so the export's WEB names now match the hand-authored ones
   exactly (\`--background-default-primary\`). ${colourSuppressed.length} colour tokens
   therefore flip from NAME-ONLY-IN-EXPORT (emitted, prefixed) to hand-authored
   collisions that are skipped under P2 — no computed value changes; the tidy
   follow-up simply has one naming question fewer.
4. **Easing drift.** \`--easing-power2-out\` is
   \`cubic-bezier(0.215, 0.61, 0.355, 1)\` in Figma vs
   \`cubic-bezier(0.22, 0.61, 0.35, 1)\` in \`styles.css\`. Adopt Figma's, or
   correct Figma?
`;
}

// --- entry points ----------------------------------------------------------

/**
 * The public entry: pure, no filesystem. `config` is a plain object (see
 * `presets/` for a worked example); `handAuthoredCss` is the consumer's own
 * stylesheet, whose GLOBAL custom properties win the cascade (policy P2).
 */
export function generate(doc, config, { handAuthoredCss = "" } = {}) {
  const { declared: handDeclared, scoped: handScoped } = readHandAuthored(handAuthoredCss);
  const { css, rows, privateRows, hiddenRows, excludedRows } = tokensFor(doc, handDeclared, config);

  const byId = new Map();
  for (const c of doc.collections) for (const v of c.variables) byId.set(v.id, v);
  const themeRows = themeEntries(doc, byId);
  const theme = themeCss(doc, themeRows, config);

  const md = report(doc, rows, new Set(handDeclared.keys()), handScoped, themeRows, handDeclared,
                    privateRows, hiddenRows, excludedRows);

  // Single source of truth for a downstream conformance checker (P7): it must
  // not maintain its own copy of the exclude list or re-derive either list.
  //
  // `names`   — EXCLUDED. Not derivable from the export: the exclude list is a
  //             consumer-side policy with no signal in the export.
  // `private` — hidden but alias-reachable, so PRESENT in the CSS under its own
  //             name while NOT being a public token. Without this list a
  //             checker reading `hiddenFromPublishing` off the export would
  //             report every one as EXTRA (they are in the CSS) — and a checker
  //             reading the CSS alone would report them as public MATCHes. They
  //             are neither: they are PRIVATE.
  //
  // Plain HIDDEN names are still absent here on purpose — the checker can and
  // should read `hiddenFromPublishing` / `effectivelyHiddenFromPublishing`
  // straight off the same export it already consumes.
  const exclusionsJson = `${JSON.stringify(
    {
      generatedAt: doc.generatedAt,
      designSystemStateHash: doc.fingerprint.designSystemStateHash,
      policy: "P7 — see scripts/ds-from-handoff.mjs. `names` = EXCLUDED (never emitted); `private` = hidden but alias-reachable (emitted, not public).",
      excludePaths: EXCLUDE_PATHS,
      names: [...excludedRows].map((r) => r.name).sort(cmp),
      private: [...privateRows].map((r) => r.name).sort(cmp),
    },
    null,
    2,
  )}\n`;

  return {
    tokensCss: css,
    themeCss: theme,
    report: md,
    exclusionsJson,
    rows,
    themeRows,
    privateRows,
    hiddenRows,
    excludedRows,
    warnings: [],
  };
}

function parseArgs(argv, defaults) {
  const opts = { ...defaults, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--check") opts.check = true;
    else if (a === "--config") i += 1; // resolved by the CLI before `run`
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      if (!(key in defaults)) fail(`unknown flag ${a}`);
      opts[key] = argv[++i] ?? fail(`${a} needs a value`);
    } else fail(`unexpected argument ${a}`);
  }
  return opts;
}

/**
 * The filesystem boundary: read the export + hand-authored stylesheet, call
 * `generate`, write (or `--check`) the four artifacts. Paths in `config.paths`
 * are relative to `cwd`; CLI flags override them.
 */
export function run(argv = [], { cwd = process.cwd(), config } = {}) {
  const opts = parseArgs(argv, config.paths);
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));

  const doc = JSON.parse(readFileSync(abs(opts.input), "utf8"));
  const handAuthoredCss = readFileSync(abs(opts.handAuthored), "utf8");
  const out = generate(doc, config, { handAuthoredCss });

  const write = (p, contents) => {
    const target = abs(p);
    if (opts.check) {
      let current = null;
      try {
        current = readFileSync(target, "utf8");
      } catch {
        /* missing */
      }
      if (current !== contents) {
        process.stderr.write(`handoff-css: ${p} is out of date — run the generator\n`);
        process.exitCode = 1;
      }
      return;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };

  write(opts.out, out.tokensCss);
  write(opts.theme, out.themeCss);
  write(opts.report, out.report);
  write(opts.exclusions, out.exclusionsJson);

  // Legacy field names kept alongside the new ones so an existing consumer's
  // tests keep reading `css`/`theme`/`md`.
  return { ...out, css: out.tokensCss, theme: out.themeCss, md: out.report, opts };
}
