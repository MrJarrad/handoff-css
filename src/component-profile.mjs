// `handoff-css components` — how a design system builds its components and blocks, read from
// the layer export(s) (schema `design-handoff`) that use them.
//
// Pure: exports in, profile out. Nothing here knows a house's component names, separators, tiers or
// property names. Every statement is observed in the exports and carries the count it came from. The
// profile reports facts; whether a gap is intended, or which tier a new component belongs to, is the
// designer's to say.
//
// The limit is stated in the output, never hidden: a layer export lists the components its layers use
// (and defines the ones it holds), so on layer exports alone the profile sees "N of an unknown total".
// A Design System Handoff export (schema 20+) lists every component its file defines; passed as
// `inventory`, it makes the total known: the components that file defines. A library component a layer
// only places is outside that inventory and is counted as such, never added to the total.
import { fail } from "./resolve.mjs";

export const COMPONENT_PROFILE_VERSION = 2;

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const count = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const sortedObject = (map) => Object.fromEntries([...map].sort(([a], [b]) => byText(a, b)));
const cleanKey = (k) => String(k).replace(/#\d+:\d+$/, "");
const roots = (doc) => (Array.isArray(doc.layerTree) ? doc.layerTree : doc.layerTree ? [doc.layerTree] : []);

function nameCase(name) {
  if (/^[A-Z][A-Za-z0-9]*$/.test(name) && /[a-z]/.test(name)) return "Pascal";
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return "camel";
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(name) || /^[a-z0-9]+$/.test(name)) return "kebab";
  if (/\s/.test(name)) return "spaced";
  return "other";
}

/** The identity an instance points at: its component set name, else its own source name. */
const instanceName = (n) => n.component?.setName || n.component?.sourceName || n.name;

function walk(node, visit, parent = null) {
  visit(node, parent);
  for (const c of node.children ?? []) walk(c, visit, node);
}

/**
 * @param {object[]} docs layer exports (schema `design-handoff`)
 * @param {{ inventory?: object[] }} [options] Design System Handoff exports (schema 20+) whose `components[]` is the inventory
 * @returns {object} the component profile (see schema/component-profile.v2.schema.json)
 */
