// P21 — STYLE CLASSES. Schema 12 publishes a ready `cssClass` on every Figma
// style: a `selector`, `declarations[]` already bound to `var(--token,
// fallback)`, and the `css` those two compose to. This module writes them into
// `styles.generated.css` VERBATIM — it never derives a selector from a style
// name, never reorders or recomputes a declaration, and never converts a unit.
// Everything it decides is WHICH styles are emitted, in WHAT order, and AS
// WHAT RULE FORM (`config.styles.emit`); every byte inside a declaration is
// the export's, with exactly one documented exception: a TEXT declaration's
// `font-family` literal is rebound to the export's own font-family variable
// when the two states the same value (the plugin's own gap — see
// `bindFontFamily` below).
//
// See docs/POLICIES.md P21.
import { generatedHeader, handAuthoredName } from "./header.mjs";
import { cmp } from "./resolve.mjs";
import { webName } from "./schema.mjs";

/**
 * Emission order. TEXT first — those are the classes a design system swaps its
 * hand-authored type utilities for — then EFFECT, then GRID. PAINT is last and
 * usually empty: a paint style is one colour, which the export publishes as a
 * variable, so it only earns a class when the export itself gives one
 * declarations.
 */
const TYPE_ORDER = ["TEXT", "EFFECT", "GRID", "PAINT"];

/** Declarations compared for P21's hand-authored-wins rule, whitespace-flat. */
const normalise = (decls) => decls.map((d) => String(d).trim().replace(/\s*;\s*$/, "").replace(/\s+/g, " "));

/**
 * P21 findings about the EXPORT, raised per style and never fixed here.
 *
 *   STYLE_CLASS_UNSCOPED  the selector is the style's bare LEAF name with
 *                         nothing in front of it (`.default` for the grid style
 *                         `default`), so it collides with any other `.default`
 *                         in the consuming stylesheet. A scoped selector
 *                         carries a group or a type prefix (`.grid-default`,
 *                         `.effect-border-border-focused`,
 *                         `.title-style1-100`). Renaming one here would break
 *                         P21's own verbatim contract, so it is reported.
 *   STYLE_CLASS_LITERAL   a declaration states a raw literal OUTSIDE any
 *                         `var()` for a property the SAME style binds to a
 *                         variable — `rawStyleProperties` classifies the path
 *                         `raw` while a sibling `boundVariables.<prop>` path is
 *                         `variable-bound`. The class therefore freezes a value
 *                         the design system can retheme. A literal inside a
 *                         `var(--token, <fallback>)` is not frozen — that IS
 *                         the binding — so `var()` expressions are stripped
 *                         before the literal is looked for.
 *
 * Both reported zero on the schema 13 export of 2026-09-12T13:43Z, which is
 * what the plugin fixed them at the source in response to. They stay as checks.
 */
const boundPaths = (style) => {
  const out = new Map(); // the path the binding covers -> variableId
  for (const e of style.rawStyleProperties ?? []) {
    if (e.classification !== "variable-bound") continue;
    // `effects[0].boundVariables.color` binds `effects[0].color`;
    // `boundVariables.effects[0]` binds `effects[0]`.
    out.set(String(e.path).replace(/(?:^|\.)boundVariables\./, (m) => (m[0] === "." ? "." : "")), e.variableId);
  }
  return out;
};

/**
 * Does `decl` state `value` as a FROZEN literal — outside every `var()`? Bare
 * and `px`-suffixed, since the export writes a Figma number either way.
 */
const statesLiteral = (decl, value) => {
  const outsideVar = decl.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, " ");
  const forms = typeof value === "number" ? [`${value}px`, `${value}`] : [String(value)];
  return forms.some((f) => new RegExp(`(^|[\\s:,(])${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[\\s;,)])`, "i").test(outsideVar));
};

/**
 * P21 font binding. A TEXT declaration's `font-family` literal is exactly the
 * value of a font-family variable elsewhere in the export (`family/*`, or any
 * STRING variable in a `font`/`family` group) — the plugin gap this closes:
 * schema 12/13 states the literal rather than the `var()` its own variable
 * publishes. Matched on VALUE, not name: the binding is provable (the
 * variable's own raw value equals the class's stated literal), never guessed.
 */
const familyVariables = (doc) => {
  const byValue = new Map(); // variable's raw STRING value -> the variable
  for (const c of doc.collections ?? []) {
    for (const v of c.variables ?? []) {
      if (v.type !== "STRING") continue;
      const group = v.name.split("/")[0];
      if (group !== "family" && group !== "font") continue;
      const raw = v.modes?.[0]?.raw;
      if (raw != null && !byValue.has(raw)) byValue.set(raw, v);
    }
  }
  return byValue;
};

