// `handoff-css components --src` — a component's structure read from code, and the comparison with the
// component profile built from layer exports.
//
// Pure: file texts in, structure out. The scan reads the TypeScript/JSX shapes a React component
// is written in: its props (destructured parameters joined to the props type, inline or named), a prop's
// variant options (a string-literal union, or a named alias of one; a boolean is false/true), and its
// composition (the scanned components its JSX renders). It is a text scan, not a type checker: a props
// type it cannot see into (a generic, an import from another package) is listed under `extends`, never guessed.
// Names compare 1:1 once case and separators are set aside; nothing is matched by similarity.
const SCRIPT = /\.(tsx|jsx)$/;

/** Comments replaced by spaces (lines kept); string and template literals left alone. */
function stripComments(text) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i], n = text[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && n === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop - 1;
    } else if (c === "/" && n === "/" && text[i - 1] !== ":") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      out += " ".repeat(stop - i);
      i = stop - 1;
    } else out += c;
  }
  return out;
}

const OPEN = "({[<", CLOSE = ")}]>";
/** Index of the bracket closing the one at `at` (arrow `=>` is not a bracket), or -1. */
function closing(text, at) {
  let depth = 0;
  for (let i = at; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      i += 1;
      while (i < text.length && text[i] !== c) i += text[i] === "\\" ? 2 : 1;
    } else if (c === ">" && text[i - 1] === "=") continue;
    else if (OPEN.includes(c)) depth += 1;
    else if (CLOSE.includes(c) && (depth -= 1) === 0) return i;
  }
  return -1;
}

/** Bracket depth ({ ( [ only) at the start of each line, strings and template literals skipped. */
function depthByLine(text) {
  const depths = [0];
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      i += 1;
      while (i < text.length && text[i] !== c) { if (text[i] === "\\") i += 1; else if (text[i] === "\n") depths.push(depth); i += 1; }
    } else if (c === "{" || c === "(" || c === "[") depth += 1;
    else if (c === "}" || c === ")" || c === "]") depth -= 1;
    else if (c === "\n") depths.push(depth);
  }
  return depths;
}

