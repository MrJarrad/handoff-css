// `handoff-css resolve` — a need in, ranked candidates and a verdict out.
//
// Pure: export + needs + rulings in, report out. The agent only reuses what the system already has;
// this module never invents a name. A name the system lacks is a NEW_NAME finding, a value nothing in
// the system holds is a NEW_RAMP finding, and both stay open (exit 2 at the CLI) until a ruling row
// settles them. Until then the build carries the raw value, marked `assumed-ask`.
//
// Shapes are kind-generic on purpose (`kind`, `ask`, `candidates`, `values`, `distance`): a later
// component/block slice reuses them. Only the distance function is type-specific.
import { createRequire } from "node:module";
import Ajv2020 from "ajv/dist/2020.js";

import { buildProfile } from "./profile.mjs";
import { readRulings } from "./match.mjs";
import { fail } from "./resolve.mjs";

const require = createRequire(import.meta.url);
const checkNeeds = new Ajv2020({ allErrors: true, strict: false }).compile(require("../schema/resolve-need.v1.schema.json"));

export const RESOLVE_VERSION = 1;
/** Verdicts that need no further call. Every other verdict is open. */
export const SETTLED = ["REUSE", "RULED"];
const NEAR = 5; // distance at or under which a value counts as "the same thing" for ranking and reach
const SAME = 0.5; // distance at or under which two values are the same value
const LIMIT = 5;
const LAYER_ORDER = { semantic: 0, mixed: 1, primitive: 2, standalone: 3 };
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---- values and distance ---------------------------------------------------------------------
function parseHex(s) {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(s ?? "").trim());
  if (!m) return null;
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return { r, g, b, a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
}

function oklab({ r, g, b, a }) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s, a];
}

const parseQuantity = (v) => {
  if (typeof v === "number") return { n: v, unit: "" };
  const m = /^(-?\d+(?:\.\d+)?)([a-z%]*)$/i.exec(String(v).trim());
  return m ? { n: Number(m[1]), unit: m[2].toLowerCase() } : null;
};

/** The comparable forms of one mode's value: `{ type, text, forms }`. */
function modeValue(type, build) {
  if (!build) return { text: null, forms: [] };
  if (type === "COLOR") return { text: build.literal ?? null, forms: build.literal ? [build.literal] : [] };
  if (type === "FLOAT") {
    const forms = [];
    if (typeof build.raw === "number") forms.push({ n: build.raw, unit: "" });
    if (typeof build.value === "number") forms.push({ n: build.value, unit: String(build.unit ?? "").toLowerCase() });
    return { text: build.css ?? (forms[0] ? String(forms[0].n) : null), forms };
  }
  const raw = build.raw;
  const text = raw == null ? null : typeof raw === "object" ? JSON.stringify(raw) : String(raw);
  return { text, forms: text == null ? [] : [text] };
}

/** How far a candidate's mode value is from a wanted raw value: 0 is the same; Infinity cannot be compared. */
function distance(type, want, have) {
  if (have.forms.length === 0) return Infinity;
  if (type === "COLOR") {
    const w = parseHex(want);
    const h = parseHex(have.forms[0]);
    if (!w || !h) return Infinity;
    const [a, b] = [oklab(w), oklab(h)];
    return Math.round((Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100 + Math.abs(a[3] - b[3]) * 100) * 100) / 100;
  }
  if (type === "FLOAT") {
    const w = parseQuantity(want);
    if (!w) return Infinity;
    const ds = have.forms.filter((f) => f.unit === w.unit).map((f) => (Math.abs(f.n - w.n) / Math.max(Math.abs(f.n), Math.abs(w.n), 1)) * 100);
    return ds.length ? Math.round(Math.min(...ds) * 100) / 100 : Infinity;
  }
  return have.forms.includes(String(want)) ? 0 : Infinity;
}

const typeOfWant = (v) => (typeof v === "number" || parseQuantity(v) ? "FLOAT" : parseHex(v) ? "COLOR" : "STRING");

