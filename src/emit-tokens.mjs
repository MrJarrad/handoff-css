// The token stylesheet: one block per collection, one declaration per
// (variable, effective mode), placed by `modes.mjs`. See docs/POLICIES.md.
import path from "node:path";

import { aliasBlock } from "./aliases.mjs";
import { aliasedByNames, isExcluded, isHidden, privateIds } from "./exclude.mjs";
import { layoutBreakpoints, placementsFor, renderGroups, themeModeIds, variantBase } from "./modes.mjs";
import { cmp, num, resolveValue, untrustedCells } from "./resolve.mjs";
import { classify, honours, isViewportClass } from "./responsive.mjs";
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
  const responsiveRows = []; // P11 — one row per emitted variable: class, source, effect
  // P13 — every self-contradicting build cell in the export, scanned once and
  // independently of what is emitted, so the count is a property of the EXPORT
  // (a fixed plugin export takes it to zero) rather than of this run's config.
  const untrustedRows = untrustedCells(doc);
  const warnings = []; // P11/P13 — what the generator would not guess at
  const emitted = new Set(); // every name declared below, for the alias block
  const blocks = []; // rendered CSS blocks

  for (const row of untrustedRows) {
    warnings.push({
      code: row.code,
      name: row.name,
      collection: row.collection,
      mode: row.mode,
      detail: `mode \`${row.mode}\`: ${row.detail} — its \`css\` is not emitted (P13)`,
    });
  }

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
      emitted.add(name);

      // P11 — the responsive class decides HOW MANY declarations this variable
      // gets and where, before any of them is placed.
      const resp = classify(v, cfg);
      const row = { collection: c.name, name, cls: resp.cls, source: resp.source, honoured: false, effect: "per-mode" };
      responsiveRows.push(row);
      if (resp.warning === "VIEWPORT_FRACTION_DISAGREES") {
        const { rule, description } = resp.fractionDisagree;
        warnings.push({
          code: resp.warning,
          name,
          collection: c.name,
          detail: `responsiveBehavior's viewportFraction (${num(rule * 100)}%) disagrees with the description's stated fraction (${num(description * 100)}%) by more than 0.5 — the description wins, ${resp.value} emitted`,
        });
      } else if (resp.warning === "VIEWPORT_OUTSIDE_GROUPS") {
        warnings.push({
          code: resp.warning,
          name,
          collection: c.name,
          detail: `states a viewport fraction but sits outside every \`viewport.groups\` prefix (${(cfg.viewport?.groups ?? []).map((g) => `\`${g}\``).join(", ") || "none"}) — treated as a hint, per-mode samples emitted unchanged. Correct the class in Figma, or declare the group.`,
        });
      } else if (resp.warning) {
        warnings.push({
          code: resp.warning,
          name,
          collection: c.name,
          detail: `in a \`viewport.groups\` group with neither a \`responsive\` field nor a "N% of screen height|width" description — per-mode px samples emitted unchanged`,
        });
      }

      const target = isPrivate ? privGroups : groups;
      const push = (p, decl) => {
        const key = `${p.media ?? ""}|${p.selector}`;
        if (!target.has(key)) target.set(key, { ...p, lines: [] });
        target.get(key).lines.push(decl);
      };

      // viewport-* — a fraction of the screen holds at every viewport, so it is
      // ONE declaration on the base scope and the per-mode samples are dropped.
      if (honours(cfg, resp.cls) && resp.value) {
        row.honoured = true;
        row.effect = `${resp.value} once on the base scope`;
        push({ media: null, selector: ":root", width: -1 }, `${name}: ${resp.value};`);
        continue;
      }

      // Per-mode, with one collapse: a `layoutVariant` whose rule is an
      // honoured `fluid-clamp` or `fixed` emits once at that variant's base
      // scope instead of once per width.
      const collapsed = new Set();
      const hinted = new Set(); // P13 — one hint warning per layout variant
      for (const mode of c.modes) {
        const mv = v.modes.find((m) => m.modeId === mode.id);
        if (!mv || mv.effective === false) continue;
        const r = mv.modeId === defaultMode.modeId ? defaultResolved : resolveValue(v, mv, byId, cfg);
        const decl = `${name}: ${r.value};${r.note ? ` /* ${r.note} */` : ""}`;

        // A variant this export publishes no rule for — and any collection
        // outside `layout.collection` — takes the per-mode path untouched.
        const variant = ctx.layout.variants.get(mode.id);
        const rule = variant == null
          ? null
          : resp.override
            ? { cls: resp.override, css: resp.rules.get(variant)?.css ?? null }
            : resp.rules.get(variant);
        // P13 — a viewport class is a claim that this variable is a FRACTION
        // of the screen, and the class name alone carries no fraction. Only a
        // `responsive` field or the description convention states one, and both
        // are handled above; a class arriving from the export's own
        // `responsiveBehavior` is therefore a hint about intent, never a value.
        // Left to the `fixed`/`fluid-clamp` collapse below it would either
        // collapse ten samples into one on the strength of a name, or report
        // FIXED_VARIES_BY_MODE about a class that is not `fixed`.
        if (rule && isViewportClass(rule.cls) && honours(cfg, rule.cls)) {
          if (!hinted.has(variant)) {
            hinted.add(variant);
            warnings.push({
              code: "VIEWPORT_CLASS_WITHOUT_FRACTION",
              name,
              collection: c.name,
              detail: `\`${rule.cls}\` at layout variant \`${variant}\` with no \`responsive.viewport.fraction\` and no "N% of screen height|width" description — treated as a hint, per-mode samples emitted unchanged`,
            });
          }
          for (const p of placementsFor(c, mode, ctx, cfg)) push(p, decl);
          continue;
        }

        if (rule && honours(cfg, rule.cls) && collapse(v, rule, variant, ctx, byId, cfg, warnings)) {
          if (collapsed.has(variant)) continue;
          collapsed.add(variant);
          row.honoured = true;
          row.effect = `${rule.cls} once per layout variant`;
          push(variantBase(variant, cfg), `${name}: ${rule.cls === "fluid-clamp" ? rule.css : r.value};`);
          continue;
        }

        for (const p of placementsFor(c, mode, ctx, cfg)) push(p, decl);
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

  // The consumer's own alias names, expanded over what was emitted above.
  const aliases = aliasBlock(emitted, handDeclared, cfg);
  if (aliases.css) blocks.push(aliases.css);

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

  return {
    css: `${header}${blocks.join("\n\n")}\n`,
    rows, privateRows, hiddenRows, excludedRows,
    responsiveRows, aliasRows: aliases.rows, warnings, untrustedRows,
  };
}

