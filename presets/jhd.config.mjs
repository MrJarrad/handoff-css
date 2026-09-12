// JHD house policy for handoff-css.
//
// Nothing in `src/` names a JHD collection, theme, selector attribute, path or
// operator ruling — it all arrives through this object, so the package itself
// stays a generic Design Handoff consumer. `schema/config.schema.json`
// validates the shape; `test/config.test.mjs` asserts this file against it.
export default {
  // Which export contract this consumer has vendored and read.
  schema: {
    name: "design-system-handoff",
    versions: ["7", "8", "9", "10", "11", "12", "13"],
  },

  // Every path is relative to the consuming repo root.
  paths: {
    input: "design/handoff/latest/jhd-spec-designsystem-design-system-handoff.json",
    out: "src/tokens.generated.css",
    theme: "src/theme.generated.css",
    // P21 — one class per Figma style, from schema 12's `cssClass`. This is
    // what lets the design system stop hand-authoring its type utilities.
    styles: "src/styles.generated.css",
    report: "design/generated/ds-from-handoff-report.md",
    handAuthored: "src/styles.css",
    exclusions: "design/generated/exclusions.json",
  },

  // P7 — the EXCLUDED policy list, matched against `"<collection>/<variable>"`.
  // Applied wholesale on path identity: hidden state is irrelevant, and
  // reachability never revives an entry.
  //
  //   `.utility/`           durable. Operator ruling 2026-09-06: ".utility ignore
  //                         all together" — a Figma authoring scratch collection.
  //   `layout/grid/aspect/` durable as an EXCLUSION, and deliberately READ by P20.
  //                         Operator ruling 2026-09-06: "we didn't bring in aspect
  //                         ratio related variables like portrait, tall and
  //                         landscape. They are just figma hacks because i can
  //                         actually add an aspect ratio." Ruling 2026-09-12 row 6
  //                         adds the other half: "figma has no concept of aspect
  //                         ratios, I tend to just use the col-span as the height".
  //                         The per-col-span heights are the hack and never become
  //                         tokens. As of export v11 the ratio itself is authored
  //                         properly, as the `core/aspect/*` STRING variables, so
  //                         P20 publishes THOSE and reads this group only to
  //                         cross-check its descriptions against them. Excluding a
  //                         group and reading it is not a contradiction: P7 governs
  //                         what is emitted, and a stale description here is a real
  //                         finding about the design file.
  exclude: {
    paths: ["layout/grid/aspect/", ".utility/"],
  },

  // The package's existing CSS convention: `#rrggbb` at full alpha, otherwise
  // `rgb(r g b / <pct>)`. (`hex8` emits the export's 8-digit hex verbatim.)
  color: {
    format: "rgb-slash-percent",
  },

  // P19 — MOTION. Operator ruling 2026-09-12 row 2 ("should the name reflect
  // the time?" -> yes): the steps are named for their milliseconds in Figma, so
  // the value has to read in milliseconds too. Figma stores TIMING in seconds.
  //
  // Ruling row 4 ("why wouldn't we have delay values") gives delays their own
  // ramp, every step of which is a FIGMA ALIAS of the duration step of the same
  // value so the two can never drift. `delayAliasOf` names the two groups so
  // the generator can REPORT a step that is a literal copy instead
  // (DELAY_NOT_ALIASED). It never rewrites one: pairing delay to duration by
  // value here would look identical today and silently overwrite the first
  // delay step that legitimately differs. Stagger is index x step in code.
  motion: {
    timingUnit: "ms",
    delayAliasOf: { delay: "motion/delay/", duration: "motion/duration/" },
  },

  // P20 — ASPECT RATIOS. Figma has no aspect-ratio TYPE, but it has STRING
  // variables, and `core/aspect/{landscape,portrait,square,tall}` now hold
  // "3:2" / "4:5" / "1:1" / "2:3" (export v11). They are ordinary published
  // variables carrying their own `--aspect-<name>` WEB names, so nothing is
  // derived: this only says they are ratios, so `3:2` renders as the CSS value
  // `3 / 2` rather than the quoted string `"3:2"`.
  //
  // `descriptionGroup` is a CROSS-CHECK, never a source. Operator ruling
  // 2026-09-12 row 6: *"figma has no concept of aspect ratios, I tend to just
  // use the col-span as the height"* — those per-col-span heights stay EXCLUDED
  // (see `exclude.paths` above) and still describe the ratio they were computed
  // from, so a description that contradicts the authored variable means a
  // designer is reading a stale number off the wrong one.
  aspect: {
    ratioPaths: ["core/aspect/"],
    descriptionGroup: "layout/grid/aspect/",
    // "Ratio – 3/2, 3:2" — the fraction is the authoritative half; the `a:b`
    // restatement after the comma is prose.
    descriptionPattern: "^Ratio\\s*[\u2013\u2014-]\\s*(\\d+(?:\\.\\d+)?)\\s*/\\s*(\\d+(?:\\.\\d+)?)",
  },

  // P3/P6 — the responsive collection: which one it is, how its non-default
  // layout variants are selected, and which mode seeds the unconditional base.
  layout: {
    collection: "layout",
    variantAttribute: "data-jhd-layout-variant",
    baseMode: "smallest-default-variant",
  },

  // P3 — the fallback selector for a multi-mode collection the export
  // publishes no width or theme semantics for (`icon`, `action`).
  modes: {
    collectionModeAttribute: "data-jhd-{collection}-mode",
  },

  // P10 — TOTAL themes. While `.bttf` is on the document root a nested `.dark`
  // (a per-media or per-section ground mode) must not re-point tokens back to
  // dark's values: proximity should not beat the root theme. Lock rows 3 & 7,
  // 2026-09-09: bttf "replaces light and dark entirely".
  themes: {
    // Which collection's modes are themes if a future export stops publishing
    // the `isTheme` flag on `breakpoints.entries` (P9.1's fallback gate).
    collection: "color",
    total: ["bttf"],
  },

  // P8 — the Tailwind v4 namespace bridge. `group` is the token-name segment
  // the namespace claims, so `--easing-power2-out` lands as `--ease-power2-out`
  // while `--radius-300` is not `--radius-radius-300`. `held` namespaces are
  // deliberately NOT reset, each with its blocker.
  tailwind: {
    namespaces: [
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
      { ns: "breakpoint", collection: null, from: "breakpoints",
        note: "from breakpoints.entries (P8.4)" },
    ],
    held: [
      ["--spacing", "Tailwind derives numeric spacing from one multiplier, not a suffix namespace — nothing to reset or populate. `p-4` still compiles by design."],
      ["--font-weight-*", "action-base still `@apply font-medium` (separate lane); text-primitives publishes weight/strong as the STRING \"Medium\"."],
      ["--text-*", "The hand-authored 050–1700 ramp in styles.css is the blocker: its per-step letter-spacing modifiers have no export equivalent, so a reset would drop them. (`badge-base` no longer `@apply`s `text-xs` as of #18, but `font-medium` still survives in `action-base`.)"],
      ["--z-index-*", "Tailwind resolves `z-<number>` as a BARE value, not through the namespace, so a reset removes nothing and `z-10` compiles either way. The export also has no z collection to populate it from; styles.css's hand-authored --z-index-base…toast scale stays authoritative."],
    ],
    // null -> read the export's own `units.policy.rootFontSizePx`.
    rootFontSizePx: null,
  },

  // P11 — which responsive classes may change what is emitted.
  //
  // Operator ruling 2026-09-12 ("Responsive strategy"): *"let's follow what
  // the plugin suggests."* Every variable's `responsiveBehavior.rules[]`
  // states, per `layoutVariant`, a strategy the plugin chose from the
  // breakpoint samples' fit within tolerance — `fluid-clamp` (with a ready
  // `css: clamp(...)`), `fixed`, `mode-stepped`, or a viewport fraction. This
  // preset un-holds `fluid-clamp` and `fixed` (0.4.2, superseding the 0.3.x
  // HELD note below): code binds the token and never recomputes or
  // second-guesses the plugin's own choice. Effect: the grid margins/paddings
  // that went stepped in the W3a rebind come back fluid wherever the plugin
  // says `fluid-clamp`.
  //
  //   `mode-stepped` / `sample-only` ARE the per-mode default path; listing
  //                  them would change nothing either way.
  responsive: {
    honourClasses: ["viewport-height", "viewport-width", "fluid-clamp", "fixed"],
  },

  // P11 — the viewport rule. `device/*` is the group the house declares
  // viewport-relative; a member with no `responsive` field and no
  // "N% of screen height|width" description stays px and is reported.
  viewport: {
    heightUnit: "dvh",
    widthUnit: "vw",
    descriptionFallback: true,
    groups: ["device/"],
  },

  // P12 — the two house alias hops that were hand-authored in
  // `DS/src/styles.css` (~782-799), now expanded from the emitted leaves.
  aliases: {
    "--screen-height-*": "--device-screen-height-*",
    "--height-screen-*": "--screen-height-*",
  },

  report: {
    title: "ds-from-handoff — reconciliation report",
    // Where the human-readable policy write-up lives in the consuming repo.
    policyRef: "scripts/ds-from-handoff.mjs",
    // §1 is a spot-check on the one scale consumers bind most often.
    parity: { title: "core/dimension parity", namePrefix: "--dimension-" },
    // Collections that carry colour, for open question 3.
    colourCollections: ["color", "color-primitives"],
    // Every string below is a HOUSE statement, not generator mechanics.
    notes: {
      private: `Operator ruling 2026-09-06: *"i don't publish
the color primitives because only semantic colors should be used in layout but
the primitive color are alias's in semantic colors"*.`,
      excluded: `\`.utility/\` is durable (*".utility ignore all together"*);
\`layout/grid/aspect/\` is interim — remove it once Figma marks those hidden.`,
      nameOnlyInHand: `These are composition-layer or product-layer properties (type-role
sizes, z-index, elevation, Tailwind \`@theme\` namespace aliases) with no Figma
variable behind them, plus the colour tokens styles.css names without the
export's \`color-\` prefix. Listed for the tidy follow-up, not changed here.`,
      layoutModes: `The export's own \`breakpoints.entries\` (schema 6) states that layout's
sm/md/lg/xl and their flush / sidebar-main variants are **responsive layout
variants, never themes**, and publishes each mode's \`widthPx\` directly — the
generator no longer scans the collection for a \`device/width\` variable.`,
      baseMode: `**P6 (2026-09-05, parent decision) — base moved from \`lg\` to \`sm\`:** the
unconditional base now seeds from the SMALLEST-width \`default\`-variant mode
(\`sm\`), not the collection's \`defaultModeId\` (\`lg\`). \`lg\` is now purely an
ascending \`@media (min-width)\` block like every other width, exactly the same
as \`md\`/\`xl\`. Superseded: the previous generator (schema 5, \`lg\` = collection
default) seeded the base from \`lg\`, so every layout token below \`lg\`'s width
silently fell back to \`lg\`'s value instead of \`sm\`'s — inverting mobile-first.
Viewports narrower than the smallest published sample (\`sm\`) still resolve to
\`sm\`'s value; there is no published design intent below that width.`,
      generatedEquivalent: `The operator ruling of
2026-09-06 is *generated wins*, so these are **deleted from styles.css** and no
computed value changes.`,
      breakpointNote: `Tailwind's own \`sm\` 640 / \`md\` 768 / \`lg\` 1024 / \`xl\` 1280 / \`2xl\` 1536 are gone
with the reset. \`2xl\` has no replacement because Figma publishes no fifth device
width. The \`flush\` and \`sidebar-main\` rows in \`breakpoints.entries\` are layout
VARIANTS, not breakpoints: they share their family's width and are selected by
\`[data-jhd-layout-variant]\` (P3), so bridging them here would invent duplicate
widths.`,
      zeroUsage: `Generated anyway, per the operator ruling of 2026-09-05 (all collections,
superseding the 2026-07-26 used-only rule).`,
      styles: `Typography/paint classes are out of scope for this slice; this is the summary
the export publishes, so the follow-up knows what it is taking on.`,
      openQuestions: `1. **Layout modes — CLOSED by schema 5, base fixed by P6 (schema 6).**
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
   generator-side scope heuristic. The residue is §6 UNCONVERTED: {{unconverted}}
   \`divide-by-associated-font-size\` tokens (letter-spacing) that need a font
   size the export does not carry for a standalone variable. Should the export
   publish an associated font size for these, or should they stay raw px?
3. **Colour name prefix — CLOSED by schema 5.** \`policies.naming\` v3 drops the
   \`color-\` prefix, so the export's WEB names now match the hand-authored ones
   exactly (\`--background-default-primary\`). {{colourSuppressed}} colour tokens
   therefore flip from NAME-ONLY-IN-EXPORT (emitted, prefixed) to hand-authored
   collisions that are skipped under P2 — no computed value changes; the tidy
   follow-up simply has one naming question fewer.
4. **Easing drift.** \`--easing-power2-out\` is
   \`cubic-bezier(0.215, 0.61, 0.355, 1)\` in Figma vs
   \`cubic-bezier(0.22, 0.61, 0.35, 1)\` in \`styles.css\`. Adopt Figma's, or
   correct Figma?`,
    },
  },

  header: {
    regenerateCommand: "node scripts/ds-from-handoff.mjs",
  },
};
