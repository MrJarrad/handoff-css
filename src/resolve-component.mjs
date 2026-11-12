// `handoff-css components --need` — a component or block need in, a verdict out.
//
// Pure: component profile + needs + rulings in, report out. The agent reuses a component the system
// already has before it builds anything new; this module never invents a component or a property
// value. Same ladder as `resolve` for variables, with the shapes that slice made kind-generic
// (`kind`, `ask`, `candidates`, `findings`, `fallback`, `open`):
//
//   REUSE            the component exists and the wanted settings are its defaults (or none are wanted)
//   REUSE_WITH_PROP  it exists and every wanted setting is one of its properties/values: build it, set them
//   PROP_GAP         it exists but a wanted property or value is not there: one question (extend, never fork)
//   SIBLING          no component of that name; the nearest is close: one question, nearest recommended
//   COMPOSE          no single component fits but every wanted child exists: build from them, designer decides
//                    whether the composition becomes a named block
//   NEW_COMPONENT    nothing fits: one question, with the naming/property pattern this system already uses
//   RULED / RULING_STALE  a ruling row settles it / names a component the export no longer has
//
// Until an open need is ruled the build carries a local, unexported component marked `assumed-ask`.
import { createRequire } from "node:module";
import Ajv2020 from "ajv/dist/2020.js";

import { readRulings } from "./match.mjs";
import { fail } from "./resolve.mjs";

const require = createRequire(import.meta.url);
const checkNeeds = new Ajv2020({ allErrors: true, strict: false }).compile(require("../schema/resolve-component-need.v1.schema.json"));

export const RESOLVE_COMPONENT_VERSION = 1;
export const SETTLED = ["REUSE", "REUSE_WITH_PROP", "RULED"];
const LIMIT = 5;
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const words = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const bare = (s) => words(s).join("");

const hasValue = (prop, value) => {
  if (prop.type === "BOOLEAN") return ["true", "false"].includes(String(value));
  if (prop.type === "VARIANT") return prop.options == null || prop.options.map(String).includes(String(value));
  return true; // TEXT, INSTANCE_SWAP, NUMBER: any value is a setting, not a new option
};

/** What the wanted properties ask of one component: the settings to make, and what it lacks. */
function fit(component, wantedProps) {
  const set = {};
  const lacks = [];
  for (const [axis, value] of Object.entries(wantedProps)) {
    const prop = component.properties.find((p) => p.name === axis);
    if (!prop) lacks.push({ property: axis, value, reason: "no such property" });
    else if (!hasValue(prop, value)) lacks.push({ property: axis, value, reason: `${prop.type} property has ${prop.options?.join(", ")}` });
    else if (prop.default == null || String(prop.default) !== String(value)) set[axis] = value;
  }
  return { set, lacks };
}

function similarity(need, component) {
  const a = new Set(words(need.name ?? ""));
  const b = new Set(words(component.name));
  const shared = [...a].filter((w) => b.has(w));
  const nameScore = a.size === 0 ? 0 : shared.length / Math.max(a.size, b.size);
  const axes = Object.keys(need.wants?.props ?? {});
  const axisScore = axes.length === 0 ? 0 : axes.filter((x) => component.properties.some((p) => p.name === x)).length / axes.length;
  const evidence = [];
  if (bare(need.name ?? "") && bare(need.name) === bare(component.name)) evidence.push("same name apart from case and punctuation");
  else if (shared.length) evidence.push(`shares ${shared.join(", ")} with the asked name`);
  if (axisScore > 0) evidence.push(`has ${Math.round(axisScore * axes.length)} of ${axes.length} wanted properties`);
  return { score: nameScore * 0.7 + axisScore * 0.3, nameScore: nameScore + (bare(need.name ?? "") && bare(need.name) === bare(component.name) ? 1 : 0), evidence };
}

function patternFor(need, profile) {
  const prefix = need.name?.includes("/") ? need.name.split("/").slice(0, -1).join("/").trim() : null;
  const known = Object.keys(profile.naming.categoryPrefixes);
  return {
    naming: {
      separator: profile.naming.separator,
      flat: profile.naming.flat,
      leafCase: profile.naming.leafCase,
      categoryPrefixes: profile.naming.categoryPrefixes,
      asked: need.name ?? null,
      askedPrefixKnown: prefix == null ? null : known.includes(prefix),
    },
    recurringProperties: profile.propertyModel.axes.filter((a) => a.components >= 2).slice(0, 8).map((a) => ({ name: a.name, onComponents: a.components, types: a.types, values: a.values })),
    tiers: profile.composition.tiers.map((t) => ({ tier: t.tier, count: t.components.length })),
    note: "Where a new component sits in this system is the designer's call; this is what the exports observed, not a rule.",
  };
}