export function buildComponentProfile(docs, { inventory = [] } = {}) {
  const list = Array.isArray(docs) ? docs : [docs];
  const inventoryDocs = Array.isArray(inventory) ? inventory : [inventory];
  // No layer export is allowed when an inventory is given: the profile is then the inventory itself.
  if ((list.length === 0 && inventoryDocs.length === 0) || list.some((d) => d?.schema !== "design-handoff" || !Array.isArray(d.layerTree) && !d.layerTree)) {
    fail("components: not a Design Handoff layer export (schema design-handoff with a layerTree)");
  }

  for (const d of inventoryDocs) {
    if (d?.schema !== "design-system-handoff") fail("components: --ds-export is not a Design System Handoff export (schema design-system-handoff)");
    if (!Array.isArray(d.components)) fail(`components: ${d.documentName ?? "the Design System Handoff export"} (schema ${d.schemaVersion ?? "?"}) lists no components; export it again with the Design System Handoff plugin (schema 20 or newer lists them)`);
  }
  // One inventory entry per library component: its file, page and name. Two components with one name on
  // different pages stay two; the same library exported twice counts each component once.
  const inventoryEntries = new Map();
  for (const d of inventoryDocs) {
    for (const c of d.components) {
      const file = d.documentName ?? "(unnamed)";
      const key = [file, c.page ?? "", c.name].join("\u0000");
      if (!inventoryEntries.has(key)) inventoryEntries.set(key, { id: c.id ?? null, name: c.name, kind: c.kind, page: c.page ?? null, file, properties: c.properties ?? [] });
    }
  }
  const inventoryNames = new Set([...inventoryEntries.values()].map((x) => x.name));
  const inventoryOnly = list.length === 0;

  const comps = new Map(); // name -> record
  const rec = (name) => {
    if (!comps.has(name)) comps.set(name, { name, defined: false, kind: null, ids: new Set(), definedIn: new Set(), properties: new Map(), observed: new Map(), nests: new Map(), bindings: new Map(), placed: 0, files: new Set() });
    return comps.get(name);
  };

  if (inventoryOnly) {
    // The inventory is the profile: each library component is a defined row with its own properties; nothing is placed.
    for (const [key, e] of inventoryEntries) {
      Object.assign(rec(key), { name: e.name, defined: true, kind: e.kind ?? "component", id: e.id, page: e.page, files: new Set([e.file]),
        properties: new Map(e.properties.map((x) => [cleanKey(x.name), { type: x.type, default: x.defaultValue ?? null, options: x.options?.length ? x.options : null }])) });
    }
  }

  for (const [docIndex, doc] of list.entries()) {
    const file = doc.documentName ?? "(unnamed)";
    for (const root of roots(doc)) {
      // Definitions first: a COMPONENT_SET, or a COMPONENT that is not a variant of a set.
      walk(root, (node, parent) => {
        const isSet = node.type === "COMPONENT_SET";
        const isLoose = node.type === "COMPONENT" && parent?.type !== "COMPONENT_SET";
        if (!isSet && !isLoose) return;
        const r = rec(node.name);
        r.defined = true;
        r.definedIn.add(`${docIndex}\u0000${file}`);
        r.kind = isSet ? "set" : "component";
        r.ids.add(node.id);
        r.files.add(file);
        for (const [key, def] of Object.entries(node.componentPropertyDefinitions ?? {})) {
          r.properties.set(cleanKey(key), { type: def.type, default: def.defaultValue ?? null, options: def.variantOptions ?? null });
        }
        walk(node, (inner) => {
          if (inner === node) return;
          if (inner.type === "INSTANCE") {
            const n = instanceName(inner);
            if (n !== node.name) count(r.nests, n);
          }
          for (const b of Object.values(inner.tokenBindings ?? {})) {
            if (b?.variableName) count(r.bindings, `${b.collectionName ?? "(unknown)"}\u0000${b.variableName.split("/").slice(0, -1).join("/")}`);
          }
        });
      });
      // Placements: instances outside any definition, and the property values they were seen with.
      const inside = new Set();
      walk(root, (node, parent) => {
        if (node.type === "COMPONENT_SET" || (node.type === "COMPONENT" && parent?.type !== "COMPONENT_SET")) walk(node, (n) => inside.add(n));
      });
      walk(root, (node) => {
        if (node.type !== "INSTANCE" || !node.component) return;
        const r = rec(instanceName(node));
        if (node.component.sourceId) r.ids.add(node.component.sourceId);
        r.files.add(file);
        if (inside.has(node)) return;
        r.placed += 1;
        for (const [key, p] of Object.entries(node.component.props ?? {})) {
          const k = cleanKey(key);
          if (!r.observed.has(k)) r.observed.set(k, { type: p.type, values: new Set() });
          if (p.type === "VARIANT" || p.type === "BOOLEAN") r.observed.get(k).values.add(String(p.value));
        }
      });
    }
  }

  // The same component name defined in two exports is one record here (properties from the later export win).
  // Two libraries can reuse a name for different components, so say it rather than merge silently.
  const warnings = [...comps.values()]
    .filter((r) => r.definedIn.size > 1)
    .sort((a, b) => byText(a.name, b.name))
    .map((r) => `${r.name} is defined in ${r.definedIn.size} exports (${[...r.definedIn].map((x) => x.split("\u0000")[1]).join(", ")}); they are read as one component and the later export's properties win. Check they are the same component.`);

  const rows = [...comps.values()].sort((a, b) => byText(a.name, b.name) || byText(a.page ?? "", b.page ?? ""));

  // Tiers: how deep each component's nesting goes, over the components seen. Names for tiers are never imposed.
  const level = new Map();
  const depthOf = (name, stack = []) => {
    if (level.has(name)) return level.get(name);
    if (stack.includes(name)) return 0;
    const r = comps.get(name);
    const kids = r ? [...r.nests.keys()].filter((k) => comps.has(k)) : [];
    const d = kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => depthOf(k, [...stack, name])));
    level.set(name, d);
    return d;
  };
  for (const r of rows) depthOf(r.name);
  const usedInside = new Map();
  for (const r of rows) for (const k of r.nests.keys()) count(usedInside, k);

  const components = rows.map((r) => {
    const props = r.defined
      ? [...r.properties].sort(([a], [b]) => byText(a, b)).map(([name, d]) => ({ name, type: d.type, default: d.default, options: d.options, from: "definition" }))
      : [...r.observed].sort(([a], [b]) => byText(a, b)).map(([name, d]) => ({ name, type: d.type, default: null, options: d.values.size ? [...d.values].sort(byText) : null, from: "instances" }));
    return {
      name: r.name,
      ...(r.id !== undefined ? { id: r.id, page: r.page } : {}),
      kind: r.kind ?? "instance-only",
      defined: r.defined,
      files: [...r.files].sort(byText),
      placed: r.placed,
      properties: props,
      nests: sortedObject(r.nests),
      usedInsideOtherComponents: usedInside.get(r.name) ?? 0,
      tier: level.get(r.name) ?? 0,
      tokenGroups: sortedObject(new Map([...r.bindings].map(([k, n]) => [k.replace("\u0000", " › "), n]))),
    };
  });

  // Naming ---------------------------------------------------------------------------------------
  const named = components.map((c) => c.name);
  const privateNames = named.filter((n) => /^[._]/.test(n));
  const publicNames = named.filter((n) => !/^[._]/.test(n));
  const separator = publicNames.some((n) => n.includes("/")) ? "/" : publicNames.some((n) => /\w\.\w/.test(n)) ? "." : null;
  const depth = new Map();
  const cases = new Map();
  const prefixes = new Map();
  for (const n of publicNames) {
    const segs = n.split("/").map((s) => s.trim());
    count(depth, String(segs.length));
    count(cases, nameCase(segs.at(-1)));
    if (segs.length > 1) count(prefixes, segs.slice(0, -1).join("/"));
  }

  // Property model --------------------------------------------------------------------------------
  const axes = new Map(); // property name -> { components, types, values }
  for (const c of components) {
    for (const p of c.properties) {
      if (!axes.has(p.name)) axes.set(p.name, { components: new Set(), types: new Map(), values: new Set() });
      const a = axes.get(p.name);
      a.components.add(c.name);
      count(a.types, p.type);
      for (const v of p.options ?? []) a.values.add(v);
    }
  }
  const typeTotals = new Map();
  for (const c of components) for (const p of c.properties) count(typeTotals, p.type);

  const tierGroups = new Map();
  for (const c of components) {
    if (!tierGroups.has(c.tier)) tierGroups.set(c.tier, []);
    tierGroups.get(c.tier).push(c.name);
  }

  const bindingTotals = new Map();
  for (const c of components) for (const [k, n] of Object.entries(c.tokenGroups)) count(bindingTotals, k.split(" › ")[0], n);

  // A name the library defines on more than one page: a layer instance names the component, not its page, so a
  // layer-placed name cannot tell which of them it is.
  const pagesByName = new Map();
  for (const e of inventoryEntries.values()) {
    if (!pagesByName.has(e.name)) pagesByName.set(e.name, []);
    pagesByName.get(e.name).push(e.page ?? "");
  }
  const ambiguous = [...pagesByName].filter(([, p]) => p.length > 1).map(([name, pages]) => ({ name, pages: pages.sort(byText) })).sort((a, b) => byText(a.name, b.name));

  return {
    componentProfileVersion: COMPONENT_PROFILE_VERSION,
    source: {
      documents: list.map((d) => ({ documentName: d.documentName ?? null, contentHash: d.contentHash ?? null })),
      ...(inventoryDocs.length ? { inventory: inventoryDocs.map((d) => ({ documentName: d.documentName ?? null, contentHash: d.contentHash ?? null })) } : {}),
    },
    coverage: {
      seen: components.length,
      defined: components.filter((c) => c.defined).length,
      instanceOnly: components.filter((c) => !c.defined).length,
      ...(inventoryOnly
        ? {
            total: inventoryEntries.size,
            seenInInventory: 0,
            outsideInventory: 0,
            notSeen: [],
            basis: "inventory",
            note: "No layer export was given: these are the components the Design System Handoff export's file defines, and none is counted as placed.",
          }
        : inventoryDocs.length
        ? {
            total: inventoryEntries.size,
            seenInInventory: components.filter((c) => inventoryNames.has(c.name)).length,
            outsideInventory: components.filter((c) => !inventoryNames.has(c.name)).length,
            notSeen: [...inventoryEntries.values()].filter((x) => !comps.has(x.name)).map(({ id, properties, ...x }) => x).sort((a, b) => byText(a.name, b.name) || byText(a.page ?? "", b.page ?? "")),
            note: "The total is the components the Design System Handoff export's file defines. A component a layer places from another library is outside it (outsideInventory) and not added to the total.",
          }
        : {
            total: "unknown",
            note: "A layer export lists the components its layers use and defines; it is not the library's inventory. A component missing here may still exist in the system. Pass a Design System Handoff export (schema 20+) to make the total known.",
          }),
      ...(ambiguous.length ? { ambiguousNames: ambiguous } : {}),
    },
    naming: {
      private: privateNames.length,
      separator,
      depths: sortedObject(depth),
      leafCase: sortedObject(cases),
      categoryPrefixes: sortedObject(prefixes),
      flat: prefixes.size === 0 && publicNames.length > 0,
    },
    propertyModel: {
      byType: sortedObject(typeTotals),
      axes: [...axes]
        .map(([name, a]) => ({ name, components: a.components.size, types: sortedObject(a.types), values: [...a.values].sort(byText) }))
        .sort((x, y) => y.components - x.components || byText(x.name, y.name)),
    },
    composition: {
      tiers: [...tierGroups].sort(([a], [b]) => a - b).map(([tier, names]) => ({ tier, components: names.sort(byText) })),
      note: "Tier 0 nests no other component seen here; tier N nests at least one tier N-1. These are observed depths, not the system's own names for them.",
    },
    tokenBinding: { byCollection: sortedObject(bindingTotals) },
    components,
    warnings,
  };
}

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`), ""];

export function renderComponentProfileMarkdown(p) {
  const out = ["# Component profile", ""];
  if (p.coverage.basis === "inventory") {
    out.push(`${p.coverage.total} components defined in the library (the Design System Handoff export's file). There is no layer export, so none is counted as placed. ${p.coverage.note}`, "");
  } else if (p.coverage.total === "unknown") {
    out.push(`${p.coverage.seen} components seen (${p.coverage.defined} defined in these exports, ${p.coverage.instanceOnly} only placed), of an unknown total. ${p.coverage.note}`, "");
  } else {
    out.push(`${p.coverage.seenInInventory} of ${p.coverage.total} defined in the library are placed by these layer exports; ${p.coverage.outsideInventory} more are placed from outside it (${p.coverage.seen} components seen). ${p.coverage.note}`, "");
    if (p.coverage.notSeen.length) out.push("## In the library, placed by no layer here", "", ...table(["Component", "Kind", "Page"], p.coverage.notSeen.map((x) => [x.name, x.kind, x.page])));
  }
  out.push("Facts only: a gap or a tier is observed, never a verdict.", "");
  for (const w of p.warnings) out.push(`> Warning: ${w}`, "");
  out.push("## Naming", "", ...table(["Separator", "Depths", "Leaf case", "Flat", "Private (leading . or _)"],
    [[p.naming.separator ?? "none", JSON.stringify(p.naming.depths), JSON.stringify(p.naming.leafCase), p.naming.flat, p.naming.private]]));
  if (Object.keys(p.naming.categoryPrefixes).length) out.push(...table(["Category prefix", "Components"], Object.entries(p.naming.categoryPrefixes)));
  out.push("## Property model", "", ...table(["Property", "On components", "Types", "Values seen"], p.propertyModel.axes.map((a) => [a.name, a.components, JSON.stringify(a.types), a.values.join(", ")])));
  out.push("## Composition (observed nesting depth)", "", ...table(["Tier", "Components"], p.composition.tiers.map((t) => [t.tier, t.components.join(", ")])));
  out.push("## Token binding (by collection)", "", ...table(["Collection", "Bindings inside components"], Object.entries(p.tokenBinding.byCollection)));
  out.push("## Components", "", ...table(["Component", "Kind", "Placed", "Tier", "Properties", "Nests"],
    p.components.map((c) => [c.name, c.kind, c.placed, c.tier, c.properties.map((x) => `${x.name} (${x.type})`).join(", "), Object.keys(c.nests).join(", ")])));
  return out.join("\n");
}