/**
 * Whether a `fluid-clamp` / `fixed` rule can be honoured, or must fall back to
 * the per-mode path with a warning. Nothing is emitted from a rule the export
 * did not finish: a `fluid-clamp` without its `css` expression, or a `fixed`
 * whose samples do not actually agree, would otherwise ship a value the export
 * never stated.
 */
function collapse(v, rule, variant, ctx, byId, cfg, warnings) {
  const name = webName(v);
  if (rule.cls === "fluid-clamp") {
    if (rule.css) return true;
    warnings.push({
      code: "CLAMP_WITHOUT_EXPRESSION",
      name,
      collection: cfg.layout.collection,
      detail: `\`fluid-clamp\` at layout variant \`${variant}\` carries no \`css\` expression — per-mode samples emitted instead`,
    });
    return false;
  }

  // `fixed`: prove it before collapsing ten samples into one.
  const values = new Set();
  for (const mv of v.modes) {
    if (mv.effective === false) continue;
    if ((ctx.layout.variants.get(mv.modeId) ?? null) !== variant) continue;
    values.add(resolveValue(v, mv, byId, cfg).value);
  }
  if (values.size <= 1) return true;
  warnings.push({
    code: "FIXED_VARIES_BY_MODE",
    name,
    collection: cfg.layout.collection,
    detail: `\`fixed\` at layout variant \`${variant}\`, but its modes resolve to ${values.size} different values — per-mode samples emitted instead`,
  });
  return false;
}