const FONT_FAMILY_DECL = /^font-family:\s*(.+)$/;

/**
 * P23 (0.8.0) — a TEXT style's `paragraphSpacing` is bound to a variable
 * (`properties.boundVariables.paragraphSpacing`) whenever the design system
 * gives it a token, the same as every other typographic property — but the
 * export's own `cssClass.declarations` states nothing for it (a plugin gap,
 * the paragraph-spacing counterpart of the `font-family` gap `bindFontFamily`
 * already closes). Per operator ruling 2026-09-19 ("they were both design
 * system things — the text style should carry them") and the spacer-margins
 * mechanism (`handoff-to-code` § Build standards item 7 — a paragraph gap is
 * a trailing margin on the block it edges, never a literal), one additive
 * declaration is appended: `margin-block-end: var(<token>, <raw>px)`.
 *
 * Additive only — never touches an existing declaration, and never fires when
 * the style already states `margin-block*` itself.
 */
function bindParagraphSpacing(type, style, declarations, byId) {
  if (type !== "TEXT") return { declarations, findings: [] };
  const bound = style.properties?.boundVariables?.paragraphSpacing;
  if (!bound?.id) return { declarations, findings: [] };
  if (declarations.some((d) => /^margin-block/.test(d))) return { declarations, findings: [] };

  const variable = byId.get(bound.id);
  if (!variable) return { declarations, findings: [] };
  const name = webName(variable);
  const raw = style.properties.paragraphSpacing;
  const fallback = typeof raw === "number" ? `${raw}px` : "0px";
  const selector = style.cssClass.selector;
  return {
    declarations: [...declarations, `margin-block-end: var(${name}, ${fallback})`],
    findings: [{
      code: "STYLE_CLASS_PARAGRAPH_SPACING_BOUND",
      name: selector,
      detail: `\`paragraphSpacing\` bound to \`${name}\` (\`${variable.name}\`), stated nowhere in this style's own \`cssClass.declarations\` — appended as \`margin-block-end: var(${name}, ${fallback})\` (P23, spacer-margins policy).`,
    }],
  };
}

/**
 * Bind every TEXT declaration's `font-family` literal to its matching
 * font-family variable, one substitution per declaration, everything else
 * untouched. Returns the (possibly rewritten) declarations and the findings
 * the substitution — or its absence — raises.
 */
function bindFontFamily(type, selector, declarations, familyByValue) {
  if (type !== "TEXT") return { declarations, findings: [] };
  const findings = [];
  const out = declarations.map((decl) => {
    const m = FONT_FAMILY_DECL.exec(decl);
    if (!m) return decl;
    const literal = m[1].trim();
    if (literal.startsWith("var(")) return decl; // already bound
    const bare = literal.replace(/^"(.*)"$/, "$1");
    const variable = familyByValue.get(bare);
    if (!variable) {
      findings.push({
        code: "STYLE_CLASS_FONT_LITERAL",
        name: selector,
        detail: `\`${decl}\` states the literal ${literal}, and no font-family variable in the export shares that value — emitted verbatim (P21).`,
      });
      return decl;
    }
    findings.push({
      code: "STYLE_CLASS_FONT_BOUND",
      name: selector,
      detail: `\`font-family\` literal ${literal} bound to \`${webName(variable)}\` (\`${variable.name}\`), the export's own font-family variable of the same value.`,
    });
    return `font-family: var(${webName(variable)}, ${literal})`;
  });
  return { declarations: out, findings };
}

function styleFindings(style, declarations, byId) {
  const findings = [];
  const selector = style.cssClass.selector;
  if (style.leafName && selector === `.${style.leafName}`) {
    findings.push({
      code: "STYLE_CLASS_UNSCOPED",
      name: selector,
      detail: `the selector is style \`${style.name}\`'s bare leaf name with nothing in front of it, so it collides with any same-named class in the consuming stylesheet. A scoped selector carries its group or its style type (\`.grid-${style.leafName}\`). Emitted verbatim (P21); the prefix belongs in the export.`,
    });
  }

  const bound = boundPaths(style);
  for (const e of style.rawStyleProperties ?? []) {
    if (e.classification !== "raw") continue;
    const variableId = bound.get(e.path);
    if (variableId == null) continue;
    const decl = declarations.find((d) => statesLiteral(d, e.value));
    if (!decl) continue;
    const target = byId.get(variableId);
    findings.push({
      code: "STYLE_CLASS_LITERAL",
      name: selector,
      detail: `\`${decl}\` states the literal \`${e.value}\` for \`${e.path}\`, which this style BINDS to ${target ? `\`${webName(target)}\`` : `variable ${variableId}`} — the class freezes a value the design system can retheme. Emitted verbatim (P21); the fix is for the export to state the \`var()\`.`,
    });
  }
  return findings;
}

