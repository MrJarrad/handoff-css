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
import { sourcePhrase } from "./config.mjs";
import { resolveName, stripComments } from "./conform.mjs";

const VAR = /var\(\s*(--[a-z0-9-]+)/gi;
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

/** The end of the balanced `(...)` opening at `open`. */
function closeParen(value, open) {
  let depth = 0;
  for (let i = open; i < value.length; i += 1) {
    if (value[i] === "(") depth += 1;
    if (value[i] === ")" && --depth === 0) return i + 1;
  }
  return value.length;
}

const COLOUR_FN = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX = /^#[0-9a-f]{3,8}(?![\w-])/i;
const WORD = /^[a-z]+(?![\w(-])/i;
// CSS named colours (not the keywords `transparent` / `currentcolor`, which paint nothing of their own).
const NAMED_COLOURS = new Set([
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black", "blanchedalmond",
  "blue", "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse", "chocolate", "coral",
  "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray",
  "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen", "darkorange", "darkorchid",
  "darkred", "darksalmon", "darkseagreen", "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise",
  "darkviolet", "deeppink", "deepskyblue", "dimgray", "dimgrey", "dodgerblue", "firebrick", "floralwhite",
  "forestgreen", "fuchsia", "gainsboro", "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow",
  "grey", "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender", "lavenderblush",
  "lawngreen", "lemonchiffon", "lightblue", "lightcoral", "lightcyan", "lightgoldenrodyellow", "lightgray",
  "lightgreen", "lightgrey", "lightpink", "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray",
  "lightslategrey", "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta", "maroon",
  "mediumaquamarine", "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue",
  "mediumspringgreen", "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream", "mistyrose",
  "moccasin", "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange", "orangered", "orchid",
  "palegoldenrod", "palegreen", "paleturquoise", "palevioletred", "papayawhip", "peachpuff", "peru", "pink",
  "plum", "powderblue", "purple", "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown", "salmon",
  "sandybrown", "seagreen", "seashell", "sienna", "silver", "skyblue", "slateblue", "slategray", "slategrey",
  "snow", "springgreen", "steelblue", "tan", "teal", "thistle", "tomato", "turquoise", "violet", "wheat",
  "white", "whitesmoke", "yellow", "yellowgreen",
]);

/**
 * The raw colour literals a value paints with (hex, colour function, named colour), outside any
 * `var()` or `url()`. A `var()` fallback
 * is not a paint (the name check owns an undefined name), and a colour function that
 * reads a colour token (`rgb(from var(--x) r g b / 0.5)`) is a modified use, not a literal.
 * A colour function whose `var()`s are all non-colour tokens (`rgb(255 0 0 / var(--opacity-50))`)
 * is still a raw colour, and is a literal as a whole.
 * `isColourName` says whether a `var()` name reads a colour.
 */
function literalColours(value, isColourName) {
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    if (/[\w-]/.test(value[i - 1] ?? "")) continue;
    const rest = value.slice(i);
    if (/^(?:var|url)\(/i.test(rest)) { i = closeParen(value, i + rest.indexOf("(")) - 1; continue; }
    if (COLOUR_FN.test(rest)) {
      const end = closeParen(value, i + rest.indexOf("("));
      const span = value.slice(i, end);
      const names = [...span.matchAll(VAR)].map((m) => m[1]);
      if (!names.some(isColourName)) out.push(span);
      i = end - 1;
      continue;
    }
    const hex = HEX.exec(rest);
    if (hex) { out.push(hex[0]); i += hex[0].length - 1; continue; }
    const named = WORD.exec(rest);
    if (named) {
      if (NAMED_COLOURS.has(named[0].toLowerCase())) out.push(named[0]);
      i += named[0].length - 1;
    }
  }
  return out;
}

/** The reads of one declaration that matter to colour: names, and the raw literals beside them. */
function reads(value, exported, colourNames) {
  const names = [...value.matchAll(VAR)].map((m) => m[1]);
  const isColourName = (n) => colourNames.has(n) || !exported.has(n);
  const colour = names.filter(isColourName);
  const bare = /^var\(\s*--[a-z0-9-]+\s*\)$/i.test(value);
  return { value, colour, bare, literals: literalColours(value, isColourName) };
}

/** The finding for the token names a declaration reads, or null when they conform. */
function nameFinding(r, b, exported, graph, phrase) {
  // A name the export states is itself; only a name it does not state hops the alias graph
  // (the generated sheet's per-mode blocks alias semantic names to primitives).
  const resolvedReads = r.colour.map((n) => (exported.has(n) ? n : resolveName(n, graph)));
  const bound = resolvedReads.filter((n) => b.names.includes(n));
  const others = r.colour.filter((n, i) => !b.names.includes(resolvedReads[i]));
  if (bound.length && others.length === 0) {
    if (r.bare || b.property === "box-shadow") return null; // a ring is a width plus the colour: not a modified use
    return { code: "COMPONENT_TOKEN_MODIFIED", severity: "amber", reads: r.colour,
      message: (show) => `reads the bound ${show(bound)} inside \`${r.value.slice(0, 70)}\` — the system states the token whole, not a modified use of it` };
  }
  const local = others.filter((n) => !exported.has(exported.has(n) ? n : resolveName(n, graph)));
  if (local.length && local.length === others.length && !bound.length) {
    return { code: "CODE_ONLY_TOKEN", severity: "amber", reads: others,
      message: (show) => `reads ${show(others)}, a name ${phrase} never states — code-only, binds ${show(b.names)}` };
  }
  return { code: "COMPONENT_TOKEN_DRIFT", severity: "red", reads: others,
    message: (show) => `reads ${show(others)}, binds ${show(b.names)}` };
}

/**
 * @param {object} input.doc       the parsed export
 * @param {object} input.bindings  `{ bindings: [{ id, component?, selectors, when?, except?, property, variable }] }`
 * @param {{path, text}[]} input.files
 * @param {Map} input.graph        the generated sheet's alias graph (`aliasGraph`)
 * @param {object} [input.source]  `sourceOf(config)`: names the source's export in the findings; omitted reads as the default
 */
export function componentDrift({ doc, bindings, files, graph, source = null }) {
  const phrase = source ? sourcePhrase(source) : "the export";
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
        const at = { file, line: d.line, binding: b.id, component: b.component, property, binds: b.names, selector: context };
        if (r.colour.length === 0 && r.literals.length === 0) continue; // width/opacity-only or neutral: no colour read
        const show = (list) => list.map((n) => `\`${n}\``).join(", ");
        const where = `${b.component ? `${b.component} ` : ""}${b.id} (${property}, line ${d.line})`;

        if (r.colour.length === 0) {
          findings.push({ code: "COMPONENT_TOKEN_DRIFT", severity: "red", ...at, reads: [value],
            message: `${where}: reads the literal \`${value}\`, binds ${show(b.names)} — a raw value where the system states a token` });
          continue;
        }
        const named = nameFinding(r, b, exported, graph, phrase);
        if (named) findings.push({ ...named, ...at, message: `${where}: ${named.message(show)}` });
        // A literal beside a token read is a raw value the export never states, whatever the token verdict.
        if (r.literals.length) {
          findings.push({ code: "CODE_ONLY_TOKEN", severity: "amber", ...at, reads: r.literals,
            message: `${where}: reads the literal ${show(r.literals)} beside ${show(r.colour)}, binds ${show(b.names)} — a raw value ${phrase} never states` });
        }
      }
    }
  }
  return findings;
}
