---
schema: design-handoff
schemaVersion: 13
contract: layer-brief/1
lane: selection/design
generatedAt: "2026-11-09T13:56:40.731Z"
exportVersion: 1
documentName: "Example"
pageName: "Checkout"
figma:
  pageCount: 1
policies:
  fingerprint: 1
  naming: 3
  units: 5
  mode: 3
  responsive: 1
  typeRamp: 1
  contentHash: 1
fingerprint:
  designSystemStateHash: "aff249166cab0a29d7a5b31b937225fe09aec79f12eb39ab3b9e232bb91b91a1"
selectedNodes:
  - id: "20:1"
    name: "Card"
contentHash: "8c828900da237560abf5fd4eac8b3a6973a3babcc91fe1b4719a3fc35688cb44"
---

## Design handoff

**Artifact:** `design-handoff` schema v13 · compatibility `layer-brief/1` · lane `selection/design` · filename `design-handoff-example-checkout-card.md`
**Content hash:** `8c828900da237560abf5fd4eac8b3a6973a3babcc91fe1b4719a3fc35688cb44` · SHA-256 · policy v1 · canonical structured payload excludes generation metadata and changelog state


**Fingerprint:** current design-system state `aff249166cab0a29d7a5b31b937225fe09aec79f12eb39ab3b9e232bb91b91a1` · SHA-256 policy v1 · naming v3 · units v5 · mode v3 · responsive v1