/**
 * @param doc          the parsed export (schema 12+; older exports carry no
 *                     `cssClass` and yield no rows, so nothing is written)
 * @param byId         id -> variable, from `indexById`
 * @param handClasses  `.foo` -> declarations, from `readHandAuthored`
 * @param handUtils    top-level `@utility foo` names, from `readHandAuthored`
 * @returns {{ css: string|null, rows: Array, warnings: Array }}
 */
export function emitStyles(doc, byId, handClasses, handUtils, cfg) {
  const rows = [];
  const warnings = [];
  const blocks = [];
  const familyByValue = familyVariables(doc);
  const emitAsUtility = cfg.styles?.emit !== "class";

  for (const type of TYPE_ORDER) {
    const emitted = [];
    for (const style of doc.styles?.[type] ?? []) {
      const cssClass = style.cssClass;
      const selector = cssClass?.selector ?? style.codeSyntax?.className ?? null;
      let declarations = normalise(cssClass?.declarations ?? []);
      const base = { type, style: style.name, selector, shadowed: false };

      // A style the export gives no declarations for is not a class. PAINT is
      // the whole of this case today — reported so the follow-up knows, never
      // invented from `properties`.
      if (!selector || declarations.length === 0) {
        rows.push({ ...base, status: "NO-DECLARATIONS", declarations: [], hand: null });
        continue;
      }

      const bound = bindFontFamily(type, selector, declarations, familyByValue);
      declarations = bound.declarations;
      warnings.push(...bound.findings);
      const spacing = bindParagraphSpacing(type, style, declarations, byId);
      declarations = spacing.declarations;
      warnings.push(...spacing.findings);
      warnings.push(...styleFindings(style, declarations, byId));
      const shadowed = handUtils.has(selector.slice(1));
      const hand = handClasses.get(selector) ?? null;

      if (hand) {
        // P2/P21 — the consumer declares this selector by hand, so it wins the
        // cascade and the generator stands down, exactly as it does per token.
        const handDecls = normalise(hand);
        rows.push({
          ...base,
          shadowed,
          declarations,
          hand: handDecls,
          status: handDecls.join("; ") === declarations.join("; ") ? "MATCH" : "VALUE-DRIFT",
        });
        continue;
      }

      rows.push({ ...base, shadowed, declarations, hand: null, status: "GENERATED" });
      // P21 — house policy writes a Tailwind v4 `@utility`, not a plain class:
      // `@apply` can reach it, and it lives in the utilities layer under the
      // normal cascade instead of sitting unlayered above it. `cfg.styles.emit`
      // opts a consumer back into the bare `<selector> { … }` of 0.5.0.
      const opening = emitAsUtility ? `@utility ${selector.slice(1)}` : selector;
      emitted.push(`${opening} {\n${declarations.map((d) => `  ${d};`).join("\n")}\n}`);
    }

    if (emitted.length) {
      const label = `${type} (${emitted.length})`;
      blocks.push([`/* --- ${label} ${"-".repeat(Math.max(0, 60 - label.length))} */`, "", ...emitted].join("\n"));
    }
  }

  warnings.sort((a, b) => cmp(a.code + a.name + a.detail, b.code + b.name + b.detail));
  // No class to write — an export older than schema 12 (no `cssClass` at all),
  // or one whose every class the consumer already declares by hand. Either way
  // no file is produced, so an 8-11 consumer's outputs are unchanged.
  if (!rows.some((r) => r.status === "GENERATED")) return { css: null, rows, warnings };

  const header = generatedHeader(doc, cfg, [
    "   One class per Figma style, from the export's own `cssClass` — selector and",
    "   declarations verbatim, in the export's order (policy P21). A class already",
    `   declared by hand in ${handAuthoredName(cfg)} wins the cascade and is not emitted;`,
    "   the reconciliation report lists every style and its status.",
  ]);

  return { css: `${header}${blocks.join("\n\n")}\n`, rows, warnings };
}
