// Policies P3, P6, P9.1, P10 — where a mode's declarations land: `:root`, a
// theme class, a `@media (min-width)` block, or a data-attribute selector.
// See docs/POLICIES.md.
import { cmp, num } from "./resolve.mjs";

/**
 * Layout breakpoints, read from the export's own `breakpoints.entries` (one
 * row per layout mode: `widthPx`, `layoutVariant`) rather than scanning the
 * collection for a `device/width` variable — schema 6 publishes this as a
 * first-class array so the generator never has to go find it. An empty
 * `widths` map means the export did not publish a resolvable width for every
 * layout mode, and the generator falls back to the data-attribute placeholder
 * rather than guessing.
 *
 * P6 — under `layout.baseMode: "smallest-default-variant"`, `baseModeId` is
 * the mode with the SMALLEST `widthPx` among `layoutVariant === "default"`
 * entries, NOT the collection's own `defaultModeId`. Seeding the base from a
 * default mode that is not the narrowest inverts mobile-first: every token
 * below that mode's width silently falls back to its value.
 */
/**
 * P9.1 — the export's own `isTheme` flag on `breakpoints.entries` names every
 * theme mode directly, so the selector rule needs no collection-name check:
 * any mode id in this set gets `:root` (default) or its own class. Falls back
 * to an empty set if a future export drops the flag, which restores the
 * `themes.collection` gate in `placementsFor` — never silently drops the
 * per-theme split.
 */
export function themeModeIds(doc) {
  return new Set((doc.breakpoints?.entries ?? []).filter((e) => e.isTheme).map((e) => e.modeId));
}

export function layoutBreakpoints(doc, cfg) {
  const name = cfg.layout.collection;
  const layout = doc.collections.find((c) => c.name === name);
  const entries = (doc.breakpoints?.entries ?? []).filter((e) => e.collectionName === name);
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
  // `baseMode: "collection-default"` restores the superseded rule, where the
  // collection's own `defaultModeId` seeded the unconditional base. That
  // inverts mobile-first for any consumer whose default mode is not its
  // narrowest, which is why "smallest-default-variant" is the other option.
  if (cfg.layout.baseMode === "collection-default") baseModeId = layout?.defaultModeId ?? null;
  const resolved = layout && widths.size === layout.modes.length;
  return resolved ? { widths, variants, baseModeId } : { widths: new Map(), variants: new Map(), baseModeId: null };
}

/**
 * Where a mode's declarations land. `width` is the sort key (mobile-first
 * ascending); -1 is the unconditional base, which sorts first.
 * @returns {Array<{ media: string|null, selector: string, width: number }>}
 */
export function placementsFor(collection, mode, ctx, cfg) {
  const isDefault = mode.id === collection.defaultModeId;
  if (collection.modes.length === 1) return [{ media: null, selector: ":root", width: -1 }];
  if (ctx.theme.has(mode.id) || (ctx.theme.size === 0 && collection.name === cfg.themes.collection)) {
    // P3/P9.1 — driven by the export's own `isTheme` flag, so a third theme
    // mode needs no new code path here. The `themes.collection` gate only
    // applies if the export stops publishing `isTheme` rows at all.
    // P10 (total themes) is `themeSelector`.
    return [{ media: null, selector: themeSelector(collection, mode, isDefault, ctx, cfg), width: -1 }];
  }

  if (collection.name === cfg.layout.collection && ctx.layout.widths.size) {
    const width = ctx.layout.widths.get(mode.id);
    const variant = ctx.layout.variants.get(mode.id) ?? "default";
    const { selector } = variantBase(variant, cfg);
    const at = { media: `@media (min-width: ${num(width)}px)`, selector, width };
    // P6: the SMALLEST-width default-variant mode seeds the unconditional
    // base (not the collection's defaultModeId), so every layout token still
    // resolves below the smallest published sample width — mobile-first.
    return mode.id === ctx.layout.baseModeId ? [variantBase(variant, cfg), at] : [at];
  }

  if (isDefault) return [{ media: null, selector: ":root", width: -1 }];
  return [{ media: null, selector: `[${modeAttribute(collection.name, cfg)}="${mode.name}"]`, width: -1 }];
}
/**
 * The unconditional (media-free) scope of one layout variant: `:root` for the
 * default variant, its `layout.variantAttribute` selector otherwise. It is
 * where the base mode's declarations land (P6) and where P11 puts a single
 * declaration that holds at every width — a viewport fraction or a `clamp()`.
 */
export const variantBase = (variant, cfg) => ({
  media: null,
  selector:
    variant == null || variant === "default"
      ? ":root"
      : `[${cfg.layout.variantAttribute}="${variant}"]`,
  width: -1,
});

/**
 * The data-attribute selector for a mode of a collection the export publishes
 * no width or theme semantics for. `modes.collectionModeAttribute` is a
 * template; `{collection}` is the collection name slugified.
 */
export const modeAttribute = (collectionName, cfg) =>
  cfg.modes.collectionModeAttribute.replace(
    "{collection}",
    collectionName.replace(/^\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
  );

/**
 * P3/P9.1 — a mode the export flags `isTheme: true` is selected by its own
 * class (`.<mode name>`), the default mode by `:root`.
 *
 * P10 — a mode named in `themes.total` is a TOTAL theme: while it is on the
 * document root, a nested sibling theme class (a per-section ground mode) must
 * not re-point tokens back to that sibling's values — proximity should not beat
 * the root theme. Mechanism: the total mode's block is also selected by
 * `.total .sibling` (0,2,0, beats the sibling's own 0,1,0 block for
 * descendants regardless of source order) and `.total.sibling` (0,2,0, the same
 * leak when BOTH classes land on one element, where plain `.total` would only
 * tie).
 *
 * This cannot rescue a token no total-mode block declares at all: specificity
 * decides between two competing declarations, it cannot conjure one. A
 * theme-bearing token must therefore be generated (covered automatically) or
 * hand-mirrored under the same selector list.
 *
 * Checked and rejected: deriving exclusivity from the export. `breakpoints.
 * entries` publishes `isTheme`/`theme`/`source`/`confidence` and no
 * exclusivity or ordering field, so there is nothing generic to hang it on —
 * hence a named list in config rather than an invented heuristic.
 *
 * Also rejected: emitting each sibling as `.sibling:not(.total *)`. That puts
 * the exclusion on a mode with no reason to know the total mode exists, and
 * the generated and hand-authored blocks share one selector, so every consumer
 * of the sibling's specificity would have to be revisited.
 */
export function themeSelector(collection, mode, isDefault, ctx, cfg) {
  if (isDefault) return ":root";
  if (!cfg.themes.total.includes(mode.name)) return `.${mode.name}`;
  const siblings = collection.modes.filter(
    (m) => m.id !== mode.id && m.id !== collection.defaultModeId && ctx.theme.has(m.id),
  );
  return [
    `.${mode.name}`,
    ...siblings.flatMap((s) => [`.${mode.name} .${s.name}`, `.${mode.name}.${s.name}`]),
  ].join(", ");
}

// --- generation ------------------------------------------------------------

// Mobile-first: the unconditional base (width -1) first, then ascending
// min-width. Within a width, `:root` before the variant selectors that
// override it.
export function renderGroups(groups) {
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
