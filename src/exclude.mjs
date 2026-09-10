// Policy P7 — PRIVATE / HIDDEN / EXCLUDED. Figma-only scaffolding must never
// become a public token, but hidden-in-Figma does NOT mean absent-from-CSS: a
// custom property that is referenced and not declared is invalid at
// computed-value time. The emit set is therefore the alias closure, not the
// published set. See docs/POLICIES.md.
import { cmp } from "./resolve.mjs";
import { webName } from "./schema.mjs";

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
export const isHidden = (v) => v.hiddenFromPublishing === true || v.effectivelyHiddenFromPublishing === true;

export const isExcluded = (collection, v, cfg) =>
  cfg.exclude.paths.some((prefix) => `${collection.name}/${v.name}`.startsWith(prefix));

// P7 — the alias closure. Returns the set of variable ids that are hidden but
// reachable by alias from an emitted variable, and therefore MUST still be
// declared or the referring token is invalid at computed-value time.
//
// Seeded with everything emitted on its own merit (published, not excluded),
// then walked transitively: a PRIVATE token's own alias targets are PRIVATE
// too, or the private token dangles in turn. EXCLUDED paths are never revived.
export function privateIds(doc, cfg) {
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
      if (isExcluded(c, v, cfg) || isHidden(v)) continue;
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
      if (!target || isExcluded(collectionOf.get(targetId), target, cfg)) continue;
      if (!isHidden(target)) continue; // already emitted on its own merit
      priv.add(targetId);
      queue.push(targetId);
    }
  }
  return priv;
}

// P7 — which emitted tokens alias this variable, so the PRIVATE report says
// WHY each one had to survive rather than just asserting that it did.
export function aliasedByNames(doc, targetId, cfg) {
  const names = new Set();
  for (const c of doc.collections) {
    for (const v of c.variables) {
      if (isExcluded(c, v, cfg)) continue;
      for (const m of v.modes) {
        if (m.effective === false) continue;
        if (m.alias?.chain?.[0]?.variableId === targetId) names.add(webName(v));
      }
    }
  }
  return [...names].sort(cmp);
}
