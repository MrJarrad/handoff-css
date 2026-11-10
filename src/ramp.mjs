// `handoff-css ramp` (HT-112, plan slice B-S2) — a colour nothing in the system fits, as a whole ramp.
//
// Pure: export + anchors in, proposal out. The ramp is built in the system's own steps (the most common
// scale among its colour ramps) and fitted to its ramps' lightness; a system with no colour ramps, or a
// caller who says so, gets the color engine's defaults. The name is the caller's or a generated one. For
// each semantic colour the caller names, the proposal says which step it uses in every mode, and why.
// It writes nothing into Figma: the proposal is a patch that an agent or the designer applies there, after
// which the export is taken again.
import { buildProfile } from "./profile.mjs";
import { fail } from "./resolve.mjs";
import { ramp, DEFAULTS, fitToSystem, mergeVerdict, nameColor, grade, nearestPassingStep, mirrorStep, pullBack } from "./color-engine/index.mjs";
import { hexToOklch } from "./color-engine/color.mjs";

export const RAMP_VERSION = 1;
const MODE_GAP = 0.15; // a mode whose surface is this much darker (OKLCH L) than the default mode's is mapped by mirroring

// A colour only when opaque: an 8-digit literal with alpha below ff is a shadow or a tint, not a step of a colour ramp.
const hex6 = (s) => (/^#[0-9a-f]{6}(ff)?$/i.test(s ?? "") ? s.slice(0, 7).toLowerCase() : null);
const cellHex = (cell) => hex6(cell?.build?.literal ?? cell?.alias?.terminalValue);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The system's colour ramps with every step's colour, read from the export. */
function colourRamps(doc, profile) {
  const out = [];
  for (const r of profile.ramps.filter((x) => x.type === "COLOR")) {
    const c = doc.collections.find((x) => x.name === r.collection);
    const steps = [];
    for (const v of c.variables) {
      const path = (v.group ?? v.name.split("/").slice(0, -1)).join("/");
      const hex = cellHex(v.modes?.[0]);
      if (path === r.path && hex) steps.push({ step: Number(v.leafName ?? v.name.split("/").pop()), hex, label: v.leafName ?? v.name.split("/").pop(), web: v.codeSyntax?.WEB?.value ?? null });
    }
    if (steps.length === r.steps.length) out.push({ name: r.path.split("/").at(-1), parent: r.path.split("/").slice(0, -1).join("/"), collection: r.collection, steps });
  }
  return out;
}

const commonest = (xs) => {
  const n = new Map();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort(([a, i], [b, j]) => j - i || (a < b ? -1 : 1))[0]?.[0];
};

/** The web name a sibling's naming implies for a new variable, or null when it cannot be told. */
function webNameFor(sibling, name, label) {
  const last = sibling?.web;
  const tail = `${slug(sibling?.rampName)}`;
  if (!last || !sibling.rampName) return null;
  const at = last.toLowerCase().lastIndexOf(tail);
  const sep = last.slice(at + tail.length, last.length - sibling.label.length);
  if (at < 0 || !last.endsWith(sibling.label)) return null;
  return `${last.slice(0, at)}${slug(name)}${sep}${label}`;
}

function findVariable(doc, name) {
  const hits = doc.collections.flatMap((c) => c.variables.filter((v) => v.name === name).map((v) => ({ c, v })));
  if (hits.length !== 1) fail(`ramp: ${hits.length ? "several variables" : "no variable"} named ${JSON.stringify(name)} in the export`);
  return hits[0];
}

/** @param {{ doc: object, anchors: { hex: string, step?: number }[], name?: string, fromScratch?: boolean,
 *    forColours?: { name: string, step?: number }[], on?: string[], use?: "text"|"large-text"|"ui", keepAnchor?: boolean }} input */
export function proposeRamp({ doc, anchors, name, fromScratch = false, forColours = [], on = [], use = "text", keepAnchor = false }) {
  const profile = buildProfile(doc);
  if (!Array.isArray(anchors) || !anchors.length) fail("ramp: give at least one --anchor");
  if (forColours.length && !on.length) fail("ramp: --for needs --on (the surface the colour is read on); sibling backgrounds are not guessed");
  const existing = colourRamps(doc, profile);

  // Basis: the system's own ramps, or the defaults.
  const system = !fromScratch && existing.length ? fitToSystem(existing.map((r) => ({ name: r.name, steps: r.steps }))) : null;
  const steps = system?.steps ?? [...DEFAULTS.steps];
  const lightness = system?.lightness ?? { ...DEFAULTS.lightness };
  const basis = system
    ? { kind: "fitted", ramps: system.basis.ramps, steps, lightness, reason: `fitted to the system's ${system.basis.ramps} colour ramps on ${steps.length} steps` }
    : { kind: "defaults", ramps: 0, steps, lightness, reason: fromScratch ? "built from scratch (--from-scratch): the engine's defaults" : "the system has no colour ramps: the engine's defaults" };

  // One merged ramp when the anchors make sense as one; otherwise one ramp per anchor.
  const verdict = anchors.length > 1 ? mergeVerdict({ anchors, steps, system: system ?? undefined }) : null;
  const sets = !verdict || verdict.merge ? [anchors] : anchors.map((a) => [a]);
  if (sets.length > 1 && name !== undefined) fail(`ramp: the anchors do not make one ramp (${verdict.reasons.filter((r) => r.veto && !r.pass).map((r) => r.check).join(", ")}), so --name cannot name them all; run once per anchor`);
  if (sets.length > 1 && forColours.length) fail("ramp: the anchors do not make one ramp, so a semantic colour has no single ramp to map onto; run once per anchor");

  // Where the new variables go, and how siblings are named.
  const collection = commonest(existing.map((r) => r.collection)) ?? profile.layers.find((l) => l.role === "primitive")?.collection ?? null;
  const siblings = existing.filter((r) => r.collection === collection);
  const parent = commonest(siblings.map((r) => r.parent)) ?? "";
  // A name must not be any group of the export, in any collection, nor a ramp already beside the new one.
  const groupNames = new Set(doc.collections.flatMap((c) => c.variables.flatMap((v) => v.group ?? v.name.split("/").slice(0, -1))).map(slug));
  const taken = new Set([...siblings.map((r) => slug(r.name)), ...groupNames]);
  if (name !== undefined && (typeof name !== "string" || !slug(name) || name.includes("/") || name !== name.trim())) fail(`ramp: --name ${JSON.stringify(name)} must be one path segment: no "/", no surrounding space, some letter or digit`);
  const sib = siblings[0] && { rampName: siblings[0].name, label: siblings[0].steps.at(-1).label, web: siblings[0].steps.at(-1).web };
  const labelOf = new Map(siblings[0]?.steps.map((s) => [s.step, s.label]) ?? []);
  const label = (n) => labelOf.get(n) ?? String(n);

  const built = sets.map((set) => {
    const r = ramp({ anchors: set, steps, lightness });
    const seed = [...r.placement].sort((a, b) => a.step - b.step)[0];
    let rampName;
    let nameSource;
    if (name !== undefined) {
      rampName = name;
      nameSource = "given";
      if (taken.has(slug(name))) fail(`ramp: ${JSON.stringify(name)} is already ${siblings.some((r) => slug(r.name) === slug(name)) ? `a ramp in ${collection}` : "a group of the export"}; choose another name`);
    } else {
      rampName = nameColor(seed.hex, { exclude: [...taken] }).slug;
      nameSource = "generated";
    }
    taken.add(slug(rampName));
    const variables = r.steps.map((s) => ({
      name: [parent, rampName, label(s.step)].filter(Boolean).join("/"),
      webName: webNameFor(sib, rampName, label(s.step)),
      step: s.step,
      hex: s.hex,
      ...(s.anchor ? { anchor: true } : {}),
    }));
    return { name: rampName, nameSource, collection, parent, steps: r.steps, placement: r.placement, audit: r.audit, variables };
  });

  const mapping = forColours.length ? mapSemantics({ doc, built: built[0], forColours, on, use, keepAnchor }) : [];
  const open = mapping.filter((m) => m.step === null).length;
  const questions = built.filter((b) => b.nameSource === "generated").map((b) => ({
    id: "name",
    ask: `Keep the generated ramp name ${JSON.stringify(b.name)}, or give your own? (re-run with --name <name>)`,
    ramp: b.name,
  }));

  return {
    rampVersion: RAMP_VERSION,
    source: { documentName: doc.documentName ?? null, contentHash: doc.contentHash ?? null },
    writes: "nothing",
    basis,
    anchors: anchors.map((a) => ({ hex: a.hex.toLowerCase(), ...(a.step !== undefined ? { step: a.step } : {}) })),
    merge: verdict && { merge: verdict.merge, reasons: verdict.reasons },
    ramps: built.map(({ steps: _s, ...b }) => b),
    mapping,
    questions,
    open,
  };
}

function mapSemantics({ doc, built, forColours, on, use, keepAnchor }) {
  const rampSteps = built.steps.map((s) => ({ step: s.step, hex: s.hex }));
  const anchorSteps = new Set(built.placement.map((p) => p.step));
  const firstAnchor = [...built.placement].sort((a, b) => a.step - b.step)[0].step;
  const rows = [];
  for (const f of forColours) {
    const { c, v } = findVariable(doc, f.name);
    if (f.step !== undefined && !rampSteps.some((s) => s.step === f.step)) fail(`ramp: --for ${f.name}@${f.step}: ${f.step} is not a step of the ramp (${rampSteps.map((s) => s.step).join(", ")})`);
    const start = f.step ?? firstAnchor;
    const surfaces = on.map((n) => {
      const hit = findVariable(doc, n);
      if (hit.c !== c) fail(`ramp: --on ${n} is in ${hit.c.name}, not ${c.name} with ${f.name}; modes would not line up`);
      return hit.v;
    });
    const surfaceIn = (modeId) => surfaces.map((s) => {
      const hex = cellHex(s.modes.find((m) => m.modeId === modeId));
      if (!hex) fail(`ramp: ${s.name} has no resolved colour in mode ${modeId}`);
      return { variable: s.name, hex };
    });
    const baseL = hexToOklch(surfaceIn(c.defaultModeId)[0].hex).l;
    for (const mode of c.modes) {
      const surf = surfaceIn(mode.id);
      const hexes = surf.map((s) => s.hex);
      const passes = (step) => hexes.every((bg) => grade(rampSteps.find((s) => s.step === step).hex, bg, use).pass);
      const mirrored = mode.id !== c.defaultModeId && hexToOklch(hexes[0]).l < baseL - MODE_GAP;
      let step;
      let reason;
      if (!mirrored) {
        step = start;
        reason = passes(start) ? `${start} clears ${use === "text" ? "4.5" : "3"}` : null;
        if (!reason) {
          step = nearestPassingStep(rampSteps, start, hexes, use);
          reason = step === null ? `no step of the ramp clears ${use === "text" ? "4.5" : "3"} on ${surf.map((s) => s.variable).join(" and ")}` : `${start} fails on the surface; ${step} is the nearest step that passes`;
        }
      } else if (keepAnchor && anchorSteps.has(start) && passes(start)) {
        step = start;
        reason = `anchor ${start} kept across modes (--keep-anchor) and it passes`;
      } else {
        const m = mirrorStep(rampSteps, start);
        step = m;
        reason = `${start} mirrored by lightness to ${m}`;
        if (!passes(m)) {
          step = nearestPassingStep(rampSteps, m, hexes, use);
          reason = step === null ? `${start} mirrored to ${m}, which fails; no step of the ramp passes` : `${start} mirrored to ${m}, which fails on the surface; ${step} is the nearest step that passes`;
        }
      }
      const hex = step === null ? null : rampSteps.find((s) => s.step === step).hex;
      const ratios = step === null ? [] : surf.map((s) => ({ variable: s.variable, hex: s.hex, ratio: grade(hex, s.hex, use).ratio }));
      rows.push({ semantic: f.name, collection: c.name, mode: mode.name, step, hex, use, surfaces: step === null ? surf : ratios, ratio: ratios.length ? Math.min(...ratios.map((r) => r.ratio)) : null, pass: step !== null, reason });
    }
  }
  if (use === "text") nudgeOvershoots(rows, built, rampSteps, anchorSteps);
  return rows;
}

/** A step used by the mapping that clears 4.5 by a wide margin is eased back toward 4.5, once for every
 *  mode and colour on it, and only when every surface it meets still passes. */
function nudgeOvershoots(rows, built, rampSteps, anchorSteps) {
  for (const step of [...new Set(rows.filter((r) => r.pass).map((r) => r.step))]) {
    const users = rows.filter((r) => r.step === step);
    const tightest = users.flatMap((r) => r.surfaces).sort((a, b) => a.ratio - b.ratio)[0];
    const p = pullBack(rampSteps, step, tightest.hex, { anchor: anchorSteps.has(step) });
    if (!p) continue;
    if (!users.every((r) => r.surfaces.every((s) => grade(p.hex, s.hex).pass))) continue;
    rampSteps.find((s) => s.step === step).hex = p.hex;
    const v = built.variables.find((x) => x.step === step);
    v.hex = p.hex;
    v.nudged = { from: p.from };
    for (const r of users) {
      r.hex = p.hex;
      r.surfaces = r.surfaces.map((s) => ({ ...s, ratio: grade(p.hex, s.hex).ratio }));
      r.ratio = Math.min(...r.surfaces.map((s) => s.ratio));
      r.reason += `; eased back from ${p.from} to ${p.hex} (it cleared 4.5 by more than 0.5)`;
    }
  }
}

export function renderRampMarkdown(p) {
  const out = [`# Ramp proposal${p.source.documentName ? ` for ${p.source.documentName}` : ""}`, "",
    `Nothing has been written into Figma. This is a patch: apply it there (an agent after a yes, or the designer), then take the export again.`, "",
    `- Basis: ${p.basis.reason}; steps ${p.basis.steps.join(", ")}; darkest step at lightness ${p.basis.lightness.min.toFixed(3)}.`,
    `- Anchors: ${p.anchors.map((a) => `\`${a.hex}\`${a.step !== undefined ? ` at ${a.step}` : ""}`).join(", ")}.`];
  if (p.merge) out.push(`- ${p.merge.merge ? "These anchors make one ramp" : "These anchors do not make one ramp"}: ${p.merge.reasons.map((r) => `${r.check} ${r.pass ? "ok" : "no"}`).join(", ")}.`);
  for (const q of p.questions) out.push(`- **Question:** ${q.ask}`);
  for (const r of p.ramps) {
    out.push("", `## \`${r.name}\` (${r.nameSource} name) in ${r.collection ?? "(no primitive collection found)"}`, "",
      `Evenness ${r.audit.evenness}, hue drift ${r.audit.hueDrift}°.`, "", "| Step | Variable | Colour | |", "| --- | --- | --- | --- |");
    for (const v of r.variables) out.push(`| ${v.step} | \`${v.name}\`${v.webName ? ` (\`${v.webName}\`)` : ""} | \`${v.hex}\` | ${[v.anchor ? "anchor, exact" : "", v.nudged ? `eased from ${v.nudged.from}` : ""].filter(Boolean).join("; ")} |`);
  }
  if (p.mapping.length) {
    out.push("", "## Semantic colours, by mode", "", "| Colour | Mode | Step | Ratio | Why |", "| --- | --- | --- | --- | --- |");
    for (const m of p.mapping) out.push(`| \`${m.semantic}\` | ${m.mode} | ${m.step ?? "none"} | ${m.ratio ?? "-"} (${m.use}) | ${m.reason} |`);
    if (p.open) out.push("", `${p.open} mapping(s) have no passing step and wait for a call.`);
  }
  return `${out.join("\n")}\n`;
}
