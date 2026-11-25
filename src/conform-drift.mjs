// COMPONENT TOKEN DRIFT. `conform` proves every name a stylesheet reads is
// a name the export states; this proves a component's rule reads the RIGHT one.
// A code-only override (a rule that paints a component with a different token than
// the design system binds it to) passes every name check and only surfaces in review.
//
// The export states no per-property component bindings (its `components[]` carry
// variant axes; `usage.topConsumers` stops at five nodes and names no property), so
// the bindings are an input: component -> property -> design-system variable, by
// variable name only. Names resolve to CSS names through `codeSyntax.WEB`; a
// variable the export does not state is an error, never a silent skip.
//
// Pure: text in, findings out.
import { resolveName, stripComments } from "./conform.mjs";

const VAR = /var\(\s*(--[a-z0-9-]+)/gi;
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const NEUTRAL = new Set(["transparent", "currentcolor", "inherit", "initial", "unset", "none", "revert"]);
// Tailwind colour utilities and the property each paints.
const APPLY_PROPERTY = { bg: "background-color", text: "color", border: "border-color", ring: "box-shadow", outline: "outline-color", shadow: "box-shadow" };

/**
 * Every declaration in a stylesheet with its nesting stack (preludes, outermost
 * first) and 1-based line. Handles CSS nesting and `@utility`, which is how the
 * design system's Tailwind source is written. `@apply a b` is expanded into one
 * pseudo-declaration per utility, property `@apply:<property>`.
 */
export function parseDeclarations(rawText) {
  const text = stripComments(rawText);
  const out = [];
  const stack = [];
  let buf = "";
  let bufLine = 1;
  let line = 1;
  let paren = 0;
  let quote = null;
  const flush = () => {
    const decl = buf.trim();
    buf = "";
    if (!decl) return;
    const apply = /^@apply\s+([\s\S]+)$/.exec(decl);
    if (apply) {
      for (const util of apply[1].trim().split(/\s+/)) out.push({ property: "@apply", value: util, line: bufLine, stack: [...stack] });
      return;
    }
    const m = /^([a-z-]+)\s*:\s*([\s\S]+)$/i.exec(decl);
    if (m) out.push({ property: m[1].toLowerCase(), value: m[2].trim().replace(/\s+/g, " "), line: bufLine, stack: [...stack] });
  };
  for (const ch of text) {
    if (buf.trim() === "" && ch.trim() !== "") bufLine = line;
    if (ch === "\n") line += 1;
    if (quote) { buf += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === "(") paren += 1;
    if (ch === ")") paren = Math.max(0, paren - 1);
    if (paren === 0 && ch === "{") { stack.push(buf.trim().replace(/\s+/g, " ")); buf = ""; continue; }
    if (paren === 0 && ch === "}") { flush(); stack.pop(); continue; }
    if (paren === 0 && ch === ";") { flush(); continue; }
    buf += ch;
  }
  flush();
  return out;
}

/** Bindings with their variable names resolved to the export's CSS names. */
export function resolveBindings(doc, spec) {
  const byName = new Map();
  for (const c of doc.collections ?? []) for (const v of c.variables ?? []) byName.set(v.name, v);
  return (spec.bindings ?? []).map((b) => {
    const names = [b.variable].flat().map((variable) => {
      const css = byName.get(variable)?.codeSyntax?.WEB?.value;
      if (!css) throw new Error(`binding ${b.id}: variable \`${variable}\` is not in the export (no codeSyntax.WEB name)`);
      return css;
    });
    return { ...b, names, selectors: b.selectors ?? [] };
  });
}

const word = (s) => new RegExp(`(^|[^\\w-])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);

/** The reads of one declaration that matter to colour: names, whether a literal is present. */
function reads(value, exported, colourNames) {
  const names = [...value.matchAll(VAR)].map((m) => m[1]);
  const colour = names.filter((n) => colourNames.has(n) || !exported.has(n));
  const bare = /^var\(\s*--[a-z0-9-]+\s*\)$/i.test(value);
  const literal = names.length === 0 && LITERAL_COLOUR.test(value);
  return { colour, bare, literal };
}

/**
 * @param {object} input.doc       the parsed export
 * @param {object} input.bindings  `{ bindings: [{ id, component?, selectors, when?, except?, property, variable }] }`
 * @param {{path, text}[]} input.files
 * @param {Map} input.graph        the generated sheet's alias graph (`aliasGraph`)
 */
export function componentDrift({ doc, bindings, files, graph }) {
  const resolved = resolveBindings(doc, bindings);
  const exported = new Set();
  const colourNames = new Set();
  for (const c of doc.collections ?? []) {
    for (const v of c.variables ?? []) {
      const n = v.codeSyntax?.WEB?.value;
      if (!n) continue;
      exported.add(n);
      if (v.type === "COLOR") colourNames.add(n);
    }
  }
  const findings = [];
  for (const { path: file, text } of files) {
    for (const d of parseDeclarations(text)) {
      const context = d.stack.join(" ");
      for (const b of resolved) {
        if (!b.selectors.some((s) => d.stack.some((p) => word(s).test(p)))) continue;
        if (b.when && !context.includes(b.when)) continue;
        if (b.except?.some((e) => context.includes(e))) continue;

        let property = d.property;
        let value = d.value;
        if (property === "@apply") {
          // `disabled:bg-x` -> variant prefix dropped from the property test, kept in the context.
          const m = /^((?:[^:\s]+:)*)(bg|text|border|ring|outline|shadow)-([a-z0-9-]+)$/.exec(value);
          if (!m || !exported.has(`--${m[3]}`)) continue;
          if (b.except?.some((e) => m[1].includes(e.replace(/^:/, "")))) continue;
          property = APPLY_PROPERTY[m[2]];
          value = `var(--${m[3]})`;
        }
        if (property === "background") property = "background-color";
        if (property !== b.property) continue;
        if (NEUTRAL.has(value.toLowerCase())) continue;

        const r = reads(value, exported, colourNames);
        // A name the export states is itself; only a name it does not state hops the alias graph
        // (the generated sheet's per-mode blocks alias semantic names to primitives).
        const resolvedReads = r.colour.map((n) => (exported.has(n) ? n : resolveName(n, graph)));
        const at = { file, line: d.line, binding: b.id, component: b.component, property, binds: b.names, selector: context };
        if (r.colour.length === 0 && !r.literal) continue; // width/opacity-only or neutral: no colour read
        const show = (list) => list.map((n) => `\`${n}\``).join(", ");
        const where = `${b.component ? `${b.component} ` : ""}${b.id} (${property}, line ${d.line})`;

        if (r.literal) {
          findings.push({ code: "COMPONENT_TOKEN_DRIFT", severity: "red", ...at, reads: [value],
            message: `${where}: reads the literal \`${value}\`, binds ${show(b.names)} — a raw value where the system states a token` });
          continue;
        }
        const bound = resolvedReads.filter((n) => b.names.includes(n));
        const others = r.colour.filter((n, i) => !b.names.includes(resolvedReads[i]));
        if (bound.length && others.length === 0) {
          if (r.bare || property === "box-shadow") continue; // a ring is a width plus the colour: not a modified use
          findings.push({ code: "COMPONENT_TOKEN_MODIFIED", severity: "amber", ...at, reads: r.colour,
            message: `${where}: reads the bound ${show(bound)} inside \`${value.slice(0, 70)}\` — the system states the token whole, not a modified use of it` });
          continue;
        }
        const local = others.filter((n) => !exported.has(exported.has(n) ? n : resolveName(n, graph)));
        if (local.length && local.length === others.length && !bound.length) {
          findings.push({ code: "CODE_ONLY_TOKEN", severity: "amber", ...at, reads: others,
            message: `${where}: reads ${show(others)}, a name the export never states — code-only, binds ${show(b.names)}` });
          continue;
        }
        findings.push({ code: "COMPONENT_TOKEN_DRIFT", severity: "red", ...at, reads: others,
          message: `${where}: reads ${show(others)}, binds ${show(b.names)}` });
      }
    }
  }
  return findings;
}
