// The contrast report. Each foreground/background pair of a component is
// resolved in every theme mode of the design system — alias chains followed,
// opacity compositions (a variable that is a colour at an opacity) flattened over
// what sits behind them — and graded against WCAG AA (4.5 text, 3 large text and
// non-text). Pure over a Design System Handoff export; the pairs come from the
// caller (a pairs list, or a layer brief via `pairsFromBrief`).
import { wcagContrast } from "culori";
import { AA } from "./color-engine/wcag.mjs";
import { fail } from "./resolve.mjs";

export const DEFAULT_PAGE = "color/background/default/primary";

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
const toHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
/** Display only: the hex a viewer's screen rounds to. The grade never reads it. */
const toRgb = ([r, g, b]) => ({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });

/** `top` painted over an opaque `under`: the colour a viewer sees. */
const over = (top, under) => ({ rgb: top.rgb.map((c, i) => c * top.alpha + under.rgb[i] * (1 - top.alpha)), alpha: 1 });

/** Name and id lookup over every variable of the export, with its collection. */
function indexVariables(ds) {
  const byKey = new Map();
  for (const collection of ds.collections ?? []) {
    for (const variable of collection.variables ?? []) {
      byKey.set(variable.id, { collection, variable });
      byKey.set(variable.name, { collection, variable });
    }
  }
  return byKey;
}

/** The theme modes of the export (`mode.policy`: a theme is a mode flagged `isTheme`). */
export function themeModes(ds) {
  const names = [];
  for (const collection of ds.collections ?? []) {
    for (const m of collection.modeMapping ?? []) if (m.isTheme && !names.includes(m.modeName)) names.push(m.modeName);
  }
  return names;
}

/** @returns {(name: string, mode: string) => { rgb: number[], alpha: number }} */
export function colourResolver(ds) {
  const index = indexVariables(ds);
  const lookup = (ref) => index.get(ref) ?? fail(`contrast: no variable ${JSON.stringify(ref)} in the export`);

  /** A variable's value in a mode: a mode the collection lacks reads its default mode (Figma's own rule). */
  function valueOf(ref, mode, trail = []) {
    const { collection, variable } = lookup(ref);
    if (trail.includes(variable.id)) fail(`contrast: alias loop at ${variable.name}`);
    const m = variable.modes.find((x) => x.modeName === mode) ?? variable.modes.find((x) => x.modeId === collection.defaultModeId) ?? variable.modes[0];
    const next = [...trail, variable.id];
    const raw = m.raw;
    if (raw?.type === "VARIABLE_ALIAS") return valueOf(raw.id, mode, next);
    if (raw && typeof raw === "object" && raw.color && raw.opacity) {
      const colour = valueOf(raw.color.id, mode, next);
      const opacity = valueOf(raw.opacity.id, mode, next);
      return { rgb: colour.rgb, alpha: colour.alpha * opacity };
    }
    if (typeof raw === "string") {
      const h = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(raw) ?? fail(`contrast: ${variable.name} holds ${JSON.stringify(raw)}, not a colour`);
      return { rgb: [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)), alpha: h[2] ? parseInt(h[2], 16) / 255 : 1 };
    }
    if (typeof raw === "number") {
      const built = m.build?.value;
      if (typeof built !== "number") fail(`contrast: ${variable.name} is a number the export does not build (needs build.value)`);
      return built;
    }
    return fail(`contrast: ${variable.name} has a value this report cannot read`);
  }
  const colour = (name, mode) => {
    const v = valueOf(name, mode);
    if (typeof v === "number") fail(`contrast: ${name} is a number, not a colour`);
    return v;
  };
  colour.has = (name) => index.has(name);
  return colour;
}

/**
 * @param {object} ds  a Design System Handoff export
 * @param {{ pairs: { id: string, fg: string, bg: string, use?: "text"|"large-text"|"ui", note?: string, source?: string }[], page?: string }} opts
 */
export function contrastReport(ds, { pairs, page = DEFAULT_PAGE, skipped = [], notGraded = 0 }) {
  const resolve = colourResolver(ds);
  const modes = themeModes(ds);
  const rows = [];
  const unresolved = pairs.flatMap((p) => [p.fg, p.bg].filter((n) => !resolve.has(n)).map((variable) => ({ pair: p.id, variable })));
  pairs = pairs.filter((p) => resolve.has(p.fg) && resolve.has(p.bg));
  for (const mode of modes) {
    const pageColour = resolve(page, mode);
    if (pageColour.alpha !== 1) fail(`contrast: the page colour ${page} is translucent in ${mode}`);
    for (const pair of pairs) {
      const use = pair.use ?? "text";
      if (AA[use] === undefined) fail(`contrast: pair ${pair.id} has use ${JSON.stringify(use)} (text, large-text, ui)`);
      const bg = over(resolve(pair.bg, mode), pageColour);
      const fg = over(resolve(pair.fg, mode), bg);
      const exact = wcagContrast(toRgb(fg.rgb), toRgb(bg.rgb));
      rows.push({
        id: pair.id, mode, fg: pair.fg, bg: pair.bg, use, floor: AA[use], ratio: +exact.toFixed(2), exact, pass: exact >= AA[use],
        fgColour: toHex(fg.rgb), bgColour: toHex(bg.rgb), ...(pair.note ? { note: pair.note } : {}), ...(pair.source ? { source: pair.source } : {}),
      });
    }
  }
  return { page, modes, rows, fails: rows.filter((r) => !r.pass), unresolved, skipped, notGraded };
}

