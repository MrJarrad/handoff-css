// Policy P20 — ASPECT RATIOS. Figma has no aspect-ratio primitive. A design
// system that needs one therefore encodes it the only way the tool allows: a
// group of per-column-span HEIGHT variables, each carrying the ratio it was
// computed from in its own description ("Ratio – 3/2, 3:2").
//
// Those heights are the workaround and never become tokens — they are in
// `exclude.paths` (P7) and stay there. The ratio is the design decision, and
// this module is the one place it is lifted out: one `--aspect-<leaf group>`
// per leaf group, stating the ratio the group's members agree on.
//
// Reading an EXCLUDED group is deliberate, not a leak. P7 governs what is
// EMITTED; the excluded variables are still the only place the ratio is
// written down, so refusing to read them would mean hand-authoring the four
// ratios a second time — exactly the duplicate this package exists to remove.
//
// See docs/POLICIES.md P20.
import { cmp, fail } from "./resolve.mjs";
import { webName } from "./schema.mjs";

/**
 * One entry per leaf group under `aspect.group`, in group-name order, with
 * every member's stated ratio — parsed, or `null` where the description does
 * not state one. Separated from the emit step so the disagreement check reads
 * as what it is: a property of the group, decided before anything is written.
 *
 * @returns {Array<{ group: string, path: string,
 *                   members: Array<{ name: string, ratio: string|null, description: string }> }>}
 */
export function aspectGroups(doc, cfg) {
  const { group, descriptionPattern } = cfg.aspect ?? {};
  if (group == null) return [];
  const re = descriptionPattern == null ? null : new RegExp(descriptionPattern);

  const byGroup = new Map();
  for (const c of doc.collections) {
    for (const v of c.variables) {
      const path = `${c.name}/${v.name}`;
      if (!path.startsWith(group)) continue;
      // A variable sitting DIRECTLY in the aspect group has no leaf group to
      // name a token after. Skipped here and reported by `aspectTokens`.
      const rest = path.slice(group.length);
      const slash = rest.indexOf("/");
      const leaf = slash === -1 ? null : rest.slice(0, slash);
      const description = v.description ?? "";
      const m = re && leaf != null ? re.exec(description) : null;
      const key = leaf ?? "";
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push({
        name: webName(v),
        ratio: m ? `${m[1]} / ${m[2]}` : null,
        description,
      });
    }
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => cmp(a, b))
    .map(([leaf, members]) => ({
      group: leaf,
      path: `${group}${leaf}`,
      members: members.sort((a, b) => cmp(a.name, b.name)),
    }));
}

/**
 * The derived tokens and everything the report needs to say about them.
 *
 * A leaf group whose members do not all state the SAME ratio publishes
 * NOTHING and raises `ASPECT_RATIO_MIXED`. Picking the majority, the first, or
 * the default mode's would be the generator deciding a design question from a
 * typo — and a wrong aspect ratio is invisible until a card is the wrong shape
 * in production. The finding names each distinct value and one variable that
 * states it, so the fix is one description in Figma.
 *
 * @param handDeclared P2 — the consumer's own GLOBAL declarations
 * @returns {{ css: string, rows: Array<{name, ratio, group, members, status, hand}>,
 *             warnings: Array<{code, name, collection, detail}> }}
 */
export function aspectTokens(doc, handDeclared, cfg) {
  const { group, prefix } = cfg.aspect ?? {};
  if (group == null || prefix == null) return { css: "", rows: [], warnings: [] };

  const rows = [];
  const warnings = [];
  const warn = (code, name, detail) => warnings.push({ code, name, collection: group, detail });

  for (const g of aspectGroups(doc, cfg)) {
    if (g.group === "") {
      warn("ASPECT_UNGROUPED", g.path,
        `${g.members.length} variable(s) sit directly in \`${group}\` with no leaf group to name a ratio after (${g.members.map((m) => `\`${m.name}\``).join(", ")}) — nothing derived`);
      continue;
    }

    const distinct = new Map(); // ratio (or null) -> first member stating it
    for (const m of g.members) if (!distinct.has(m.ratio)) distinct.set(m.ratio, m);

    if (distinct.size > 1) {
      const detail = [...distinct.entries()]
        .sort(([a], [b]) => cmp(String(a), String(b)))
        .map(([ratio, m]) => `${ratio == null ? "no stated ratio" : `\`${ratio}\``} (\`${m.name}\`: ${JSON.stringify(m.description)})`)
        .join("; ");
      warn("ASPECT_RATIO_MIXED", `${prefix}${g.group}`,
        `the ${g.members.length} variables in \`${g.path}\` state ${distinct.size} different ratios — ${detail}. Nothing is published for this group: one of these descriptions is wrong, and the generator will not pick which.`);
      continue;
    }

    const ratio = [...distinct.keys()][0];
    if (ratio == null) {
      warn("ASPECT_RATIO_MISSING", `${prefix}${g.group}`,
        `no variable in \`${g.path}\` states a ratio its \`aspect.descriptionPattern\` recognises (${g.members.length} checked, e.g. \`${g.members[0].name}\`: ${JSON.stringify(g.members[0].description)}) — nothing derived`);
      continue;
    }

    const name = `${prefix}${g.group}`;
    const hand = handDeclared.get(name);
    rows.push({
      name,
      ratio,
      group: g.path,
      members: g.members.length,
      hand: hand ?? null,
      // P2 — a global hand-authored declaration wins the cascade, so the
      // derived token stands down exactly as an export-backed one does.
      status: hand == null ? "DERIVED" : hand === ratio ? "MATCH" : "VALUE-DRIFT",
    });
  }

  const emitted = rows.filter((r) => r.hand == null);
  if (emitted.length === 0) return { css: "", rows, warnings };

  const css = [
    `/* --- aspect ratios ${"-".repeat(45)} */`,
    `/* Derived from the leaf groups under \`${group}\`, each of whose variables states`,
    "   the same ratio in its description (policy P20 in",
    `   ${cfg.report.policyRef}). Figma has no aspect-ratio primitive: those variables are`,
    "   per-column-span HEIGHTS — the workaround — and are excluded from this file under",
    "   P7. The ratio they encode is the design decision, and this is where it is stated. */",
    ":root {",
    ...emitted.map((r) => `  ${r.name}: ${r.ratio};`),
    "}",
  ].join("\n");

  return { css, rows, warnings };
}

/** A derived name that collides with an export-backed token is never resolved by ordering. */
export function assertNoAspectCollision(rows, emitted) {
  for (const r of rows) {
    if (emitted.has(r.name)) {
      fail(`aspect token \`${r.name}\` (derived from \`${r.group}\`, policy P20) collides with a generated token of the same name`);
    }
  }
  return rows;
}
