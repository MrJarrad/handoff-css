// HT-102 — values a layer states as plain numbers, not bound to a Figma variable, matched to the
// project's own coded tokens (CSS custom properties). The design-handoff script lists them in the
// link-run file (`unboundValues`); this matches each to the closest token of its own kind.
//
// Unlike the Figma-variable pass in match.mjs, where a value alone is never a proposal (a variable has
// a name to match), a raw value has nothing but its value, so here the value is the evidence:
//   - colour: the same only when the two can't be told apart (CIEDE2000 ΔE < 1, alpha within 1/255);
//     ΔE < 5 is slightly off and goes to the operator with the token suggested (HT-105);
//   - spacing, size, radius, border, type: the same within half a pixel (px against rem at 16px);
//     between two steps the exact number stays and is listed with both neighbours (HT-106).
// A clear match is built with the token and listed so the operator can overrule it (HT-104). A listed
// value is built raw, with a deviation row, until it is ruled; it never stops a build.
//
// Pure: rows and texts in, result out. `src/match-cli.mjs` is the filesystem boundary.
import { inventory, readRulings } from "./match.mjs";

const SAME_COLOUR = 1;
const SLIGHTLY_OFF = 5;
const SAME_PX = 0.5;
const PILL_PX = 999;
const ROOT_PX = 16;

// ── colour ──────────────────────────────────────────────────────────────────

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` (comma or space syntax) → [r, g, b, a] in 0–1; else null. */
export function parseColour(raw) {
  const v = String(raw).trim().toLowerCase();
  let hex = /^#([0-9a-f]{3,8})$/.exec(v)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
    if (hex.length === 6) hex += "ff";
    if (hex.length !== 8) return null;
    return [0, 2, 4, 6].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(v)?.[1];
  if (!fn) return null;
  const parts = fn.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const channel = (p, max) => (p.endsWith("%") ? Number.parseFloat(p) / 100 : Number.parseFloat(p) / max);
  const out = [channel(parts[0], 255), channel(parts[1], 255), channel(parts[2], 255), parts[3] == null ? 1 : channel(parts[3], 1)];
  return out.every(Number.isFinite) ? out : null;
}

/** sRGB (0–1) → CIELAB, D65. */
function lab([r, g, b]) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const xyz = [
    (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047,
    0.2126729 * R + 0.7151522 * G + 0.072175 * B,
    (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883,
  ];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 colour difference between two CIELAB colours (Sharma, Wu & Dalal 2005). */
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));
  const [ap1, ap2] = [(1 + G) * a1, (1 + G) * a2];
  const [Cp1, Cp2] = [Math.hypot(ap1, b1), Math.hypot(ap2, b2)];
  const hue = (b, ap) => (b === 0 && ap === 0 ? 0 : (Math.atan2(b, ap) / rad + 360) % 360);
  const [hp1, hp2] = [hue(b1, ap1), hue(b2, ap2)];
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) dh = Math.abs(hp2 - hp1) <= 180 ? hp2 - hp1 : hp2 - hp1 > 180 ? hp2 - hp1 - 360 : hp2 - hp1 + 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);
  const Lbar = (L1 + L2) / 2, Cbar = (Cp1 + Cp2) / 2;
  let hbar = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hbar = Math.abs(hp1 - hp2) <= 180 ? hbar / 2 : hp1 + hp2 < 360 ? (hbar + 360) / 2 : (hbar - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbar - 30) * rad) + 0.24 * Math.cos(2 * hbar * rad) + 0.32 * Math.cos((3 * hbar + 6) * rad) - 0.2 * Math.cos((4 * hbar - 63) * rad);
  const SL = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const SC = 1 + 0.045 * Cbar, SH = 1 + 0.015 * Cbar * T;
  const RT = -2 * Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hbar - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

const hex8 = (rgba) => `#${rgba.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;

// ── the project's tokens, by kind ──────────────────────────────────────────

const px = (raw) => {
  const m = /^(-?\d*\.?\d+)(px|rem)?$/.exec(String(raw).trim().toLowerCase());
  if (!m) return null;
  return m[2] === "rem" ? Number(m[1]) * ROOT_PX : Number(m[1]);
};

