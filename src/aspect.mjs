// Policy P20 — ASPECT RATIOS. Figma has no aspect-ratio *type*, but it does
// have STRING variables, and as of export v11 the design system authors the
// four ratios as `core/aspect/{landscape, portrait, square, tall}` holding
// `"3:2"`, `"4:5"`, `"1:1"`, `"2:3"`.
//
// So there is nothing to derive. These are ordinary published variables that
// flow through the normal emit path under their own `codeSyntax.WEB` names
// (P1); this module owns one thing — rendering `a:b` as the CSS ratio
// `a / b`, because `aspect-ratio: "3:2"` is not a value CSS accepts.
//
// The per-column-span HEIGHT variables under `layout/grid/aspect/` remain the
// Figma workaround they always were: EXCLUDED (P7), never tokens. They still
// carry the ratio in their descriptions, so this module cross-checks them
// against the authored variable and reports a disagreement. That is a
// validation note about the design file, not an input to what is emitted —
// superseding 0.4.0's pre-release derivation path, where those descriptions
// WERE the source and a disagreement meant nothing could be published.
//
// See docs/POLICIES.md P20.
import { cmp, fail } from "./resolve.mjs";
import { webName } from "./schema.mjs";

/** `3:2` or `3/2`, with optional spaces. Decimals allowed — `1.85:1` is a real ratio. */
const RATIO = /^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/;

/** Whether this variable is one the consumer declared to hold a ratio. */
export const isRatioVariable = (collection, v, cfg) =>
  (cfg.aspect?.ratioPaths ?? []).some((prefix) => `${collection.name}/${v.name}`.startsWith(prefix));

/**
 * P20 — the CSS ratio a declared ratio variable's STRING value states.
 *
 * A value the pattern does not recognise is a HARD FAILURE, not a passthrough:
 * the consumer has declared this path to hold a ratio, so a value that is not
 * one is the design file and the config disagreeing, and emitting
 * `aspect-ratio: "banana"` would push that discovery into a browser.
 */
export function ratioValue(v, raw) {
  const m = RATIO.exec(String(raw));
  if (!m) {
    fail(`${webName(v)}: \`aspect.ratioPaths\` declares this a ratio, but its value ${JSON.stringify(raw)} is not \`a:b\` or \`a/b\` (P20)`);
  }
  return `${m[1]} / ${m[2]}`;
}

/**
 * P20's validation note. `layout/grid/aspect/<leaf>/*` are the per-column-span
 * heights, each describing the ratio it was computed from ("Ratio – 3/2,
 * 3:2"). They are excluded from the CSS, but a description that disagrees with
 * the authored `core/aspect/<leaf>` variable means one of the two is wrong and
 * a designer is reading a stale number off the wrong one.
 *
 * Nothing here changes what is emitted. The authored variable is the value,
 * always — these descriptions stopped being a source the moment the design
 * system authored the ratios properly.
 *
 * @returns {Array<{code, name, collection, detail}>}
 */
export function aspectDescriptionFindings(doc, cfg) {
  const { descriptionGroup, descriptionPattern, ratioPaths = [] } = cfg.aspect ?? {};
  if (descriptionGroup == null || descriptionPattern == null) return [];
  const re = new RegExp(descriptionPattern);

  // The authored ratio per leaf name, from whichever declared path holds it.
  const authored = new Map();
  for (const c of doc.collections) {
    for (const v of c.variables) {
      if (!isRatioVariable(c, v, cfg)) continue;
      const prefix = ratioPaths.find((p) => `${c.name}/${v.name}`.startsWith(p));
      authored.set(`${c.name}/${v.name}`.slice(prefix.length),
        { name: webName(v), ratio: ratioValue(v, v.modes[0]?.raw) });
    }
  }

  // Distinct stated ratios per leaf group, each with one variable that states it.
  const stated = new Map();
  for (const c of doc.collections) {
    for (const v of c.variables) {
      const path = `${c.name}/${v.name}`;
      if (!path.startsWith(descriptionGroup)) continue;
      const rest = path.slice(descriptionGroup.length);
      const slash = rest.indexOf("/");
      if (slash === -1) continue; // no leaf group to compare against
      const leaf = rest.slice(0, slash);
      const m = re.exec(v.description ?? "");
      const ratio = m ? `${m[1]} / ${m[2]}` : null;
      if (!stated.has(leaf)) stated.set(leaf, new Map());
      if (!stated.get(leaf).has(ratio)) stated.get(leaf).set(ratio, webName(v));
    }
  }

  const findings = [];
  for (const [leaf, ratios] of [...stated].sort(([a], [b]) => cmp(a, b))) {
    const auth = authored.get(leaf);
    // A described group with no authored variable is not a contradiction —
    // `descriptionGroup` may legitimately hold groups the ratio set does not.
    if (!auth) continue;
    const wrong = [...ratios].filter(([ratio]) => ratio !== auth.ratio);
    if (wrong.length === 0) continue;
    findings.push({
      code: "ASPECT_DESCRIPTION_DISAGREES",
      name: auth.name,
      collection: descriptionGroup,
      detail: `\`${auth.name}\` is authored \`${auth.ratio}\`, but ${wrong.map(([ratio, who]) => `\`${who}\` describes ${ratio == null ? "no recognisable ratio" : `\`${ratio}\``}`).join(" and ")} in \`${descriptionGroup}${leaf}\`. The authored variable is the value; correct the description in Figma so a designer reading the height group is not reading a stale number.`,
    });
  }
  return findings.sort((a, b) => cmp(a.name, b.name));
}
