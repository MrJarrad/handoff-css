// The token stylesheet: one block per collection, one declaration per
// (variable, effective mode), placed by `modes.mjs`. See docs/POLICIES.md.
import path from "node:path";

import { aliasedByNames, isExcluded, isHidden, privateIds } from "./exclude.mjs";
import { layoutBreakpoints, placementsFor, renderGroups, themeModeIds } from "./modes.mjs";
import { cmp, resolveValue } from "./resolve.mjs";
import { assertSchema, indexById, webName } from "./schema.mjs";

const handAuthoredName = (cfg) => path.basename(cfg.paths.handAuthored);

export function emitTokens(doc, handDeclared, cfg) {
  assertSchema(doc, cfg);

  const byId = indexById(doc);
  const ctx = { layout: layoutBreakpoints(doc, cfg), theme: themeModeIds(doc) };
  const priv = privateIds(doc, cfg); // P7 — hidden but alias-reachable, so still emitted

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
      if (isExcluded(c, v, cfg)) {
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
      const defaultResolved = resolveValue(v, defaultMode, byId, cfg);

      if (isPrivate) {
        privateRows.push({
          collection: c.name,
          name,
          type: v.type,
          value: defaultResolved.value,
          aliasedBy: aliasedByNames(doc, v.id, cfg),
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
        const r = mv.modeId === defaultMode.modeId ? defaultResolved : resolveValue(v, mv, byId, cfg);
        const decl = `${name}: ${r.value};${r.note ? ` /* ${r.note} */` : ""}`;
        const target = isPrivate ? privGroups : groups;
        for (const p of placementsFor(c, mode, ctx, cfg)) {
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
        `/* ${superseded.length} token${superseded.length === 1 ? "" : "s"} in this collection are declared by hand in ${handAuthoredName(cfg)} and`,
        `   are therefore not emitted here (see policy P2 in ${cfg.report.policyRef}).`,
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
        `   ${cfg.report.policyRef} and \u00a70 of ${cfg.paths.report}. */`,
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
    `   Regenerate with:  ${cfg.header.regenerateCommand}`,
    "   Policies (names, cascade, modes, units, aliases) are documented at the",
    `   top of that script. Hand-authored tokens in ${handAuthoredName(cfg)} always win and`,
    "   are omitted here; the reconciliation report lists every one.",
    "*/",
    "",
    "",
  ].join("\n");

  return { css: `${header}${blocks.join("\n\n")}\n`, rows, privateRows, hiddenRows, excludedRows };
}