// A length token's kind from its name's `-` segments; a token whose name says nothing is not guessed at.
function lengthKind(name, unitless) {
  const s = new Set(name.replace(/^--/, "").split("-"));
  const has = (...w) => w.some((x) => s.has(x));
  if (unitless) return has("weight", "fw") ? "type:fontWeight" : null;
  if ((has("font") && has("size")) || has("text", "fs")) return "type:fontSize";
  if (has("leading", "lh") || (has("line") && has("height"))) return "type:lineHeight";
  if (has("tracking", "letter")) return "type:letterSpacing";
  if (has("radius", "rounded", "round", "corner")) return "radius";
  if (has("border", "stroke")) return "border";
  if (has("space", "spacing", "spacer", "gap", "gutter", "padding", "inset", "margin")) return "spacing";
  if (has("size", "width", "height", "container", "dimension", "w", "h")) return "size";
  return null;
}

/** Every custom property the CSS declares, its alias chain followed, as `{ name, value, kind, colour?, px? }`; aliases dropped. */
function tokens(files) {
  const code = inventory(files.filter((f) => f.path.endsWith(".css")));
  const out = [];
  for (const { name, values } of code.tokens.values()) {
    if (!values.length || /^var\(/.test(values[0].trim())) continue;
    const value = values[0].trim();
    const colour = parseColour(value);
    if (colour) { out.push({ name, value, kind: "colour", colour, lab: lab(colour) }); continue; }
    const n = px(value);
    const kind = n == null ? null : lengthKind(name, /^-?\d*\.?\d+$/.test(value));
    if (kind) out.push({ name, value, kind, px: n });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ── matching ────────────────────────────────────────────────────────────────

const wanted = (row) => (row.kind === "type" ? `type:${row.property}` : row.kind);
const unit = (row) => (row.kind === "type" && row.property === "fontWeight" ? "" : "px");
const keyOf = (row) => (row.kind === "colour" ? String(row.value).toUpperCase() : `${row.kind === "type" ? `${row.property} ` : ""}${row.value}${unit(row)}`);

function matchColour(value, candidates) {
  const rgba = parseColour(value);
  if (!rgba) return { status: "listed", reason: "no-match", token: null, why: `not a colour: ${value}`, suggestions: [] };
  const here = lab(rgba);
  const ranked = candidates.map((t) => ({ t, d: deltaE2000(here, t.lab), da: Math.abs(t.colour[3] - rgba[3]) })).sort((a, b) => a.d - b.d || a.t.name.localeCompare(b.t.name));
  const suggest = (r) => ({ token: r.t.name, value: r.t.value, distance: `ΔE ${r.d.toFixed(1)}${r.da > 1 / 255 ? `, alpha ${Math.round(r.t.colour[3] * 100)}% vs ${Math.round(rgba[3] * 100)}%` : ""}` });
  const same = ranked.filter((r) => r.d < SAME_COLOUR && r.da <= 1 / 255);
  if (same.length === 1) return { status: "built", reason: "same", token: same[0].t.name, why: `can't tell apart: ΔE ${same[0].d.toFixed(1)}`, suggestions: [] };
  if (same.length > 1) return { status: "listed", reason: "tie", token: null, why: `${same.length} tokens can't be told apart from it`, suggestions: same.map(suggest) };
  if (!ranked.length) return { status: "listed", reason: "no-tokens", token: null, why: "the code declares no colour token", suggestions: [] };
  if (ranked[0].d < SLIGHTLY_OFF) return { status: "listed", reason: "slightly-off", token: null, why: `slightly off: ${suggest(ranked[0]).distance}`, suggestions: [suggest(ranked[0])] };
  return { status: "listed", reason: "no-match", token: null, why: `no close match: nearest ${suggest(ranked[0]).distance}`, suggestions: ranked.slice(0, 2).map(suggest) };
}

function matchLength(row, candidates) {
  const v = Number(row.value);
  const u = unit(row);
  const suggest = (t) => ({ token: t.name, value: t.value, distance: `${t.px - v > 0 ? "+" : ""}${+(t.px - v).toFixed(2)}${u}` });
  const pill = row.kind === "radius" && v >= PILL_PX;
  const same = candidates.filter((t) => (pill ? t.px >= PILL_PX : Math.abs(t.px - v) <= SAME_PX));
  if (same.length === 1) return { status: "built", reason: "same", token: same[0].name, why: pill ? "pill: the full radius token" : `same: ${same[0].value}`, suggestions: [] };
  if (same.length > 1) return { status: "listed", reason: "tie", token: null, why: `${same.length} tokens state ${v}${u}`, suggestions: same.map(suggest) };
  if (!candidates.length) return { status: "listed", reason: "no-tokens", token: null, why: `the code declares no ${wanted(row).replace("type:", "")} token`, suggestions: [] };
  const below = candidates.filter((t) => t.px < v).sort((a, b) => b.px - a.px)[0];
  const above = candidates.filter((t) => t.px > v).sort((a, b) => a.px - b.px)[0];
  if (below && above) return { status: "listed", reason: "between", token: null, why: `between ${below.name} and ${above.name}: exact ${v}${u} kept`, suggestions: [suggest(below), suggest(above)] };
  const nearest = below ?? above;
  return { status: "listed", reason: "outside", token: null, why: `beyond the scale: exact ${v}${u} kept, nearest ${nearest.name}`, suggestions: [suggest(nearest)] };
}

/**
 * @param {{ rows: {nodeId: string, node: string, kind: string, property: string, value: number|string}[], files: {path: string, text: string}[], rulings?: string|null }} input
 *   the link-run file's `unboundValues`, the project's source files (CSS read), and its ruling table
 * @returns {{ items: object[], findings: object[], counts: object }}
 */
export function matchRawValues({ rows, files, rulings = null }) {
  const all = tokens(files);
  const names = new Set(all.map((t) => t.name));
  const ruled = rulings ? readRulings(rulings) : [];
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.kind}|${keyOf(row)}`;
    if (!groups.has(key)) groups.set(key, { row, layers: [] });
    groups.get(key).layers.push({ nodeId: row.nodeId, node: row.node, property: row.property });
  }
  const findings = [];
  const items = [...groups.values()].map(({ row, layers }) => {
    const candidates = all.filter((t) => t.kind === wanted(row));
    const value = row.kind === "colour" ? String(row.value).toUpperCase() : Number(row.value);
    const match = row.kind === "colour" ? matchColour(value, candidates) : matchLength(row, candidates);
    const item = { kind: row.kind, property: row.kind === "type" ? row.property : null, value, figma: keyOf(row), layers, ...match };
    const r = ruled.find((x) => x.kind === `raw-${row.kind}` && x.figma.toUpperCase() === item.figma.toUpperCase());
    if (!r) return item;
    const ruling = { ruling: r.ruling, code: r.code, note: r.note };
    if (r.ruling === "use" && !names.has(r.code)) {
      findings.push({ code: "RULING_STALE", kind: `raw-${row.kind}`, figma: item.figma,
        message: `the ruling binds ${item.figma} to ${r.code || "(no code name)"}, which the scanned code no longer declares — rule it again` });
      return { ...item, ruling, stale: true };
    }
    return { ...item, status: "ruled", token: r.ruling === "use" ? r.code : null, ruling };
  });
  const counts = { values: items.length, built: 0, listed: 0, ruled: 0 };
  for (const i of items) counts[i.status] += 1;
  return { items, findings, counts };
}

/** The operator's view: what was built with a token (overrule with `keep`), then what needs their call. */
export function renderRawValues({ items, findings, counts }) {
  const cell = (s) => String(s ?? "").replace(/\|/g, "\\|");
  const layers = (i) => `${i.layers.length} layer${i.layers.length === 1 ? "" : "s"}`;
  const lines = ["## Raw values", "", `${counts.values} values not bound to a Figma variable · ${counts.built} built with a token · ${counts.listed} need your call · ${counts.ruled} ruled`, ""];
  for (const f of findings) lines.push(`- ${f.code} ${f.kind} ${f.figma} — ${f.message}`);
  if (findings.length) lines.push("");
  const built = items.filter((i) => i.status === "built");
  if (built.length) {
    lines.push("### Built with a token", "", "Each is built with the token. To keep the raw value instead, add a `keep` row to the ruling table.", "",
      "| kind | figma | token | why | where |", "| --- | --- | --- | --- | --- |");
    for (const i of built) lines.push(`| raw-${i.kind} | ${cell(i.figma)} | ${i.token} | ${cell(i.why)} | ${layers(i)} |`);
    lines.push("");
  }
  const listed = items.filter((i) => i.status === "listed");
  if (listed.length) {
    lines.push("### Needs your call", "", "Built with the exact value and a deviation row until ruled — never a stop. Rule each row `use` (with the token) or `keep`, then pass the table back with `--rulings`.", "",
      "| kind | figma | ruling | code | note |", "| --- | --- | --- | --- | --- |");
    for (const i of listed) {
      const note = `${i.why}${i.suggestions.length ? `; suggested ${i.suggestions.map((s) => `${s.token} (${s.value}, ${s.distance})`).join(" or ")}` : ""}; ${layers(i)}`;
      lines.push(`| raw-${i.kind} | ${cell(i.figma)} |  | ${i.reason === "slightly-off" ? i.suggestions[0].token : ""} | ${cell(note)} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}`;
}