// ---- the index over one export -----------------------------------------------------------------
function indexExport(doc, profile) {
  const layerOf = new Map(profile.layers.map((l) => [l.collection, l.role]));
  const out = [];
  for (const c of doc.collections) {
    const modeNames = (c.modes ?? []).map((m) => m.name);
    for (const v of c.variables ?? []) {
      const parts = v.name.split("/").map((s) => s.trim());
      out.push({
        name: v.name,
        collection: c.name,
        webName: v.codeSyntax?.WEB?.value ?? null,
        type: v.type,
        layer: layerOf.get(c.name) ?? "standalone",
        group: (v.group ?? parts.slice(0, -1)).join("/"),
        modeNames,
        modes: new Map((v.modes ?? []).map((m) => [m.modeName ?? modeNames[0], modeValue(v.type, m.build)])),
      });
    }
  }
  return out;
}

/** The value a variable holds for one wanted mode. `*` is every mode; a one-mode collection answers any mode. */
function valueFor(entry, mode) {
  if (entry.modes.has(mode)) return entry.modes.get(mode);
  if (entry.modes.size === 1) return [...entry.modes.values()][0];
  return null;
}

function measure(entry, wants, type) {
  const values = {};
  let worst = 0;
  let sum = 0;
  for (const [mode, want] of Object.entries(wants)) {
    const modes = mode === "*" ? [...entry.modes.keys()] : [mode];
    let d = modes.length === 0 ? Infinity : 0;
    for (const m of modes) {
      const have = valueFor(entry, m);
      values[m] = have?.text ?? null;
      d = Math.max(d, have ? distance(type, want, have) : Infinity);
    }
    worst = Math.max(worst, d);
    sum += d;
  }
  return { values, distance: worst, sum };
}

const shown = (entry) => Object.fromEntries([...entry.modes].map(([m, v]) => [m, v.text]));

