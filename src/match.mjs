// HT-21 — BROWNFIELD MODE. A project that already has code and no Design System
// Handoff export: the brief still names every Figma variable (with its CSS name
// and mode values) and every component it uses, and the codebase already has
// its own custom properties and components. This proposes, per Figma item, the
// closest existing code match with the evidence for it and a confidence — and
// reports every item with no match for a human to rule on. A proposal is never
// adopted here and no name is invented: the human's ruling, recorded in the
// project's ruling table, is what the next run (and the build) reads.
//
// Pure: texts in, result out. `src/match-cli.mjs` is the filesystem boundary.
import { parseHandoffMarkdown } from "./validate-handoff-md.mjs";
import { stripComments } from "./conform.mjs";

const DECLARATION = /(?:^|[;{\s])(--[a-z0-9-]+)\s*:\s*([^;}]*)/gi;
const USAGE = /var\(\s*(--[a-z0-9-]+)/gi;
// A component is a PascalCase export (a lowercase letter in it, so `SPACER` is
// a constant) from a file that can hold JSX.
const COMPONENT = /export\s+(?:default\s+)?(?:function\s+|const\s+)([A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*)/g;
const SCRIPT = /\.(tsx|jsx)$/;

/**
 * @param {{ handoff: string, files: {path: string, text: string}[], rulings?: string|null }} input
 *   the brief markdown, every source file of the project to match against, and
 *   the project's ruling table (markdown) when one exists
 * @returns {{ items: object[], findings: object[], counts: object }}
 */
export function matchBrownfield({ handoff, files, rulings = null }) {
  const brief = parseHandoffMarkdown(handoff);
  const code = inventory(files);
  const ruled = rulings ? readRulings(rulings) : [];
  const findings = [];
  const items = [
    ...brief.tokens.map((t) => matchToken(t, code)),
    ...brief.components.map((c) => matchComponent(c, code)),
  ].map((item) => {
    const r = ruled.find((x) => x.kind === item.kind && x.figma === item.figma);
    if (!r) return item;
    const ruling = { ruling: r.ruling, code: r.code, note: r.note };
    const known = item.kind === "token" ? code.tokens.has(r.code) : code.components.has(r.code);
    if (r.ruling === "use" && !known) {
      findings.push({ code: "RULING_STALE", kind: item.kind, figma: item.figma,
        message: `the ruling binds ${item.figma} to ${r.code || "(no code name)"}, which the scanned code no longer has — rule it again` });
      return { ...item, ruling, stale: true };
    }
    return { ...item, status: "ruled", ruling };
  });
  return { items, findings, counts: count(items) };
}

const RULINGS = ["use", "new", "skip"];

/**
 * The ruling table: `| kind | figma | ruling | code | note |`, one row per
 * decided item, ruling one of `use` (bind this code name or component), `new`
 * (add the brief's own name to the code) or `skip` (not built). A row with no
 * ruling is still waiting, so it is not read as one.
 */
export function readRulings(text) {
  const rows = text.split("\n").filter((l) => l.trim().startsWith("|"))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|").replace(/^`|`$/g, "")));
  const header = rows.findIndex((r) => r.includes("kind") && r.includes("figma") && r.includes("ruling"));
  if (header === -1) return [];
  const col = Object.fromEntries(rows[header].map((c, i) => [c, i]));
  return rows.slice(header + 1)
    .map((r) => ({ kind: r[col.kind], figma: r[col.figma], ruling: r[col.ruling], code: r[col.code] ?? "", note: r[col.note] ?? "" }))
    .filter((r) => RULINGS.includes(r.ruling));
}

/** Every custom property the code declares or uses, with where and how often. */
function inventory(files) {
  const tokens = new Map();
  const components = new Map();
  const entry = (name) => tokens.get(name) ?? tokens.set(name, { name, values: [], declaredAt: [], uses: 0 }).get(name);
  for (const { path, text } of files) {
    const body = path.endsWith(".css") ? stripComments(text) : text;
    if (path.endsWith(".css")) {
      for (const m of body.matchAll(DECLARATION)) {
        const t = entry(m[1]);
        t.values.push(m[2].trim());
        t.declaredAt.push(`${path}:${body.slice(0, m.index).split("\n").length}`);
      }
    }
    for (const m of body.matchAll(USAGE)) entry(m[1]).uses += 1;
    if (SCRIPT.test(path)) {
      for (const m of body.matchAll(COMPONENT)) {
        components.set(m[1], { name: m[1], declaredAt: `${path}:${body.slice(0, m.index).split("\n").length}`, uses: 0 });
      }
    }
  }
  for (const c of components.values()) {
    const tag = new RegExp(`<${c.name}[\\s/>]`, "g");
    c.uses = files.filter((f) => SCRIPT.test(f.path)).reduce((n, f) => n + (f.text.match(tag)?.length ?? 0), 0);
  }
  return { tokens, components };
}

// Name evidence is the CSS name's `-` segments: identical, or the share of
// segments the two names have in common. Half or more is a proposal; less is
// not, whatever the value says — a matching literal is a coincidence until a
// human says otherwise.
const PROPOSE_AT = 0.5;
const ALTERNATIVES = 3;

const segments = (name) => name.replace(/^--/, "").split("-").filter(Boolean);
function shared(a, b) {
  const [x, y] = [new Set(segments(a)), new Set(segments(b))];
  const both = [...x].filter((s) => y.has(s)).length;
  return both / new Set([...x, ...y]).size;
}

/** One spelling per value: lowercase, `#rgb`/`#rrggbbff` → `#rrggbb`, px → rem at the brief's 16px root, zero bare. */
export function normalizeValue(raw) {
  let v = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${[...v.slice(1)].map((c) => c + c).join("")}`;
  if (/^#[0-9a-f]{6}ff$/.test(v)) v = v.slice(0, 7);
  const px = /^(-?\d*\.?\d+)px$/.exec(v);
  if (px) v = `${Number(px[1]) / 16}rem`;
  if (/^-?0(?:\.0+)?(?:rem|px|em|%)?$/.test(v)) v = "0";
  return v;
}

function evidence(token, candidate, figmaValues) {
  const exact = candidate.name === token.web;
  const nameShare = exact ? 1 : shared(token.web, candidate.name);
  const agrees = candidate.values.find((v) => figmaValues.has(normalizeValue(v)));
  const why = [];
  if (exact) why.push("name: the code has the brief's CSS name");
  else if (nameShare > 0) why.push(`name: shares ${segments(token.web).filter((s) => segments(candidate.name).includes(s)).join(", ")} with ${token.web}`);
  if (agrees) why.push(`value: code declares ${agrees}, a value the brief states`);
  else if (candidate.values.length) why.push(`value: code declares ${candidate.values[0]}; the brief states ${token.values.join(", ") || "no resolved value"}`);
  why.push(candidate.declaredAt.length
    ? `usage: declared at ${candidate.declaredAt[0]}, used ${candidate.uses}× in the scanned code`
    : `usage: used ${candidate.uses}× in the scanned code, declared outside it`);
  let confidence = null;
  if (exact) confidence = agrees || candidate.values.length === 0 ? "high" : "medium";
  else if (nameShare >= PROPOSE_AT) confidence = agrees ? "medium" : "low";
  const score = nameShare * 2 + (agrees ? 1 : 0);
  return { code: candidate.name, confidence, why, score, proposable: confidence != null, related: nameShare > 0 || Boolean(agrees) };
}

function matchToken(token, code) {
  // An older-grammar row can carry no CSS name (no codeSyntax.WEB): there is no
  // name to match on, and a value alone is never a proposal.
  if (!token.web) {
    return { kind: "token", figma: token.token, css: null, status: "unmatched", proposal: null, alternatives: [],
      reason: "no CSS name in the brief (codeSyntax.WEB is missing)" };
  }
  const figmaValues = new Set(token.values.map(normalizeValue));
  const ranked = [...code.tokens.values()]
    .map((c) => evidence(token, c, figmaValues))
    .filter((e) => e.related)
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  const best = ranked.find((e) => e.proposable) ?? null;
  const alternatives = ranked.filter((e) => e !== best).slice(0, ALTERNATIVES).map(({ code, confidence, why }) => ({ code, confidence, why }));
  return {
    kind: "token",
    figma: token.token,
    css: token.web,
    status: best ? "proposed" : "unmatched",
    proposal: best && { code: best.code, confidence: best.confidence, why: best.why },
    alternatives,
  };
}

// A component's name evidence: the same name once case and punctuation are
// set aside (Figma's private `.Name` included), one name inside the other
// (`FeatureText` → `FeatureTextBlock`), or the share of their word segments.
const bare = (name) => name.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const words = (name) => name.replace(/^[^A-Za-z0-9]+/, "").split(/(?<=[a-z0-9])(?=[A-Z])|[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.toLowerCase());

function matchComponent(component, code) {
  const ranked = [...code.components.values()].map((c) => {
    const [a, b] = [bare(component.label), bare(c.name)];
    const [x, y] = [new Set(words(component.label)), new Set(words(c.name))];
    const share = [...x].filter((w) => y.has(w)).length / new Set([...x, ...y]).size;
    const confidence = a === b ? "high" : a.includes(b) || b.includes(a) ? "medium" : share >= PROPOSE_AT ? "low" : null;
    const why = [
      a === b ? "name: the code has the Figma component's name"
        : confidence === "medium" ? `name: ${a.includes(b) ? `${c.name} is inside ${component.label}` : `${component.label} is inside ${c.name}`}`
        : `name: shares ${[...x].filter((w) => y.has(w)).join(", ")} with ${component.label}`,
      `usage: declared at ${c.declaredAt}, rendered ${c.uses}× in the scanned code; Figma places ${component.instances}`,
    ];
    return { code: c.name, confidence, why, score: { high: 3, medium: 2, low: 1 }[confidence] ?? share };
  }).filter((e) => e.score > 0).sort((p, q) => q.score - p.score || p.code.localeCompare(q.code));
  const best = ranked.find((e) => e.confidence) ?? null;
  return {
    kind: "component",
    figma: component.label,
    id: component.id,
    status: best ? "proposed" : "unmatched",
    proposal: best && { code: best.code, confidence: best.confidence, why: best.why },
    alternatives: ranked.filter((e) => e !== best).slice(0, ALTERNATIVES).map(({ code, confidence, why }) => ({ code, confidence, why })),
  };
}

function count(items) {
  const counts = { items: items.length, proposed: 0, unmatched: 0, ruled: 0 };
  for (const i of items) counts[i.status] += 1;
  return counts;
}

/** The report: counts, stale rulings, then every unruled item as a ruling row to fill. */
export function renderMarkdown({ items, findings, counts }) {
  const cell = (s) => String(s ?? "").replace(/\|/g, "\\|");
  const open = items.filter((i) => i.status !== "ruled");
  const lines = [
    "# Brownfield match",
    "",
    `${counts.items} items · ${counts.proposed} proposed · ${counts.unmatched} unmatched · ${counts.ruled} ruled`,
    "",
  ];
  for (const f of findings) lines.push(`- ${f.code} ${f.kind} ${f.figma} — ${f.message}`);
  if (findings.length) lines.push("");
  if (open.length) {
    lines.push(
      "Rule each row: `use` (bind the code name), `new` (add the brief's name to the code) or `skip`, then pass the table back with `--rulings`.",
      "",
      "| kind | figma | ruling | code | note |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const i of open) {
      const note = i.proposal
        ? `${i.proposal.confidence}: ${i.proposal.why.join("; ")}`
        : `unmatched${i.reason ? ` — ${i.reason}` : ""}${i.alternatives.length ? `; nearest ${i.alternatives.map((a) => a.code).join(", ")}` : ""}`;
      lines.push(`| ${i.kind} | ${cell(i.figma)} |  | ${cell(i.proposal?.code ?? "")} | ${cell(note)} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}
