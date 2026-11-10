// `handoff-css profile` — how a design system is built, read from its Design System Handoff export.
//
// Pure: export in, profile out. Nothing here knows a house's collection names, separators,
// step numbers or mode names; every statement is derived from the export's own variables, alias
// graph and mode classification, and carries the evidence it came from. The profile reports
// facts. A gap (a leaf one sibling group has and another lacks) is a fact, never a verdict:
// whether it is intended is the designer's to say.
import { fail } from "./resolve.mjs";

export const PROFILE_VERSION = 1;

const isAlias = (x) => x != null && typeof x === "object" && x.type === "VARIABLE_ALIAS" && typeof x.id === "string";

/** Every alias id inside a mode's raw value (a bare alias, or an object such as `{ color, opacity }`). */
function aliasIds(raw) {
  if (isAlias(raw)) return [raw.id];
  if (raw && typeof raw === "object") return Object.values(raw).flatMap((v) => (isAlias(v) ? [v.id] : []));
  return [];
}

const count = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const sortedObject = (map) => Object.fromEntries([...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const NUMERIC = /^\d+(\.\d+)?$/;

/** The word-form a code name is built from: camelCase split, lowercased, non-alphanumerics to `-`. */
const words = (segment) =>
  segment
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function leafCase(leaf) {
  if (NUMERIC.test(leaf)) return "numeric";
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(leaf)) return "kebab";
  if (/^[a-z][a-zA-Z0-9]*$/.test(leaf)) return "camel";
  return "other";
}

/** OKLCH lightness of an `#RRGGBB[AA]` literal, or null. */
function oklchL(hex) {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex ?? "");
  if (!m) return null;
  const lin = (i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(0), lin(2), lin(4)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return Math.round((0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s) * 1000) / 1000;
}

/**
 * @param {object} doc a Design System Handoff export (schema `design-system-handoff`)
 * @returns {object} the system profile (see schema/system-profile.v1.schema.json)
 */
export function buildProfile(doc) {
  if (doc?.schema !== "design-system-handoff" || !Array.isArray(doc.collections)) {
    fail("profile: not a Design System Handoff export (schema design-system-handoff)");
  }
  const collections = doc.collections;

  // id -> { collection, name } over the whole set, so an alias is attributed to the collection it lands in.
  const owner = new Map();
  for (const c of collections) for (const v of c.variables ?? []) owner.set(v.id, { collection: c.name, variable: v });

  const modeMappings = new Map();
  for (const entry of doc.mode?.collections ?? []) {
    for (const m of entry.mappings ?? []) modeMappings.set(`${entry.collectionName}\u0000${m.modeId}`, m);
  }

  const referencedFrom = new Map(); // collection -> cells in OTHER collections that alias into it
  const layerRows = collections.map((c) => {
    const vars = c.variables ?? [];
    const targets = new Map();
    let literalCells = 0;
    let aliasCells = 0;
    let selfAliasCells = 0;
    for (const v of vars) {
      for (const mode of v.modes ?? []) {
        const ids = aliasIds(mode.raw);
        if (ids.length === 0) {
          literalCells += 1;
          continue;
        }
        aliasCells += 1;
        for (const id of ids) {
          const to = owner.get(id)?.collection ?? "(outside this export)";
          if (to === c.name) selfAliasCells += 1;
          else {
            count(targets, to);
            if (owner.has(id)) count(referencedFrom, to);
          }
        }
      }
    }
    return { c, vars, targets, literalCells, aliasCells, selfAliasCells };
  });

  const layers = layerRows.map(({ c, vars, targets, literalCells, aliasCells, selfAliasCells }) => {
    const aliasesOut = [...targets.values()].reduce((a, b) => a + b, 0);
    const referenced = referencedFrom.get(c.name) ?? 0;
    // primitive: raw values others alias into. semantic: aliases into other collections, holds no raw
    // value of its own. mixed: both. standalone: neither.
    const role =
      aliasesOut === 0 && referenced > 0
        ? "primitive"
        : aliasesOut > 0 && literalCells === 0
          ? "semantic"
          : aliasesOut > 0
            ? "mixed"
            : "standalone";
    return {
      collection: c.name,
      role,
      variables: vars.length,
      modes: (c.modes ?? []).length,
      hidden: c.hiddenFromPublishing === true,
      evidence: {
        literalCells,
        aliasCells,
        selfAliasCells,
        aliasesInto: sortedObject(targets),
        aliasedFromOtherCollections: referenced,
      },
    };
  });

  // Naming ------------------------------------------------------------------------------------
  const naming = layerRows.map(({ c, vars }) => {
    const depth = new Map();
    const cases = new Map();
    const web = new Map();
    let separated = 0;
    for (const v of vars) {
      const segs = v.name.split("/").map((s) => s.trim());
      if (segs.length > 1) separated += 1;
      count(depth, String(segs.length));
      count(cases, leafCase(segs[segs.length - 1]));
      const value = v.codeSyntax?.WEB?.value;
      if (typeof value !== "string") {
        count(web, "no-web-name");
        continue;
      }
      const rest = value.replace(/^-+/, "");
      const bare = segs.map(words).filter(Boolean);
      let key = "unexplained";
      for (let drop = 0; drop < bare.length; drop += 1) {
        if (bare.slice(drop).join("-") === rest) {
          key = `drops-${drop}-leading-segments`;
          break;
        }
      }
      count(web, key);
    }
    return {
      collection: c.name,
      separator: separated > 0 ? "/" : null,
      segmentDepth: sortedObject(depth),
      leafCase: sortedObject(cases),
      webName: {
        prefix: [...new Set(vars.map((v) => /^-*/.exec(v.codeSyntax?.WEB?.value ?? "")[0]))].sort(byText),
        rule: sortedObject(web),
      },
    };
  });

  // Groups, ramps, sibling gaps ------------------------------------------------------------------
  const groupMap = new Map(); // "collection\u0000a/b" -> { collection, path, leaves[], type }
  for (const { c, vars } of layerRows) {
    for (const v of vars) {
      const path = v.group ?? v.name.split("/").slice(0, -1);
      const leaf = v.leafName ?? v.name.split("/").pop();
      const key = `${c.name}\u0000${path.join("/")}`;
      if (!groupMap.has(key)) groupMap.set(key, { collection: c.name, path, leaves: [], variable: [] });
      groupMap.get(key).leaves.push(leaf);
      groupMap.get(key).variable.push(v);
    }
  }
  const allGroups = [...groupMap.values()].sort((a, b) =>
    byText(`${a.collection}/${a.path.join("/")}`, `${b.collection}/${b.path.join("/")}`),
  );
  const groups = allGroups.map((g) => ({ collection: g.collection, path: g.path.join("/"), leaves: [...g.leaves].sort(byText) }));

  const isRamp = (g) => g.leaves.length >= 4 && g.leaves.every((l) => NUMERIC.test(l));
  const ramps = allGroups.filter(isRamp).map((g) => {
    const order = g.variable
      .map((v, i) => ({ step: g.leaves[i], v }))
      .sort((a, b) => Number(a.step) - Number(b.step));
    const nums = order.map((o) => Number(o.step));
    const deltas = [...new Set(nums.slice(1).map((n, i) => Math.round((n - nums[i]) * 1000) / 1000))].sort((a, b) => a - b);
    const lit = (o) => o.v.modes?.[0]?.build?.literal ?? null;
    const colour = order[0].v.type === "COLOR";
    const end = (o) => ({ step: o.step, literal: lit(o), ...(colour ? { oklchL: oklchL(lit(o)) } : {}) });
    return {
      collection: g.collection,
      path: g.path.join("/"),
      type: order[0].v.type,
      steps: order.map((o) => o.step),
      stepGaps: deltas,
      ends: { low: end(order[0]), high: end(order[order.length - 1]) },
    };
  });
  const stepSets = new Map();
  for (const r of ramps) {
    const k = r.steps.join(",");
    if (!stepSets.has(k)) stepSets.set(k, { steps: r.steps, ramps: [] });
    stepSets.get(k).ramps.push(`${r.collection}:${r.path}`);
  }

  // Sibling families: groups of one collection whose paths are equal except at one segment, and whose
  // leaf sets overlap by at least half. A leaf present in a strict majority of a family's groups and
  // absent from one is reported as a gap, with where it is present.
  const plainGroups = allGroups.filter((g) => !isRamp(g) && g.path.length > 0);
  const families = new Map();
  for (const g of plainGroups) {
    for (let i = 0; i < g.path.length; i += 1) {
      const pattern = g.path.map((s, j) => (j === i ? "*" : s)).join("/");
      const key = `${g.collection}\u0000${pattern}`;
      if (!families.has(key)) families.set(key, { collection: g.collection, pattern, members: [] });
      families.get(key).members.push(g);
    }
  }
  const gaps = new Map();
  const observations = new Map();
  for (const f of families.values()) {
    if (f.members.length < 2) continue;
    const union = new Set(f.members.flatMap((g) => g.leaves));
    const members = f.members.filter((g) => {
      const own = new Set(g.leaves);
      const shared = [...own].filter((l) => f.members.some((o) => o !== g && o.leaves.includes(l))).length;
      return shared / new Set([...own, ...union]).size >= 0.5;
    });
    if (members.length < 2) continue;
    // Two groups cannot outvote each other, so a difference there is no gap: it is stated as an observation.
    if (members.length === 2) {
      const [a, b] = members;
      const onlyA = a.leaves.filter((l) => !b.leaves.includes(l)).sort(byText);
      const onlyB = b.leaves.filter((l) => !a.leaves.includes(l)).sort(byText);
      const key = `${f.collection}\u0000${f.pattern}\u0000${a.path.join("/")}\u0000${b.path.join("/")}`;
      if ((onlyA.length || onlyB.length) && !observations.has(key)) {
        observations.set(key, {
          collection: f.collection,
          family: f.pattern,
          groups: [a.path.join("/"), b.path.join("/")].sort(byText),
          onlyIn: { [a.path.join("/")]: onlyA, [b.path.join("/")]: onlyB },
        });
      }
      continue;
    }
    for (const leaf of new Set(members.flatMap((g) => g.leaves))) {
      const has = members.filter((g) => g.leaves.includes(leaf));
      const lacks = members.filter((g) => !g.leaves.includes(leaf));
      if (has.length * 2 <= members.length) continue;
      for (const g of lacks) {
        const key = `${f.collection}\u0000${g.path.join("/")}\u0000${leaf}`;
        if (gaps.has(key)) continue;
        gaps.set(key, {
          collection: f.collection,
          group: g.path.join("/"),
          lacks: leaf,
          presentIn: has.map((h) => h.path.join("/")).sort(byText),
          family: f.pattern,
        });
      }
    }
  }
  const siblingGaps = [...gaps.values()].sort((a, b) => byText(`${a.collection}/${a.group}/${a.lacks}`, `${b.collection}/${b.group}/${b.lacks}`));

  const siblingObservations = [...observations.values()].sort((a, b) => byText(`${a.collection}/${a.family}/${a.groups}`, `${b.collection}/${b.family}/${b.groups}`));

  // Modes ---------------------------------------------------------------------------------------
  const hasModeClassification = Array.isArray(doc.mode?.collections);
  const modes = layerRows.map(({ c }) => ({
    collection: c.name,
    defaultMode: (c.modes ?? []).find((m) => m.id === c.defaultModeId)?.name ?? null,
    modes: (c.modes ?? []).map((m) => {
      const mapped = modeMappings.get(`${c.name}\u0000${m.id}`);
      let meaning;
      let detectedBy;
      if ((c.modes ?? []).length === 1) {
        meaning = "single";
        detectedBy = { source: "mode-count", confidence: "high", note: "the collection has one mode" };
      } else if (mapped?.isTheme) {
        meaning = "theme";
        detectedBy = { source: `export:${mapped.source}`, confidence: mapped.confidence };
      } else if (mapped?.isResponsiveLayout) {
        meaning = "responsive-layout";
        detectedBy = { source: `export:${mapped.source}`, confidence: mapped.confidence };
      } else if (mapped) {
        meaning = "unclassified";
        detectedBy = { source: `export:${mapped.source}`, confidence: mapped.confidence };
      } else {
        meaning = "unclassified";
        detectedBy = { source: hasModeClassification ? "export:no-entry" : "export:no-mode-classification", confidence: "none" };
      }
      return {
        name: m.name,
        meaning,
        ...(mapped?.theme ? { theme: mapped.theme } : {}),
        ...(mapped?.layoutVariant ? { layoutVariant: mapped.layoutVariant } : {}),
        ...(mapped?.widthPx != null ? { widthPx: mapped.widthPx } : {}),
        detectedBy,
      };
    }),
  }));

  // Scopes, descriptions, names -----------------------------------------------------------------
  const coverage = layerRows.map(({ c, vars }) => {
    const scopes = new Map();
    for (const v of vars) count(scopes, (v.scopes ?? []).slice().sort(byText).join("+") || "(none)");
    return {
      collection: c.name,
      variables: vars.length,
      withDescription: vars.filter((v) => (v.description ?? "").trim() !== "").length,
      scopes: sortedObject(scopes),
    };
  });
  const names = layerRows.map(({ c, vars }) => ({
    collection: c.name,
    names: vars.map((v) => ({ name: v.name, type: v.type })).sort((a, b) => byText(a.name, b.name)),
  }));

  return {
    profileVersion: PROFILE_VERSION,
    source: {
      documentName: doc.documentName ?? null,
      schemaVersion: doc.schemaVersion ?? null,
      exportVersion: doc.exportVersion ?? null,
      contentHash: doc.contentHash ?? null,
    },
    layers,
    naming,
    groups,
    ramps,
    rampStepSets: [...stepSets.values()],
    siblingGaps,
    siblingObservations,
    modes,
    coverage,
    names,
  };
}

const code = (s) => `\`${s}\``;
const table = (head, rows) =>
  [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const kv = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(", ") || "-";

/** The profile as markdown: the same facts, for a reader. */
export function renderProfileMarkdown(p) {
  const out = [];
  out.push(`# System profile — ${p.source.documentName ?? "(unnamed)"}`, "");
  out.push(
    `Export schema ${p.source.schemaVersion}, export version ${p.source.exportVersion}, content hash ${code(p.source.contentHash ?? "none")}.`,
    "",
    "This file states how the system is built. Gaps are facts, not verdicts; a new name or ramp is the designer's call.",
    "A sibling gap needs a family of at least 3 groups (groups whose paths differ at one segment, each sharing at least half its leaves with the family) and a leaf in a strict majority of them. A family of exactly 2 is listed under sibling observations instead; a group sharing under half its leaves with the family is left out of both.",
    "",
  );
  out.push("## Layers", "", table(["Collection", "Role", "Variables", "Modes", "Aliases into", "Evidence"],
    p.layers.map((l) => [code(l.collection), l.role, l.variables, l.modes, kv(l.evidence.aliasesInto),
      `${l.evidence.literalCells} literal / ${l.evidence.aliasCells} alias cells; aliased from other collections ${l.evidence.aliasedFromOtherCollections}`])), "");
  out.push("## Naming", "", table(["Collection", "Separator", "Segments", "Leaf case", "Code name (WEB)"],
    p.naming.map((n) => [code(n.collection), n.separator ? code(n.separator) : "-", kv(n.segmentDepth), kv(n.leafCase),
      `prefix ${n.webName.prefix.map(code).join(" ")}; ${kv(n.webName.rule)}`])), "");
  out.push("## Ramps", "");
  if (p.ramps.length === 0) out.push("None found.", "");
  else {
    out.push(table(["Ramp", "Type", "Steps", "Low end", "High end"],
      p.ramps.map((r) => {
        const end = (e) => `${e.step}${e.literal ? ` ${e.literal}` : ""}${e.oklchL != null ? ` (L ${e.oklchL})` : ""}`;
        return [code(`${r.collection}:${r.path}`), r.type, `${r.steps.length}: ${r.steps.join(", ")}`, end(r.ends.low), end(r.ends.high)];
      })), "");
    out.push("Ramps sharing one step set:", "");
    for (const s of p.rampStepSets) out.push(`- ${s.steps.length} steps (${s.steps.join(", ")}): ${s.ramps.map(code).join(", ")}`);
    out.push("");
  }
  out.push("## Sibling gaps", "");
  if (p.siblingGaps.length === 0) out.push("None found.", "");
  else {
    for (const g of p.siblingGaps) {
      out.push(`- ${code(`${g.collection}:${g.group}`)} has no ${code(g.lacks)}; ${g.presentIn.map(code).join(", ")} ${g.presentIn.length === 1 ? "has" : "have"} it (family ${code(g.family)}).`);
    }
    out.push("");
  }
  out.push("## Sibling observations", "");
  if (p.siblingObservations.length === 0) out.push("None found.", "");
  else {
    for (const o of p.siblingObservations) {
      out.push(`- ${code(`${o.collection}:${o.family}`)}: two groups, ${o.groups.map((g) => `${code(g)} only has ${o.onlyIn[g].map(code).join(", ") || "nothing extra"}`).join("; ")}. Two groups cannot outvote each other, so this is a fact, not a gap.`);
    }
    out.push("");
  }
  out.push("## Modes", "");
  for (const m of p.modes) {
    out.push(`- ${code(m.collection)} (default ${m.defaultMode ?? "none"}): ` +
      m.modes.map((x) => `${code(x.name)} = ${x.meaning} [${x.detectedBy.source}, ${x.detectedBy.confidence}]`).join("; "));
  }
  out.push("", "## Scopes and descriptions", "", table(["Collection", "Variables", "With description", "Scopes"],
    p.coverage.map((c) => [code(c.collection), c.variables, c.withDescription, kv(c.scopes)])), "");
  out.push("## Groups", "", table(["Collection", "Group", "Leaves"],
    p.groups.map((g) => [code(g.collection), code(g.path || "(root)"), g.leaves.length > 12 ? `${g.leaves.length} leaves` : g.leaves.join(", ")])), "");
  out.push(`Every existing variable name is listed in ${code("system-profile.json")} under ${code("names")}.`, "");
  return out.join("\n");
}