/** Split at top level on any of `seps`; a newline separates only when the member is complete (not before or after `|`/`&`). */
function splitTop(text, seps, { newline = false } = {}) {
  const parts = [];
  let depth = 0, from = 0;
  const cut = (to) => { parts.push(text.slice(from, to)); from = to + 1; };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      i += 1;
      while (i < text.length && text[i] !== c) i += text[i] === "\\" ? 2 : 1;
    } else if (c === ">" && text[i - 1] === "=") continue;
    else if (OPEN.includes(c)) depth += 1;
    else if (CLOSE.includes(c)) depth -= 1;
    else if (depth === 0 && seps.includes(c)) cut(i);
    else if (depth === 0 && newline && c === "\n") {
      const before = text.slice(from, i).trimEnd(), after = text.slice(i + 1).trimStart();
      if (before && !/[|&:=]$/.test(before) && !/^[|&]/.test(after)) cut(i);
    }
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const squash = (s) => s.replace(/\s+/g, " ").replace(/\s*([|&])\s*/g, " $1 ").trim();
const literals = (type) => {
  const alts = splitTop(type.replace(/^\s*\|/, ""), "|");
  const strings = alts.map((a) => /^["'`]([^"'`]*)["'`]$/.exec(a)?.[1]);
  return alts.length && strings.every((s) => s !== undefined) ? strings : null;
};

function readTypes(text) {
  const aliases = new Map(), shapes = new Map();
  for (const m of text.matchAll(/(?:^|\n)\s*(?:export\s+)?(type|interface)\s+([A-Z]\w*)\s*(?:<[^>]*>)?\s*(=)?\s*/g)) {
    const start = m.index + m[0].length;
    if (m[1] === "interface" || text[start] === "{") {
      const at = m[1] === "interface" ? text.indexOf("{", start) : start;
      const end = closing(text, at);
      if (at !== -1 && end !== -1) shapes.set(m[2], text.slice(at + 1, end));
    } else {
      const body = splitTop(text.slice(start), [";"], { newline: true })[0];
      aliases.set(m[2], squash(body));
    }
  }
  return { aliases, shapes };
}

const optionsOf = (type, aliases, seen = new Set()) => {
  if (!type) return null;
  if (type === "boolean") return ["false", "true"];
  const own = literals(type);
  if (own) return own;
  if (/^[A-Z]\w*$/.test(type) && aliases.has(type) && !seen.has(type)) return optionsOf(aliases.get(type), aliases, new Set([...seen, type]));
  return null;
};

function members(body, aliases) {
  return splitTop(body, [";", ","], { newline: true }).flatMap((m) => {
    const hit = /^(?:readonly\s+)?(\w+)(\?)?\s*:\s*([\s\S]+)$/.exec(m);
    if (!hit) return [];
    const type = squash(hit[3]);
    return [{ name: hit[1], optional: Boolean(hit[2]), type, options: optionsOf(type, aliases), default: null }];
  });
}

/** Props and extends from a props type (intersection parts: a literal object, a named shape, or something we cannot see into). */
function readPropsType(type, types, seen = new Set()) {
  const props = [], extend = [];
  for (const part of splitTop(type, ["&"])) {
    if (part.startsWith("{")) props.push(...members(part.slice(1, closing(part, 0)), types.aliases));
    else if (types.shapes.has(part) && !seen.has(part)) props.push(...members(types.shapes.get(part), types.aliases));
    else if (types.aliases.has(part) && !seen.has(part)) { const inner = readPropsType(types.aliases.get(part), types, new Set([...seen, part])); props.push(...inner.props); extend.push(...inner.extend); }
    else extend.push(squash(part));
  }
  return { props, extend };
}

function readComponent(text, at, types) {
  // `function Name(` / `const Name = (` / `const Name = ({`; the parameter list is the bracket pair after it.
  const open = text.indexOf("(", at);
  const close = open === -1 ? -1 : closing(text, open);
  if (close === -1) return { props: [], extend: [] };
  const param = text.slice(open + 1, close).trim();
  if (!param.startsWith("{")) return { props: [], extend: [] };
  const pattern = closing(param, 0);
  const typeAt = param.indexOf(":", pattern);
  const { props, extend } = typeAt === -1 ? { props: [], extend: [] } : readPropsType(param.slice(typeAt + 1).trim(), types);
  const byName = new Map(props.map((p) => [p.name, p]));
  for (const entry of splitTop(param.slice(1, pattern), [","])) {
    if (entry.startsWith("...")) continue;
    const hit = /^(\w+)\s*(?::\s*\w+\s*)?(?:=\s*([\s\S]+))?$/.exec(entry);
    if (!hit) continue;
    const p = byName.get(hit[1]) ?? { name: hit[1], optional: true, type: null, options: null, default: null };
    p.default = hit[2] ? hit[2].trim().replace(/^["'`]|["'`]$/g, "") : null;
    byName.set(hit[1], p);
  }
  return { props: [...byName.values()], extend };
}

/**
 * @param {{ path: string, text: string }[]} files every source file to read (only .tsx/.jsx can hold a component)
 * @returns {{ components: object[] }} per component: name, file, line, props, extends, renders, acceptsChildren
 */
export function scanComponentSource(files) {
  const found = [];
  const types = { aliases: new Map(), shapes: new Map() };
  const sources = files.filter((f) => SCRIPT.test(f.path)).map((f) => ({ path: f.path, text: stripComments(f.text) }));
  for (const { text } of sources) {
    const t = readTypes(text);
    for (const [k, v] of t.aliases) types.aliases.set(k, v);
    for (const [k, v] of t.shapes) types.shapes.set(k, v);
  }
  for (const { path, text } of sources) {
    const depths = depthByLine(text);
    // Only a declaration at the top of the file is a component; a `const Comp = …` inside a component body is not.
    const starts = [...text.matchAll(/(?:^|\n)[ \t]*(?:export\s+)?(?:default\s+)?(?:function\s+|const\s+)([A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*)/g)]
      .filter((m) => depths[text.slice(0, m.index + m[0].length - m[1].length).split("\n").length - 1] === 0);
    starts.forEach((m, i) => {
      const at = m.index + m[0].length - m[1].length;
      const body = text.slice(at, starts[i + 1]?.index ?? text.length);
      const { props, extend } = readComponent(text, at, types);
      found.push({ name: m[1], file: path, line: text.slice(0, at).split("\n").length, props, extends: extend, body });
    });
  }
  const names = new Set(found.map((c) => c.name));
  const components = found.map(({ body, ...c }) => ({
    ...c,
    renders: [...new Set([...body.matchAll(/<([A-Z]\w*)[\s/>]/g)].map((t) => t[1]))].filter((n) => n !== c.name && names.has(n)).sort(),
    acceptsChildren: c.props.some((p) => p.name === "children"),
  }));
  return { components };
}

// ---------------------------------------------------------------------------------------------

/** One spelling per component name: case, separators and a leading dot/underscore set aside. */
const nameKey = (n) => String(n).replace(/^[._]+/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** One spelling per property name: Figma's `#id` suffix dropped, case and separators set aside (`has-icon-start` = `hasIconStart`). */
const propKey = (n) => String(n).replace(/#\d+:\d+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const shown = (n) => String(n).replace(/#\d+:\d+$/, "");
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * @param {object} profile the component profile (buildComponentProfile)
 * @param {{ components: object[] }} scan scanComponentSource's result
 * @returns the comparison: counts, matched components with per-property and composition rows, design-only and code-only components
 */
export function compareComponents(profile, scan) {
  // A library component that carries a page (a profile built from an inventory) keeps it on its row, so
  // components sharing a name on different pages stay separate rows.
  const where = (d) => (d.page !== undefined ? { id: d.id, page: d.page } : {});
  const code = new Map(scan.components.map((c) => [nameKey(c.name), c]));
  const codeKeyOf = (designName) => code.get(nameKey(designName));
  const design = profile.components;
  const matchedCode = new Set();
  const matched = [], designOnly = [];
  const props = { design: 0, matched: 0, valueGaps: 0, propGaps: 0 };

  for (const d of design) {
    const c = codeKeyOf(d.name);
    if (!c) { designOnly.push({ name: d.name, ...where(d), kind: d.kind, properties: d.properties.length }); continue; }
    matchedCode.add(c.name);
    const codeProps = new Map(c.props.map((p) => [propKey(p.name), p]));
    const rows = d.properties.map((dp) => {
      props.design += 1;
      const name = shown(dp.name);
      const cp = codeProps.get(propKey(name));
      const design = { type: dp.type, options: dp.options };
      if (!cp) { props.propGaps += 1; return { name, status: "prop-gap", design, code: null }; }
      const missingInCode = (dp.options ?? []).filter((o) => !(cp.options ?? []).includes(o));
      const onlyInCode = dp.options && cp.options ? cp.options.filter((o) => !dp.options.includes(o)) : [];
      const gap = dp.options && cp.options && (missingInCode.length || onlyInCode.length);
      props[gap ? "valueGaps" : "matched"] += 1;
      const row = { name, status: gap ? "value-gap" : "matched", design, code: { type: cp.type, options: cp.options, default: cp.default, optional: cp.optional } };
      return gap ? { ...row, missingInCode, onlyInCode } : row;
    });
    const designNests = Object.keys(d.nests).filter((n) => codeKeyOf(n)).concat(Object.keys(d.nests).filter((n) => !codeKeyOf(n))).sort(byText);
    const rendered = new Set(c.renders.map(nameKey));
    matched.push({
      name: d.name,
      ...where(d),
      code: { name: c.name, file: c.file, line: c.line },
      props: rows,
      codeOnlyProps: c.props.filter((p) => !d.properties.some((dp) => propKey(dp.name) === propKey(p.name))).map((p) => p.name).sort(byText),
      composition: {
        designNests,
        missingInCode: designNests.filter((n) => !rendered.has(nameKey(n))),
        onlyInCode: c.renders.filter((n) => !designNests.some((x) => nameKey(x) === nameKey(n))),
      },
    });
  }
  const codeOnly = scan.components.filter((c) => !matchedCode.has(c.name)).map((c) => ({ name: c.name, file: c.file, line: c.line, props: c.props.length })).sort((a, b) => byText(a.name, b.name));
  return {
    counts: { components: { design: design.length, matched: matched.length, designOnly: designOnly.length, codeOnly: codeOnly.length }, props },
    matched, designOnly, codeOnly,
    note: "Names match 1:1 once case and separators are set aside. A design component with no code match is listed, not matched by similarity; rule a rename in the project's own notes. Facts only: whether a gap is a build prop, a state, responsive or Figma-only is the designer's to class.",
  };
}

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`), ""];

export function renderComponentCompareMarkdown(r) {
  const { components: c, props: p } = r.counts;
  const out = ["# Design vs code: components", "",
    `${c.matched} of ${c.design} design components matched in code; ${c.designOnly} design-only, ${c.codeOnly} code-only. Of ${p.design} properties on the matched ones: ${p.matched} matched, ${p.valueGaps} with differing values, ${p.propGaps} with no code prop.`, "", r.note, ""];
  out.push("## Matched components", "", ...table(["Design", "Code", "Property", "Status", "Detail"],
    r.matched.flatMap((m) => m.props.map((x) => [m.page ? `${m.name} (${m.page})` : m.name, `${m.code.name} (${m.code.file}:${m.code.line})`, x.name, x.status,
      x.status === "value-gap" ? `design-only: ${x.missingInCode.join(", ") || "none"}; code-only: ${x.onlyInCode.join(", ") || "none"}` : x.status === "prop-gap" ? `design ${x.design.type}` : ""]))));
  const comp = r.matched.filter((m) => m.composition.missingInCode.length || m.composition.onlyInCode.length);
  if (comp.length) out.push("## Composition", "", ...table(["Component", "Design nests, code does not render", "Code renders, design does not nest"], comp.map((m) => [m.name, m.composition.missingInCode.join(", "), m.composition.onlyInCode.join(", ")])));
  const extra = r.matched.filter((m) => m.codeOnlyProps.length);
  if (extra.length) out.push("## Code props the design does not have", "", ...table(["Component", "Props"], extra.map((m) => [m.name, m.codeOnlyProps.join(", ")])));
  out.push("## Design components with no code match", "", ...table(["Component", "Kind", "Properties"], r.designOnly.map((x) => [x.page ? `${x.name} (${x.page})` : x.name, x.kind, x.properties])));
  out.push("## Code components with no design match", "", ...table(["Component", "Where", "Props"], r.codeOnly.map((x) => [x.name, `${x.file}:${x.line}`, x.props])));
  return out.join("\n");
}