const SURFACE = new Set(["SECTION", "FRAME", "INSTANCE", "COMPONENT", "COMPONENT_SET", "GROUP"]);

/** The topmost visible solid fill (Figma paints the array bottom to top), or undefined. */
const solidFill = (n) => (n.fills ?? []).filter((f) => f.type === "SOLID" && f.visible !== false).at(-1);

/**
 * Foreground/backdrop pairs from a layer brief's tree: every TEXT node (text) and every leaf
 * shape (non-text) whose fill is bound to a colour variable, against the nearest ancestor
 * surface's fill. A node with no surface behind it sits on `page`. A fill with no variable
 * cannot be resolved per mode, so it is listed in `skipped`, never guessed. Strokes of
 * frames and instances are not graded (whether a boundary is the only identifier is not in
 * the brief); `notGraded` counts the bound ones.
 * @returns {{ pairs: object[], skipped: { node: string, reason: string }[], notGraded: number }}
 */
export function pairsFromBrief(brief, { page = DEFAULT_PAGE } = {}) {
  const found = new Map();
  const skipped = [];
  let notGraded = 0;
  const walk = (n, backdrop) => {
    if (n.visible === false) return;
    const surface = SURFACE.has(n.type);
    if (surface) notGraded += (n.strokes ?? []).filter((s) => s.token).length;
    if (!surface) {
      const f = solidFill(n);
      if (f) {
        if (backdrop.unbound) skipped.push({ node: n.name, reason: "backdrop-unbound" });
        else if (!f.token) skipped.push({ node: n.name, reason: "fill-unbound" });
        else {
          const use = n.type === "TEXT" ? "text" : "ui";
          const key = `${f.token}|${backdrop.token}|${use}`;
          const pair = found.get(key) ?? { id: `${f.token} on ${backdrop.token}`, fg: f.token, bg: backdrop.token, use, source: "brief", nodes: [] };
          pair.nodes.push(n.name);
          found.set(key, pair);
        }
      }
    }
    let next = backdrop;
    if (surface) {
      const f = solidFill(n);
      if (f) next = f.token ? { token: f.token } : { unbound: true };
    }
    for (const c of n.children ?? []) walk(c, next);
  };
  for (const root of brief.layerTree ?? []) walk(root, { token: page });
  return { pairs: [...found.values()], skipped, notGraded };
}

const cell = (s) => String(s).replaceAll("|", "\\|");

export function renderMarkdown(report, { exportName } = {}) {
  const lines = ["# Contrast report", ""];
  if (exportName) lines.push(`Export: ${exportName}`);
  lines.push(`Page behind every fill: \`${report.page}\` (a translucent fill is flattened over it, then the foreground over that).`,
    `Pairs: ${new Set(report.rows.map((r) => r.id)).size} · modes: ${report.modes.join(", ")} · rows: ${report.rows.length} · fails: ${report.fails.length}`, "");
  const table = (rows) => [
    "| pair | mode | foreground | background | use | ratio | floor | result |", "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${cell(r.id)} | ${r.mode} | ${cell(r.fg)} ${r.fgColour} | ${cell(r.bg)} ${r.bgColour} | ${r.use} | ${r.ratio.toFixed(2)} | ${r.floor} | ${r.pass ? "pass" : "FAIL"} |`),
  ];
  lines.push("## Fails", "", ...(report.fails.length ? table(report.fails) : ["None."]), "", "## All rows", "", ...table(report.rows), "");
  lines.push("## Not graded", "",
    `- Variable not in this export (${report.unresolved.length}): ${report.unresolved.map((u) => `${u.pair} → ${u.variable}`).join("; ") || "none"}`,
    `- Fill not bound to a variable (${report.skipped.length}): ${report.skipped.map((k) => `${k.node} (${k.reason})`).join("; ") || "none"}`,
    `- Frame and instance strokes bound to a variable (${report.notGraded}): not graded — whether a boundary is the only identifier is not in the brief`, "");
  return lines.join("\n");
}
