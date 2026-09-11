// P16 — CONSUMER CONFORMANCE. The third joint: nothing checked a consumer's
// own stylesheet back against the pair it claims to be built from. The
// generator proves the TOKENS are right; this proves the CSS that consumes them
// binds the names the handoff states, by the mechanisms it names.
//
// Everything here is pure — text in, findings out — so the CLI is a renderer
// and the tests never touch a filesystem they did not build.
//
// Scope, stated: CSS only. A binding that lives in markup (a Tailwind class, a
// styled component, an inline style) is invisible to this check. That is a
// named gap, not an oversight — see docs/POLICIES.md P16.

/**
 * Every finding code, with its DEFAULT severity. Red fails the run; amber
 * reports. `SAMPLE_PX_LITERAL` is the one code that carries both: red for a
 * device/viewport sample (a literal that pins one phone), amber for any other
 * token px (a style decision that happens to match a sample).
 */
export const FINDINGS = {
  UNKNOWN_NAME: "red",
  LOCAL_ONLY: "amber",
  UNMAPPED_BINDING: "amber",
  SAMPLE_PX_LITERAL: "red",
  GRID_ARITHMETIC: "red",
  PLACEHOLDER_COPY: "amber",
};

const DECLARATION = /(^|[;{\s])(--[a-z0-9-]+)\s*:/gi;
const USAGE = /var\(\s*(--[a-z0-9-]+)/gi;
const PX = /(?<![\w.-])(\d+(?:\.\d+)?)px\b/g;
const ALIAS = /^\s*(--[a-z0-9-]+)\s*:\s*var\(\s*(--[a-z0-9-]+)\s*\)\s*;/;
const DIVIDE = /calc\([^;]*?\/\s*(\d+)/;

/**
 * Comments out, line structure kept. A stylesheet's prose is full of numbers —
 * "32–80px band", a note about a 1px lead — and flagging those would drown
 * every real finding. Replacing with spaces keeps every line number true.
 */
export const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/**
 * One pass over a stylesheet. Line numbers are 1-based and are what a finding
 * cites — a conformance report a human cannot open at the line is a list of
 * opinions.
 *
 * @returns {{ declarations: {name, line}[], usages: {name, line}[],
 *             pxLiterals: {value: number, line: number, inMedia: boolean, text: string}[],
 *             lines: string[] }}
 */
export function tokenizeCss(rawText) {
  const text = stripComments(rawText);
  const lines = text.split("\n");
  const declarations = [];
  const usages = [];
  const pxLiterals = [];
  let mediaDepth = 0;
  let depth = 0;

  lines.forEach((line, i) => {
    const at = i + 1;
    const opensMedia = /^\s*@media\b/.test(line);
    if (opensMedia) mediaDepth = depth + 1;
    const inMedia = mediaDepth > 0;

    for (const m of line.matchAll(DECLARATION)) declarations.push({ name: m[2], line: at });
    for (const m of line.matchAll(USAGE)) usages.push({ name: m[1], line: at });
    // A breakpoint inside the `@media` prelude is the one px a stylesheet MUST
    // state: `@media (min-width: 768px)` cannot be written as a custom property.
    if (!opensMedia) {
      for (const m of line.matchAll(PX)) {
        pxLiterals.push({ value: Number(m[1]), line: at, inMedia, text: line.trim() });
      }
    }

    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (mediaDepth > 0 && depth < mediaDepth) mediaDepth = 0;
  });

  return { declarations, usages, pxLiterals, lines };
}

/** Every `codeSyntax.WEB.value` in the export — the only names a build may bind. */
export function exportNames(doc) {
  const names = new Set();
  for (const c of doc.collections ?? []) {
    for (const v of c.variables ?? []) {
      const name = v.codeSyntax?.WEB?.value;
      if (name) names.add(name);
    }
  }
  return names;
}

/**
 * The generated stylesheet's alias block as a graph: `--screen-height-full` ->
 * `--device-screen-height-full`. A legacy alias is a real name in the CSS even
 * though the export never states it, so a checker without this graph reports
 * every alias call site as unknown — which is how a conformance tool loses a
 * consumer's trust in one run.
 */
export function aliasGraph(tokensCss) {
  const graph = new Map();
  for (const line of tokensCss.split("\n")) {
    const m = ALIAS.exec(line);
    if (m) graph.set(m[1], m[2]);
  }
  return graph;
}

/** Follow the alias graph to the name the export states. Cycle-safe. */
export function resolveName(name, graph) {
  const seen = new Set();
  let current = name;
  while (graph.has(current) && !seen.has(current)) {
    seen.add(current);
    current = graph.get(current);
  }
  return current;
}

/**
 * What the layer brief states, as bindings: the token names, the grid columns,
 * and the copy. Takes the parse from `validate-handoff-md.mjs` — the brief is
 * parsed once, by the module that owns its grammar.
 */
export function bindingsFromHandoff(parsed) {
  const tokens = new Map(); // $path -> --web-name
  for (const t of parsed.tokens ?? []) if (t.web) tokens.set(t.token, t.web);

  const columns = new Set(); // the M in every `col-span N/M`
  const spans = [];
  for (const table of parsed.tables ?? []) {
    for (const row of table.rows ?? []) {
      for (const cell of row.cells) {
        const m = /^col-span (\d+)\/(\d+)$/.exec(cell);
        if (m) {
          spans.push({ child: row.cells[0], span: Number(m[1]), of: Number(m[2]), line: row.line });
          columns.add(Number(m[2]));
        }
      }
    }
  }

  const placeholders = (parsed.nodes ?? [])
    .filter((n) => n.placeholder && n.copy)
    .map((n) => ({ copy: n.copy, id: n.id, node: n.name, line: n.line }));

  return { tokens, spans, columns, placeholders };
}

/**
 * The px values that are DEVICE SAMPLES — a viewport's width or height, or a
 * viewport-class rule's own sample. Those are the literals the whole pipeline
 * exists to stop being pasted into a stylesheet: `height: 812px` is a sample of
 * `100dvh` taken on one phone. Every other token px is amber, because a
 * one-off spacing value is a style decision, not a device measurement.
 */
export function samplePixels(doc) {
  const device = new Set();
  // A DEVICE dimension is one that belongs to a breakpoint FAMILY. The export
  // also writes `widthPx` on samples of non-viewport mode sets — `icon-dimension/
  // height` at mode "200" carries `widthPx: 200`, the mode's own name — so a
  // checker that read every `widthPx` would call `padding: 200px` a device
  // sample. Families come from the breakpoints table, which states them.
  const families = new Set();
  for (const e of doc.breakpoints?.entries ?? []) {
    if (e.isTheme || e.family == null) continue;
    families.add(e.family);
    for (const v of [e.widthPx, e.heightPx]) if (typeof v === "number" && v > 0) device.add(v);
  }
  const token = new Set();
  for (const c of doc.collections ?? []) {
    for (const v of c.variables ?? []) {
      for (const rule of v.responsiveBehavior?.rules ?? []) {
        for (const s of rule.samples ?? []) {
          // The device set is VIEWPORT DIMENSIONS only — the sample's own
          // `widthPx`/`heightPx`, which are the device it was measured on. A
          // rule's `rawPx` is NOT read into it even when the rule claims a
          // viewport strategy: the 2026-09-10 export mis-tags ~57 non-device
          // variables that way (memo Addendum 2, rule 2), and a checker that
          // trusted the tag would call a 14px type step a device sample.
          if (families.has(s.family)) {
            if (typeof s.widthPx === "number") device.add(s.widthPx);
            if (typeof s.heightPx === "number") device.add(s.heightPx);
          }
          if (typeof s.rawPx === "number" && s.rawPx > 0) token.add(s.rawPx);
        }
      }
    }
  }
  return { device, token };
}

/**
 * Check a consumer's stylesheets against the pair.
 *
 * @param {object}   input.doc        the parsed export
 * @param {object}   input.handoff    `parseHandoffMarkdown(...)` output
 * @param {string}   input.tokensCss  the generated tokens stylesheet
 * @param {{path: string, text: string}[]} input.files the consumer's own CSS
 * @param {string[]} [input.allowNames] custom-property names that legitimately
 *   come from outside the export (`--font-suisse`: this package tells consumers
 *   to supply their own font face). An allowed name never raises
 *   `UNKNOWN_NAME`. It answers exactly that one question and is not a mute
 *   button: a name declared in the consumer's own stylesheet is still
 *   `LOCAL_ONLY`, because that is a different claim about a different mistake.
 * @returns {{ findings: {code, severity, file, line, name?, message}[], summary: object }}
 */
export function conform({ doc, handoff, tokensCss, files, allowNames = [] }) {
  const allowed = new Set(allowNames);
  const findings = [];
  const add = (code, file, line, message, name, severity = FINDINGS[code]) =>
    findings.push({ code, severity, file, line, name, message });

  const exported = exportNames(doc);
  const graph = aliasGraph(tokensCss);
  const generated = new Set(tokenizeCss(tokensCss).declarations.map((d) => d.name));
  const bindings = bindingsFromHandoff(handoff);
  const samples = samplePixels(doc);
  const placeholderCopy = new Set(bindings.placeholders.map((p) => p.copy));

  // A binding the brief states that the generated CSS never declares. Amber,
  // not red: `handoff-to-code` step 3 calls it a defect to BUILD around, and
  // the fix is upstream (an exclusion, a hidden variable, a stale export).
  for (const [token, web] of bindings.tokens) {
    if (!generated.has(web) && !exported.has(web)) {
      add("UNMAPPED_BINDING", handoff.file ?? "<handoff>", handoff.tokens.find((t) => t.token === token)?.line ?? 0,
        `$${token} states \`${web}\`, which the generated tokens never declare — bind nothing until the export is fixed`, web);
    }
  }

  for (const { path: file, text: raw } of files) {
    // Comments out once, for every pass over this file: a stylesheet's prose
    // names the very patterns being looked for (the portfolio's own header
    // block explains `--nav-col-unit` in words), and a checker that reports a
    // comment is a checker nobody runs twice.
    const text = stripComments(raw);
    const { declarations, usages, pxLiterals } = tokenizeCss(text);
    const local = new Set(declarations.map((d) => d.name));

    for (const { name, line } of usages) {
      const resolved = resolveName(name, graph);
      if (exported.has(resolved) || generated.has(resolved)) continue;
      if (local.has(name)) {
        add("LOCAL_ONLY", file, line,
          `\`${name}\` is declared in this stylesheet and is not an export name — a local value, not a token`, name);
      } else if (!allowed.has(name)) {
        add("UNKNOWN_NAME", file, line,
          `\`${name}\` is in neither the export nor the generated tokens (and nothing declares it here)`, name);
      }
    }

    for (const { value, line, inMedia, text: source } of pxLiterals) {
      if (samples.device.has(value)) {
        // A breakpoint width restated inside a media block's own rules is
        // still a sample; only the `@media` prelude is exempt (tokenizeCss).
        add("SAMPLE_PX_LITERAL", file, line,
          `${value}px is a device/viewport sample from the export — bind the token, never the sample (${source.slice(0, 60)})`);
      } else if (samples.token.has(value) && !inMedia) {
        add("SAMPLE_PX_LITERAL", file, line,
          `${value}px matches a token's px sample — a literal that happens to match is Build standard 3's defect (${source.slice(0, 60)})`,
          undefined, "amber");
      }
    }

    // Build standard 5: a `[Grid]` frame is a grid container, and `col-span
    // N/M` is `grid-column: span N`. Column maths that divides by M reproduces
    // the number by the wrong mechanism — right measurement, wrong build.
    for (const [i, line] of text.split("\n").entries()) {
      const divide = DIVIDE.exec(line);
      const byName = /--[a-z0-9-]*col-unit\b/.test(line);
      if ((divide && bindings.columns.has(Number(divide[1]))) || byName) {
        add("GRID_ARITHMETIC", file, i + 1,
          `column maths where the handoff states \`col-span N/${divide ? divide[1] : [...bindings.columns][0] ?? "M"}\` — Build standard 5 names a grid container and \`grid-column: span N\` (${line.trim().slice(0, 80)})`);
      }
    }

    // A `⚠ placeholder` string the design has NOT stated, shipped as content.
    for (const [i, line] of text.split("\n").entries()) {
      const m = /content\s*:\s*["']([^"']+)["']/.exec(line);
      if (m && placeholderCopy.has(m[1])) {
        add("PLACEHOLDER_COPY", file, i + 1,
          `"${m[1]}" is flagged \`⚠ placeholder\` in the handoff — the design has not stated this copy`);
      }
    }
  }

  findings.sort((a, b) => String(a.file).localeCompare(String(b.file)) || a.line - b.line || a.code.localeCompare(b.code));
  const summary = {
    files: files.length,
    red: findings.filter((f) => f.severity === "red").length,
    amber: findings.filter((f) => f.severity === "amber").length,
    byCode: Object.fromEntries(
      Object.keys(FINDINGS).map((code) => [code, findings.filter((f) => f.code === code).length]),
    ),
  };
  return { findings, summary };
}

/** The human report. One block per file, worst first. */
export function renderMarkdown({ findings, summary }) {
  const out = [`# handoff-css conform`, "",
    `${summary.files} stylesheet${summary.files === 1 ? "" : "s"} · **${summary.red} red** · ${summary.amber} amber`, ""];
  if (findings.length === 0) {
    out.push("No findings: every binding in these stylesheets is a name the export states.", "");
    return out.join("\n");
  }
  let file = null;
  for (const f of findings) {
    if (f.file !== file) {
      file = f.file;
      out.push(`## ${file}`, "");
    }
    out.push(`- ${f.severity === "red" ? "✗" : "⚠"} \`${f.code}\` line ${f.line} — ${f.message}`);
  }
  out.push("");
  return out.join("\n");
}

export const renderJson = ({ findings, summary }) => `${JSON.stringify({ summary, findings }, null, 2)}\n`;