**File:** [Example](https://figma.com/design/F) · 1 pages · **Page:** [Checkout](https://figma.com/design/F?node-id=1-0)

_Generated: 2026-11-09 13:56:40 UTC_

**Legend:** `$name` = variable · `⚠raw value` = unbound raw value · `⚠ placeholder` = placeholder copy · `†` = table note (token-swap, variant-only, row-wrap) · `◆instance of` = component instance (with #nodeId of source) · `props()` = component property values (`*` = overridden from default) · `#id` = node ID for Plugin API · `⊹absolute` = absolute positioned · `constraints()` = pinning (when not in auto-layout) · `col(S/N of M)` = grid-column: S / span N on M-col grid · `row(S/N)` = grid-row: S / span N · `aspect: $token (stable)` = same aspect-ratio across all breakpoints → use CSS `aspect-ratio`; `$token` references an aspect variable when available · `aspect: varies ($t1→$t2)` = ratio shifts across breakpoints → implement per-breakpoint dimensions · `justify:X` / `align:X` = flex/grid alignment · `scrollX` / `scrollY` / `scrollXY` = overflow scroll direction · `text-align:X` = text-align · `case:X` = text-transform · `decoration:X` = text-decoration · `decoration:X(style:… thickness:… offset:… skipInk:… color:…)` = full underline/strikethrough config — thickness/offset percentages are of font size (10% → 0.1em); percentages are the operator-authored contract, not token-bound · `truncate(N lines)` = text-overflow: ellipsis with max lines · `link(url)` = hyperlink destination · `🎭mask(type)` = clipping mask (clip-path / alpha-mask / luminance-mask) · `⚠mixed-styles` = text node with mixed inline formatting (needs `<span>` sub-ranges) · `👁hidden` = not visible · `🖼` = image fill (with scaleMode) · `🎬` = video fill · `📝` = annotation · `spacer(edge:start|edge:end|edge:both|mid)` = Spacer position among visible siblings · `🎞` = animation style · `⏱` = keyframe track · `[→]` = node link · `semantic(<tag>)` = authored HTML element (designer wrote `semantic(<tag>)` in description) · `~semantic(<tag>)` = inferred HTML element (from naming, structure, or interactions) · `⚠semantic-invalid(reason)` = authored directive with invalid nesting · `~semantic-rejected(<tag>; reason)` = rejected inference; do not use that tag · `states(:hover, :focus, …)` = CSS pseudo-class states available as component variants · `interactive(click, hover)` = node has prototype interactions → needs interactive HTML element · `position(sticky)` / `position(fixed)` = positioning hint from description · `@container` = container query hint from description · `a11y(…)` = accessibility attribute from description (aria-*, role) · `desc("…")` = designer description note

**How to use this brief:**
1. **Screenshots are visual ground truth** — match them before consulting the layer tree
2. **Understand frame groups** — full-page frames contain the complete design; viewport-state frames show scroll positions for reference only
3. **Use components, don't rebuild them** — instantiate from the component index by name with the right props
4. **Follow variable bindings** — use `$token` values, never hardcode a matching raw value; `⚠raw` flags values that should be bound; `⚠ placeholder` flags placeholder copy
5. **Recreate top-down** — frame → auto-layout sections → component instances → details
6. **Ignore** — viewport state frames (reference only), `👁hidden` layers, computed fill/hug dimensions
7. **Cite by node ID** — use `#id` references (stable across exports), not line numbers (which drift)
8. **Responsive implementation** — pixel dimensions are reference only; implement using grid placement (`col(start/span of total)`), flex/fill sizing, and aspect ratios. When the grid table Notes column shows `aspect: R (stable)`, use `aspect-ratio: R` in CSS and let height be intrinsic. When it shows `aspect: varies`, set explicit dimensions per breakpoint instead. The Variable Tokens section shows how values change across modes
9. **Semantic HTML** — `semantic(<tag>)` is an authored directive (designer-specified in description); `~semantic(<tag>)` is an inferred hint (from naming or structure — treat as guidance, not requirement). When `~semantic(<ul>)` is inferred, its children carry `~semantic(<li>)`. Use `interactive()` to identify elements that need event handling; use `states()` to implement CSS pseudo-class variants
10. **Accessibility** — honour `a11y()` attributes from designer descriptions; use `semantic()` and `~semantic()` tags for correct ARIA roles; interactive elements without `semantic(<button>)` or `semantic(<a>)` still need `role` and keyboard handling
11. **Description conventions** — `position(sticky/fixed)` and `@container` hints come from designer descriptions and should be implemented directly; `desc()` is a designer note for build context

**Design system handoff:**
- No last-known companion metadata found. Generate a Design system handoff to provide variables, modes, aliases, styles, diagnostics, and usage context.
- Independent current state hash: `aff249166cab0a29d7a5b31b937225fe09aec79f12eb39ab3b9e232bb91b91a1` (fingerprint policy v1).

**Build standards:**
1. **Repeated property combinations become a class** — when the same combination of properties appears on more than one node, implement it as one named class/utility applied by name, never re-declared per surface or inlined. Inline `style=` only for truly per-instance computed values. Name the role (`.blend-ink`), not the properties.
2. **Semantic structure** — use elements that describe what content *is*, not how it looks. Navigation is `<nav>`, a list of items is `<ul>`/`<ol>`, a page region is a landmark (`<header>`, `<main>`, `<footer>`, `<aside>`). Heading levels follow document outline, not visual size.
3. **Token-first values** — every `$token` in this brief must resolve to a variable/token in code (CSS custom property, Tailwind theme value, or equivalent), never a hardcoded literal that happens to match. If the design says `$spacing/lg`, code says `var(--spacing-lg)` or the framework equivalent — not `24px`.
4. **Component boundaries match the design** — if this brief shows a `◆instance of`, it is a component in code with the same name, same props, same boundary. Do not flatten instances into inline markup or split one instance across multiple components.
5. **Grid frames are CSS Grid containers** — a `[Grid]` frame is a CSS `display: grid` container in code; children are placed by `grid-column: start / span N`, never by widths computed from column maths. `col(S/N of M)` maps to `grid-column: S / span N` on an M-column grid. When `row()` is present, also set `grid-row`.

**Changelog:** _No prior export for this subject._

**Screenshots (1):**

![Card](data:image/png;base64,)

---

## Design Summary

### Content Outline
_From Card:_

- **title:** "Order summary"
- **Note**

### Accessibility
_1 contrast issue (WCAG AA):_

- ⚠ **title** — 1:1 (needs 4.5:1) #1a1a1a on #1a1a1a at 15px [→](https://figma.com/design/F?node-id=20-3)

### Spacing Scale
_3 unique values:_ 8, 12, 16
- Base unit: **4px** (all values on scale)

**Typography (1 unique style):**
- **body** — Inter Medium 15/22 → CSS: 0.9375rem/22 (1×)
  build `{"fontSize":{"raw":15,"px":15,"rem":0.9375,"conversion":{"strategy":"divide-by-root-font-size","rootFontSizePx":16,"source":"text-node-context"}},"lineHeight":{"raw":{"unit":"PIXELS","value":22},"unit":"PIXELS","px":22,"unitlessRatio":1.466667,"conversion":{"strategy":"divide-by-associated-font-size","fontSizePx":15,"source":"text-node-context"}},"letterSpacing":{"raw":{"unit":"PIXELS","value":0},"unit":"PIXELS","px":0,"em":0,"conversion":{"strategy":"divide-by-associated-font-size","fontSizePx":15,"source":"text-node-context"}}}`

### Card (FRAME) #20:1 320×200 [→](https://figma.com/design/F?node-id=20-1) [V, gap:⚠12, pad:⚠16, justify-content:start, align-items:start] radius(⚠8) fill(⚠#1a1a1a)

- **title** (TEXT) #20:3 fill(⚠#1a1a1a) ~semantic(<h2>) textFixed — "Order summary" [→](https://figma.com/design/F?node-id=20-3)
- **Note** (FRAME) #20:2 288×40 [H, pad:⚠8, justify-content:start, align-items:start] radius(⚠8) fill(⚠#2f2f2f) [→](https://figma.com/design/F?node-id=20-2)
