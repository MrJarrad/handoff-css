// Policy P19's one validation lane — DELAY_NOT_ALIASED.
//
// Operator ruling 2026-09-12 row 4: every `motion/delay` step is an alias of
// the `motion/duration` step of the same value, *"so values can never drift"*.
// That is a statement about how Figma is AUTHORED, and the generator's job is
// to notice when it stops being true — not to make it true.
//
// Rewriting a literal delay into `var(--duration-…)` here would look identical
// today and would silently overwrite the first delay step that legitimately
// differs, which is the class of guess this package exists to remove. So a
// delay authored as its own copy of a duration's value is REPORTED: one
// finding, naming both variables, with the fix in Figma.
//
// See docs/POLICIES.md P19.
import { cmp } from "./resolve.mjs";
import { webName } from "./schema.mjs";

const under = (doc, prefix) => {
  const out = [];
  for (const c of doc.collections) {
    for (const v of c.variables) {
      if (`${c.name}/${v.name}`.startsWith(prefix)) out.push(v);
    }
  }
  return out;
};

/**
 * Every delay step that holds a duration step's value as its own literal
 * rather than as an alias of it.
 *
 * A delay with no matching duration step is NOT a finding: `delay/50` has no
 * `duration/50` to alias, and the ruling only pairs the steps that exist.
 *
 * @returns {Array<{code, name, collection, detail}>}
 */
export function delayAliasFindings(doc, cfg) {
  const pair = cfg.motion?.delayAliasOf;
  if (!pair?.delay || !pair?.duration) return [];

  const durations = new Map(); // stored value -> WEB name
  for (const v of under(doc, pair.duration)) {
    for (const m of v.modes) {
      if (m.effective === false || m.alias) continue;
      if (typeof m.raw === "number" && !durations.has(m.raw)) durations.set(m.raw, webName(v));
    }
  }

  const findings = [];
  for (const v of under(doc, pair.delay)) {
    for (const m of v.modes) {
      if (m.effective === false || m.alias) continue; // already an alias: nothing to say
      const target = typeof m.raw === "number" ? durations.get(m.raw) : undefined;
      if (!target) continue;
      findings.push({
        code: "DELAY_NOT_ALIASED",
        name: webName(v),
        collection: pair.delay,
        detail: `holds the same value as \`${target}\` as its own literal, not as an alias of it. Ruling 2026-09-12 row 4 makes every delay step an alias of the matching duration step so the two can never drift; re-point this variable at \`${target}\` in Figma. Emitted verbatim meanwhile — the generator does not pair the two itself.`,
      });
      break; // one finding per variable, not one per mode
    }
  }
  return findings.sort((a, b) => cmp(a.name, b.name));
}
