// Policy P8 — the Tailwind v4 `@theme` bridge, so every generated utility
// speaks the design system's own vocabulary and Tailwind's default scale is
// reset away. Namespaces and held namespaces are `tailwind.namespaces` /
// `tailwind.held`. See docs/POLICIES.md.
import { cmp, fail, num, resolveValue } from "./resolve.mjs";
import { webName } from "./schema.mjs";

/**
 * P8.4 — px is converted to rem against the export's OWN root font size
 * (`units.policy.rootFontSizePx`), so the bridge cannot drift from the value
 * the export already used to build its `rem` cells. `tailwind.rootFontSizePx`
 * overrides it; `null` means read the export and hard-fail if it is absent,
 * rather than assuming 16.
 */
const rootFontSizePx = (doc, cfg) => {
  const px = cfg.tailwind.rootFontSizePx ?? doc.units?.policy?.rootFontSizePx;
  if (typeof px !== "number" || !Number.isFinite(px) || px <= 0) {
    fail("no root font size: the export publishes no units.policy.rootFontSizePx and tailwind.rootFontSizePx is not set");
  }
  return px;
};

const leafOf = (name, group) => {
  const bare = name.replace(/^--/, "");
  return group && bare.startsWith(`${group}-`) ? bare.slice(group.length + 1) : bare;
};

/**
 * One `@theme` block: per-namespace `initial` resets first, then the house
 * entries. Returns the CSS plus the rows §9 reconciles against the
 * consumer's own stylesheet.
 */
export function themeEntries(doc, byId, cfg) {
  const rows = [];
  const byCollection = new Map(doc.collections.map((c) => [c.name, c]));

  for (const spec of cfg.tailwind.namespaces) {
    if (spec.from === "breakpoints") {
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
          ns: spec.ns,
          key: `--${spec.ns}-${family}`,
          value: `${num(px / rootFontSizePx(doc, cfg))}rem`,
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
      const key = `--${spec.ns}-${leafOf(name, spec.group)}`;
      if (rows.some((r) => r.key === key)) fail(`P8: duplicate @theme key ${key}`);

      // P8.2 — var(token) normally; the literal when key === token name,
      // because that would otherwise be a self-reference cycle that computes
      // to nothing. See the policy header for the measurements behind both.
      let value = `var(${name})`;
      let note = null;
      if (key === name) {
        const dm = v.modes.find((m) => m.modeId === c.defaultModeId) ?? v.modes[0];
        value = resolveValue(v, dm, byId, cfg).value;
        note = `literal, not var(${name}): same-name cycle (P8.2)`;
      }
      rows.push({ ns: spec.ns, key, value, note, source: `${c.name}/${name}` });
    }
  }
  return rows;
}

export function themeCss(doc, rows, cfg) {
  const lines = [];
  for (const spec of cfg.tailwind.namespaces) {
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
    `   ${cfg.report.policyRef}; the name-by-name status of every hand-authored`,
    `   \`@theme\` entry is in ${cfg.paths.report} §9.`,
    "",
    `   Source:   ${doc.documentName ?? doc.artifact ?? "design-system handoff export"}`,
    `   Schema:   ${doc.schema} v${doc.schemaVersion}`,
    `   Exported: ${doc.generatedAt}`,
    `   State:    ${doc.fingerprint.designSystemStateHash}`,
    "",
    `   Regenerate with:  ${cfg.header.regenerateCommand}`,
    "",
    "   NOT reset here, each for a stated reason (P8.3):",
    ...cfg.tailwind.held.map(([k, why]) => `     ${k} — ${why}`),
    "*/",
    "",
    "@theme inline {",
  ].join("\n");

  return `${header}${lines.join("\n")}\n}\n`;
}
