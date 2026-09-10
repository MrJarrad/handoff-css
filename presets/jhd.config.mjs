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
    versions: ["7"],
  },

  // Every path is relative to the consuming repo root.
  paths: {
    input: "design/handoff/latest/jhd-spec-designsystem-design-system-handoff.json",
    out: "src/tokens.generated.css",
    theme: "src/theme.generated.css",
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
  //   `layout/grid/aspect/` INTERIM, pending Figma marking these hidden. Operator
  //                         ruling 2026-09-06: "we didn't bring in aspect ratio
  //                         related variables like portrait, tall and landscape.
  //                         They are just figma hacks because i can actually add
  //                         an aspect ratio."
  exclude: {
    paths: ["layout/grid/aspect/", ".utility/"],
  },

  // The package's existing CSS convention: `#rrggbb` at full alpha, otherwise
  // `rgb(r g b / <pct>)`. (`hex8` emits the export's 8-digit hex verbatim.)
  color: {
    format: "rgb-slash-percent",
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

  // Consumed from 0.2.0 (the viewport rule and the alias block); declared here
  // so the house answer is recorded in one place rather than two.
  viewport: {
    heightUnit: "dvh",
    widthUnit: "vw",
    descriptionFallback: true,
    groups: ["device/"],
  },
  aliases: {},

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
