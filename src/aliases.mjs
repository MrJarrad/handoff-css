// Policy P12 — ALIASES. Names the consumer publishes as `var()` hops onto
// generated tokens, so a shorter or older public name keeps working without a
// second declaration of the value. See docs/POLICIES.md.
//
// This replaces a hand-authored alias block: hand-authoring one means every
// new token leaf has to be remembered twice, and a leaf that is added or
// renamed in Figma silently stops having an alias.
import { cmp, fail } from "./resolve.mjs";

/**
 * `config.aliases` maps a NAME PATTERN to a TARGET PATTERN, each containing
 * exactly one `*`:
 *
 *   "--screen-height-*": "--device-screen-height-*"
 *
 * The `*` binds to the leaf of every emitted name matching the target, so the
 * set of aliases is derived from what was actually emitted — never a list to
 * maintain. Patterns are expanded in declaration order and an alias may target
 * an earlier alias, which is how a two-hop house convention
 * (`--height-screen-full` -> `--screen-height-full` -> `--device-screen-height-full`)
 * stays a pair of one-line rules.
 *
 * @param emitted      names declared in the token stylesheet
 * @param handDeclared the consumer's own GLOBAL declarations (P2)
 * @returns {{ css: string, rows: Array<{ name: string, target: string, pattern: string }> }}
 */
export function aliasBlock(emitted, handDeclared, cfg) {
  const entries = Object.entries(cfg.aliases ?? {});
  if (entries.length === 0) return { css: "", rows: [] };

  const rows = [];
  const byName = new Map(); // alias name -> the pattern that produced it

  for (const [pattern, target] of entries) {
    const stem = one(pattern, "alias name");
    const targetStem = one(target, "alias target");

    const leaves = [...emitted, ...byName.keys()]
      .filter((n) => n.startsWith(targetStem) && n.length > targetStem.length)
      .map((n) => n.slice(targetStem.length))
      .sort(cmp);

    // A pattern that matches nothing is a config statement about names that no
    // longer exist — the exact drift a generated alias block exists to catch.
    if (leaves.length === 0) fail(`alias \`${pattern}\` matches no emitted token (target \`${target}\`)`);

    for (const leaf of leaves) {
      const name = `${stem}${leaf}`;
      // A collision is never resolved by ordering: whichever declaration lost
      // would be invisible, and one of the two is a real design-system token.
      if (emitted.has(name)) fail(`alias \`${name}\` (from \`${pattern}\`) collides with a generated token of the same name`);
      if (handDeclared.has(name)) fail(`alias \`${name}\` (from \`${pattern}\`) collides with a hand-authored declaration in ${cfg.paths.handAuthored}`);
      if (byName.has(name)) fail(`alias \`${name}\` is produced twice, by \`${byName.get(name)}\` and \`${pattern}\``);
      byName.set(name, pattern);
      rows.push({ name, target: `${targetStem}${leaf}`, pattern });
    }
  }

  const css = [
    `/* --- aliases ${"-".repeat(53)} */`,
    "/* Names published as aliases of the generated tokens above, expanded from the",
    `   consumer's \`aliases\` config over the emitted leaves (policy P12 in`,
    `   ${cfg.report.policyRef}). Alias, never a second copy of the value: the token`,
    "   above stays the single place the value is stated. */",
    ":root {",
    ...rows.map((r) => `  ${r.name}: var(${r.target});`),
    "}",
  ].join("\n");

  return { css, rows };
}

/** The pattern's fixed stem, having checked it carries exactly one trailing `*`. */
function one(pattern, what) {
  const stars = (pattern.match(/\*/g) ?? []).length;
  if (stars !== 1 || !pattern.endsWith("*")) {
    fail(`${what} pattern \`${pattern}\` must end with exactly one \`*\``);
  }
  return pattern.slice(0, -1);
}