/** Library components no layer places, shaped like the profile's own rows so they rank and resolve the same way. */
function inventoryOnly(inventory, seen) {
  const rows = new Map();
  for (const d of inventory) {
    for (const c of d.components ?? []) {
      if (seen.has(c.name) || rows.has(c.name)) continue;
      rows.set(c.name, { name: c.name, kind: c.kind, tier: null, fromInventory: true, properties: (c.properties ?? []).map((p) => ({ name: p.name, type: p.type, default: p.defaultValue ?? null, options: p.options?.length ? p.options : null })) });
    }
  }
  return [...rows.values()];
}

function resolveOne(need, ctx) {
  const { profile, byName, rulings, candidatesPool } = ctx;
  const wantedProps = need.wants?.props ?? {};
  const children = need.wants?.children ?? [];
  const ask = { ...(need.name ? { name: need.name } : {}), ...(need.wants ? { wants: need.wants } : {}) };
  const findings = [];

  const ranked = candidatesPool
    .map((c) => ({ c, ...similarity(need, c) }))
    .filter((r) => r.score > 0 || byName.get(need.name) === r.c)
    .sort((a, b) => (byName.get(need.name) === b.c) - (byName.get(need.name) === a.c) || b.score - a.score || byText(a.c.name, b.c.name))
    .slice(0, LIMIT)
    .map((r, i) => ({
      rank: i + 1,
      name: r.c.name,
      kind: r.c.kind,
      tier: r.c.tier,
      properties: r.c.properties.map((p) => `${p.name}${p.options ? `: ${p.options.join(" | ")}` : ""}`),
      score: Math.round(r.score * 100) / 100,
      nameScore: r.nameScore,
      evidence: [...(byName.get(need.name) === r.c ? ["name exists"] : []), ...r.evidence, ...(r.c.fromInventory ? ["in the library; placed by no layer here"] : [])],
    }));

  const report = { id: need.id, kind: "component", ask, verdict: null, open: true, candidates: ranked, findings };
  const exact = need.name ? byName.get(need.name) : null;
  // A sibling must share part of the asked name; matching property names alone never makes two components alike.
  const sibling = ranked.find((r) => r.nameScore > 0 && r.score >= 0.3);
  const missingChildren = children.filter((n) => !byName.has(n));

  if (exact) {
    const { set, lacks } = fit(exact, wantedProps);
    if (lacks.length) {
      report.verdict = "PROP_GAP";
      findings.push({ code: "PROP_GAP", message: `${exact.name} exists but lacks ${lacks.map((l) => `${l.property}=${l.value} (${l.reason})`).join("; ")}; extend this component, do not fork it — the designer decides` });
    } else if (Object.keys(set).length) {
      report.verdict = "REUSE_WITH_PROP";
      report.set = set;
    } else report.verdict = "REUSE";
  } else if (sibling) {
    report.verdict = "SIBLING";
    findings.push({ code: "SIBLING", message: `${need.name} is not in the system; ${sibling.name} is the nearest (${sibling.evidence.join("; ")}) — ask once whether to reuse it` });
  } else if (children.length > 0 && missingChildren.length === 0) {
    report.verdict = "COMPOSE";
    report.parts = children;
    findings.push({ code: "COMPOSE", message: `no single component fits; every wanted part exists (${children.join(", ")}). Build the composition from them; whether it becomes a named block is the designer's call` });
  } else {
    report.verdict = "NEW_COMPONENT";
    report.pattern = patternFor(need, profile);
    if (missingChildren.length) report.missingParts = missingChildren;
    findings.push({ code: "NEW_COMPONENT", message: `${need.name ?? "this need"} is not in the system${missingChildren.length ? ` and ${missingChildren.join(", ")} ${missingChildren.length === 1 ? "is" : "are"} not either` : ""}; a new component is the designer's call` });
  }

  const ruled = rulings.find((r) => r.kind === "resolve-component" && r.figma === need.id);
  if (ruled) {
    const row = { ruling: ruled.ruling, code: ruled.code, note: ruled.note };
    report.ruling = row;
    if (ruled.ruling === "use" && !byName.has(ruled.code)) {
      report.verdict = "RULING_STALE";
      report.findings = [{ code: "RULING_STALE", message: `the ruling binds ${need.id} to ${ruled.code || "(no name)"}, which the exports do not have — rule it again` }];
      report.open = true;
    } else {
      const named = ruled.ruling === "new" && ruled.code ? byName.get(ruled.code) : null;
      report.verdict = named && (!need.name || ruled.code === need.name) ? "REUSE" : "RULED";
      report.open = false;
      report.findings = [];
    }
  } else report.open = !SETTLED.includes(report.verdict);
  if (report.open) report.fallback = { kind: "local-component", status: "assumed-ask" };
  return report;
}

