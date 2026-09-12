// Policy P2 — the consumer's own stylesheet wins the cascade, so a custom
// property it declares GLOBALLY is not emitted here. See docs/POLICIES.md.

/**
 * A block header counts as GLOBAL only if it is top-level and unconditional —
 * a bare `:root` / `html`, or a `@theme` block (which Tailwind emits into
 * `@layer theme` for every element). Anything else — `.dark`, `@media`,
 * `@supports`, `@utility`, a nested `:root` inside a conditional at-rule —
 * applies only when its condition holds, so it cannot supersede a generated
 * token everywhere and must not suppress generation (see P2).
 */
const isGlobalScope = (stack) =>
  stack.length === 1 && /^(?::root|html|@theme(?:\s|$).*)$/.test(stack[0]);

/**
 * Custom properties declared in the hand-authored stylesheet, split by scope:
 *
 *   `declared` — name -> value for GLOBAL declarations. These win the cascade
 *                unconditionally, so the generator stands down (P2) and the
 *                report calls each one MATCH or VALUE-DRIFT.
 *   `scoped`   — names seen ONLY under a selector or conditional at-rule. The
 *                generated token still needs to exist for the scoped override
 *                to override anything, so these do not suppress generation.
 *
 * …and, for P21 (0.5.0), the same reading applied to CLASS rules:
 *
 *   `classes`   — `.foo` -> its declarations, for TOP-LEVEL single-class rules
 *                 only. A style whose selector is in here is hand-authored, so
 *                 the generator stands down and reports MATCH / VALUE-DRIFT.
 *   `utilities` — the bare names of top-level `@utility foo` blocks. Tailwind
 *                 compiles one to `.foo`, so it SHADOWS a generated class —
 *                 but it is not an unconditional declaration of the selector
 *                 (same reading `isGlobalScope` already takes of `@utility`),
 *                 so it does not suppress generation. Reported, not obeyed.
 *
 * Comments are stripped first so a name mentioned in prose is not mistaken for
 * a declaration. Brace/semicolon scanning is sufficient for this stylesheet;
 * it has no braces or semicolons inside strings or url() values.
 */
export function readHandAuthored(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const declared = new Map();
  const scoped = new Set();
  const classes = new Map();
  const utilities = new Set();
  const stack = [];
  const bodies = []; // declarations seen at each open block's own level
  let buf = "";

  for (const ch of stripped) {
    if (ch === "{") {
      stack.push(buf.trim());
      bodies.push([]);
      buf = "";
    } else if (ch === "}") {
      const header = stack.pop();
      const body = bodies.pop();
      // P21 — a TOP-LEVEL class rule the consumer wrote by hand. Nested rules
      // are not recorded: a `.foo` inside `@media` does not declare the class
      // unconditionally, exactly as P2 refuses a scoped custom property.
      if (stack.length === 0 && header != null) {
        const utility = /^@utility\s+([A-Za-z0-9_-]+)\s*$/.exec(header);
        if (utility) utilities.add(utility[1]);
        else if (/^\.[A-Za-z0-9_-]+$/.test(header) && !classes.has(header)) classes.set(header, body);
      }
      buf = "";
    } else if (ch === ";") {
      const m = /^\s*(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]+)$/.exec(buf);
      if (m) {
        if (isGlobalScope(stack)) {
          if (!declared.has(m[1])) declared.set(m[1], m[2].trim());
        } else {
          scoped.add(m[1]);
        }
      }
      const d = /^\s*([-A-Za-z][A-Za-z0-9_-]*)\s*:\s*([\s\S]+)$/.exec(buf);
      if (d && bodies.length) bodies[bodies.length - 1].push(`${d[1]}: ${d[2].trim().replace(/\s+/g, " ")}`);
      buf = "";
    } else {
      buf += ch;
    }
  }

  for (const name of declared.keys()) scoped.delete(name);
  return { declared, scoped, classes, utilities };
}