// ---- one need ----------------------------------------------------------------------------------
function resolveOne(need, ctx) {
  const { index, profile, names } = ctx;
  const kind = need.kind ?? "token";
  const ask = { ...(need.name ? { name: need.name } : {}), ...(need.group ? { group: need.group } : {}), ...(need.wants ? { wants: need.wants } : {}) };
  const parts = need.name ? need.name.split("/") : null;
  const group = need.group ?? (parts ? parts.slice(0, -1).join("/") : null);
  const wants = need.wants ?? null;
  const type = wants ? typeOfWant(Object.values(wants)[0]) : null;
  const findings = [];

  const exact = need.name ? index.filter((e) => e.name === need.name && (!need.collection || e.collection === need.collection)) : [];
  const observed = (g) =>
    profile.siblingObservations.filter((o) => g && o.groups.some((p) => p === g));

  const rows = new Map();
  const put = (e, ev) => {
    const key = `${e.collection}\u0000${e.name}`;
    if (!rows.has(key)) rows.set(key, { e, evidence: [] });
    rows.get(key).evidence.push(ev);
  };
  for (const e of exact) put(e, { fact: "name exists", from: `names[${e.collection}]` });
  if (group) {
    for (const e of index.filter((x) => x.group === group && (!type || x.type === type))) {
      put(e, { fact: `sits in the group ${group}`, from: `groups[${e.collection}:${group}]` });
    }
  }
  if (wants) {
    for (const e of index.filter((x) => x.type === type)) {
      const m = measure(e, wants, type);
      if (m.distance <= NEAR) put(e, { fact: m.distance <= SAME ? "holds the wanted value" : `holds a value near the wanted one (distance ${m.distance})`, from: `names[${e.collection}]` });
    }
  }

  const exactKeys = new Set(exact.map((e) => `${e.collection}\u0000${e.name}`));
  const candidates = [...rows.values()]
    .map(({ e, evidence }) => {
      const m = wants ? measure(e, wants, type) : { values: shown(e), distance: null, sum: null };
      return { e, evidence, m, isExact: exactKeys.has(`${e.collection}\u0000${e.name}`), inGroup: !!group && e.group === group };
    })
    .sort((a, b) =>
      (b.isExact - a.isExact) ||
      (b.inGroup - a.inGroup) ||
      ((a.m.distance ?? Infinity) - (b.m.distance ?? Infinity)) ||
      ((a.m.sum ?? Infinity) - (b.m.sum ?? Infinity)) ||
      (LAYER_ORDER[a.e.layer] - LAYER_ORDER[b.e.layer]) ||
      byText(a.e.name, b.e.name))
    .slice(0, LIMIT)
    .map((c, i) => {
      for (const o of observed(c.e.group)) c.evidence.push({ fact: `observation: ${o.family} has two groups and they differ (${o.groups.join(", ")})`, from: "siblingObservations" });
      return {
        rank: i + 1,
        name: c.e.name,
        collection: c.e.collection,
        webName: c.e.webName,
        type: c.e.type,
        layer: c.e.layer,
        values: wants ? { ...shown(c.e), ...c.m.values } : shown(c.e),
        distance: c.m.distance === Infinity ? null : c.m.distance,
        evidence: c.evidence,
      };
    });

  const report = { id: need.id, kind, ask, verdict: null, open: true, candidates, findings };
  const best = candidates[0];
  const exactHit = candidates.find((c) => exactKeys.has(`${c.collection}\u0000${c.name}`));

  if (exactHit) {
    if (!wants || (exactHit.distance !== null && exactHit.distance <= SAME)) report.verdict = "REUSE";
    else {
      report.verdict = "MISMATCH";
      findings.push({ code: "MISMATCH", message: `${need.name} exists but does not hold the wanted value (distance ${exactHit.distance ?? "not comparable"}); reuse it as it is, or the designer decides` });
    }
  } else if (!need.name) {
    if (best && best.distance !== null && best.distance <= SAME) report.verdict = "REUSE";
    else if (best && best.distance !== null && best.distance <= NEAR) {
      report.verdict = "SIBLING";
      findings.push({ code: "SIBLING", message: `no name holds the wanted value exactly; ${best.name} is the nearest (distance ${best.distance}) — ask once whether to reuse it` });
    } else {
      report.verdict = "NEW_RAMP";
      findings.push({ code: "NEW_RAMP", message: "nothing in the system holds this value in every mode asked; a new ramp is the designer's call" });
    }
  } else {
    // The name is absent: never invented. Say where it would sit and what already holds the value.
    const reach = {};
    let reachable = !!wants;
    if (wants) {
      for (const [mode, want] of Object.entries(wants)) {
        const near = index
          .filter((x) => x.type === type)
          .map((x) => ({ x, d: measure(x, { [mode]: want }, type).distance })) // `*` holds only if every mode of x does
          .filter((r) => r.d <= NEAR)
          .sort((a, b) => (b.x.layer === "primitive") - (a.x.layer === "primitive") || a.d - b.d || byText(a.x.name, b.x.name))[0];
        if (near) reach[mode] = { name: near.x.name, collection: near.x.collection, distance: near.d };
        else reachable = false;
      }
    }
    if (wants && !reachable) {
      report.verdict = "NEW_RAMP";
      findings.push({ code: "NEW_RAMP", message: `${need.name} is not in the system and no existing value covers every mode asked; a new ramp is the designer's call` });
    } else {
      report.verdict = "NEW_NAME";
      const gap = profile.siblingGaps.find((g) => g.group === group && g.lacks === parts[parts.length - 1]);
      const why = gap ? `; ${gap.presentIn.join(", ")} ${gap.presentIn.length === 1 ? "has" : "have"} it (a sibling gap)` : "";
      findings.push({ code: "NEW_NAME", message: `${need.name} is not in the system${why}; a new name is the designer's call` });
      if (wants) report.bindTo = reach;
    }
  }

  // A ruling settles it. The table is the same one `match` reads.
  const ruled = ctx.rulings.find((r) => r.kind === "resolve-need" && r.figma === need.id);
  if (ruled) {
    const row = { ruling: ruled.ruling, code: ruled.code, note: ruled.note };
    if (ruled.ruling === "use" && !names.has(ruled.code)) {
      report.findings = [{ code: "RULING_STALE", message: `the ruling binds ${need.id} to ${ruled.code || "(no name)"}, which the export does not have — rule it again` }];
      report.verdict = "RULING_STALE";
      report.ruling = row;
    } else {
      // A `new` row reads REUSE once the export has the variable it names, and only if that is the right one:
      // the name the need asked for, and a variable of the kind the need wants. Otherwise it stays RULED and says why.
      const named = ruled.ruling === "new" && ruled.code ? index.filter((e) => e.name === ruled.code) : [];
      const wrongKind = named.length > 0 && type && !named.some((e) => e.type === type);
      const wrongName = named.length > 0 && need.name && ruled.code !== need.name;
      report.verdict = named.length > 0 && !wrongKind && !wrongName ? "REUSE" : "RULED";
      report.open = false;
      report.ruling = row;
      report.findings = wrongKind
        ? [{ code: "MISMATCH", message: `the ruling names ${ruled.code}, which is ${named[0].type === "COLOR" ? "a colour" : `a ${named[0].type}`} variable, not the ${type === "COLOR" ? "colour" : type} this need wants; it stays ruled, not reused — rule it \`use\` with the right name` }]
        : wrongName
          ? [{ code: "NEW_NAME", message: `the ruling names ${ruled.code}, but the need asks for ${need.name}; it stays ruled, not reused — rule it \`use\` to bind ${ruled.code}, or write ${need.name}` }]
          : [];
    }
  } else {
    report.open = !SETTLED.includes(report.verdict);
  }
  if (report.open) report.fallback = { kind: "raw-value", status: "assumed-ask", ...(wants ? { values: wants } : {}) };
  if (report.bindTo === undefined) delete report.bindTo;
  return report;
}

