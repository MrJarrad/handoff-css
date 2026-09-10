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
 * Comments are stripped first so a name mentioned in prose is not mistaken for
 * a declaration. Brace/semicolon scanning is sufficient for this stylesheet;
 * it has no braces or semicolons inside strings or url() values.
 */
export function readHandAuthored(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const declared = new Map();
  const scoped = new Set();
  const stack = [];
  let buf = "";

  for (const ch of stripped) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      stack.pop();
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
      buf = "";
    } else {
      buf += ch;
    }
  }

  for (const name of declared.keys()) scoped.delete(name);
  return { declared, scoped };
}