/**
 * @param {{ profile: object, needs: object[], rulings?: string|null, inventory?: object[] }} input
 *   `inventory`: Design System Handoff exports (schema 20+); their `components[]` join the components a need is ranked against.
 * @returns {object} the component resolve report
 */
export function resolveComponentNeeds({ profile, needs, rulings = null, inventory = [] }) {
  if (!checkNeeds(needs)) {
    fail(`components: the need file does not match schema resolve-component-need.v1:\n${checkNeeds.errors.map((e) => `  ${e.instancePath || "/"} ${e.message}`).join("\n")}`);
  }
  const ids = new Set();
  for (const n of needs) {
    if (ids.has(n.id)) fail(`components: duplicate need id ${n.id}`);
    ids.add(n.id);
  }
  const candidatesPool = [...profile.components, ...inventoryOnly(inventory, new Set(profile.components.map((c) => c.name)))];
  const ctx = { profile, candidatesPool, byName: new Map(candidatesPool.map((c) => [c.name, c])), rulings: rulings ? readRulings(rulings) : [] };
  const results = needs.map((n) => resolveOne(n, ctx));
  const counts = {};
  for (const r of results) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
  return {
    resolveComponentVersion: RESOLVE_COMPONENT_VERSION,
    source: profile.source,
    coverage: profile.coverage,
    needs: results,
    counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => byText(a, b))),
    open: results.filter((r) => r.open).length,
  };
}

const code = (s) => `\`${s}\``;

export function renderResolveComponentMarkdown(r) {
  const out = ["# Component resolve report", "",
    `${r.needs.length} needs, ${r.open} open. ${r.coverage.total === "unknown" ? `Components seen: ${r.coverage.seen} of an unknown total — a component not listed may still exist in the system.` : `Components seen: ${r.coverage.seen}; the library defines ${r.coverage.total}, ${r.coverage.seenInInventory} of them placed by these layers.`}`, "",
    "Reuse comes first: a component the system has is used as it is, with its own properties. Anything else is one question for the designer, never an invented component. Until ruled, the build carries a local component marked `assumed-ask`.", ""];
  for (const n of r.needs) {
    out.push(`## ${n.id} — ${n.verdict}`, "", `Asked: ${n.ask.name ? code(n.ask.name) : "(no name)"}${n.ask.wants ? ` ${code(JSON.stringify(n.ask.wants))}` : ""}.`, "");
    for (const f of n.findings) out.push(`- ${f.code}: ${f.message}`);
    if (n.findings.length) out.push("");
    if (n.set) out.push(`Build ${code(n.ask.name)} with: ${Object.entries(n.set).map(([k, v]) => `${k}=${v}`).join(", ")}.`, "");
    if (n.parts) out.push(`Build from: ${n.parts.map(code).join(", ")}.`, "");
    if (n.candidates.length) {
      out.push("| # | component | kind | tier | properties | why |", "| --- | --- | --- | --- | --- | --- |",
        ...n.candidates.map((c) => `| ${c.rank} | ${code(c.name)} | ${c.kind} | ${c.tier ?? "–"} | ${c.properties.join("; ")} | ${c.evidence.join("; ")} |`), "");
    }
    if (n.pattern) {
      out.push(`This system names components ${n.pattern.naming.flat ? "flat" : `with category prefixes (${Object.keys(n.pattern.naming.categoryPrefixes).join(", ") || "none seen"})`}, separator ${n.pattern.naming.separator ?? "none"}, leaf case ${JSON.stringify(n.pattern.naming.leafCase)}.`,
        `Properties it recurs: ${n.pattern.recurringProperties.map((p) => `${p.name} (${Object.keys(p.types).join("/")})`).join(", ") || "none"}.`, "");
    }
    if (n.fallback) out.push("Fallback until ruled: a local, unexported component, `assumed-ask`.", "");
  }
  const open = r.needs.filter((n) => n.open);
  if (open.length) {
    out.push("## Needs your call", "", "Rule each row `use` (with the existing component name), `new` (the designer approved the new component) or `skip`, then pass the table back with `--rulings`.", "",
      "| kind | figma | ruling | code | note |", "| --- | --- | --- | --- | --- |",
      ...open.map((n) => `| resolve-component | ${n.id} |  |  | ${n.candidates[0] ? `top candidate ${n.candidates[0].name}` : ""} |`), "");
  }
  return out.join("\n");
}