/**
 * @param {{ doc: object, needs: object[], rulings?: string|null }} input
 * @returns {object} the resolve report (see schema/resolve-report.v1.schema.json)
 */
export function resolveNeeds({ doc, needs, rulings = null }) {
  if (!checkNeeds(needs)) {
    fail(`resolve: the need file does not match schema resolve-need.v1:\n${checkNeeds.errors.map((e) => `  ${e.instancePath || "/"} ${e.message}`).join("\n")}`);
  }
  const ids = new Set();
  for (const n of needs) {
    if (ids.has(n.id)) fail(`resolve: duplicate need id ${n.id}`);
    ids.add(n.id);
  }
  const profile = buildProfile(doc);
  const index = indexExport(doc, profile);
  const ctx = { index, profile, names: new Set(index.map((e) => e.name)), rulings: rulings ? readRulings(rulings) : [] };
  const results = needs.map((n) => resolveOne(n, ctx));
  const counts = {};
  for (const r of results) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
  return {
    resolveVersion: RESOLVE_VERSION,
    source: profile.source,
    needs: results,
    counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => byText(a, b))),
    open: results.filter((r) => r.open).length,
  };
}

const code = (s) => `\`${s}\``;
const val = (o) => Object.entries(o ?? {}).map(([k, v]) => `${k}: ${v ?? "n/a"}`).join("; ");

/** The report as markdown, with the ruling-table rows to fill in. */
export function renderResolveMarkdown(r) {
  const out = ["# Resolve report", "", `Source ${code(r.source.documentName ?? "(unnamed)")}, content hash ${code(r.source.contentHash ?? "none")}. ` +
    `${r.needs.length} needs, ${r.open} open.`, "",
  "Reuse comes first: a name the system has is used as it is. Anything else is one question for the designer, never an invented name. Until ruled, the build carries the raw value, marked `assumed-ask`.", ""];
  for (const n of r.needs) {
    out.push(`## ${n.id} — ${n.verdict}`, "", `Asked: ${val(n.ask.wants)}${n.ask.name ? ` for ${code(n.ask.name)}` : ""}${n.ask.group ? ` in ${code(n.ask.group)}` : ""}.`, "");
    for (const f of n.findings) out.push(`- ${f.code}: ${f.message}`);
    if (n.findings.length) out.push("");
    if (n.candidates.length) {
      out.push("| # | name | layer | values | distance | why |", "| --- | --- | --- | --- | --- | --- |",
        ...n.candidates.map((c) => `| ${c.rank} | ${code(c.name)} | ${c.layer} | ${val(c.values)} | ${c.distance ?? "n/a"} | ${c.evidence.map((e) => e.fact).join("; ")} |`), "");
    }
    if (n.bindTo) out.push(`A new name could point at: ${Object.entries(n.bindTo).map(([m, b]) => `${m} → ${code(b.name)}`).join("; ")}.`, "");
    if (n.fallback) out.push(`Fallback until ruled: raw value, \`assumed-ask\`${n.fallback.values ? ` (${val(n.fallback.values)})` : ""}.`, "");
  }
  const open = r.needs.filter((n) => n.open);
  if (open.length) {
    out.push("## Needs your call", "", "Rule each row `use` (with the existing name), `new` (the designer approved the new name) or `skip`, then pass the table back with `--rulings`.", "",
      "| kind | figma | ruling | code | note |", "| --- | --- | --- | --- | --- |",
      ...open.map((n) => `| resolve-need | ${n.id} |  |  | ${n.candidates[0] ? `top candidate ${n.candidates[0].name}` : ""} |`), "");
  }
  return out.join("\n");
}
