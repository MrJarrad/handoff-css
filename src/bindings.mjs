// BINDING MAP. "Which thing is this colour?" answered from the export: for a variable, every
// node of a layer export that binds it, the component and instance that node sits in, the
// property it binds, and the exported frame it belongs to (so a reader can open its render).
//
// The layer export is the source: `tokenBindings` (schema 12+) names variable AND property per
// node; `variableBindings` states the same aliases without a property name, and also carries
// bindings `tokenBindings` omits (layout grids), so a bare alias beyond the named ones becomes
// one row with `property: null`. The Design System Handoff export is optional: it resolves a
// CSS name and adds the library-wide tally, but names at most five consumer nodes per variable
// and neither their component nor their property (src/conform-drift.mjs:6-8).
//
// Pure: parsed documents in, a map out. Images and files are the CLI's.
import { fail } from "./resolve.mjs";

const roots = (doc) => (Array.isArray(doc.layerTree) ? doc.layerTree : doc.layerTree ? [doc.layerTree] : []);
const instanceName = (n) => n.component?.setName || n.component?.sourceName || n.name;
const label = (doc) => doc.pageName ? `${doc.documentName ?? "(unnamed)"} › ${doc.pageName}` : (doc.documentName ?? "(unnamed)");
const aliasIds = (o, out = []) => {
  if (Array.isArray(o)) o.forEach((v) => aliasIds(v, out));
  else if (o && typeof o === "object") {
    if (o.type === "VARIABLE_ALIAS" && o.id) out.push(o.id);
    else Object.values(o).forEach((v) => aliasIds(v, out));
  }
  return out;
};

function eachNode(doc, visit) {
  const walk = (node, ancestors) => {
    visit(node, ancestors);
    for (const c of node.children ?? []) walk(c, [...ancestors, node]);
  };
  roots(doc).forEach((r) => walk(r, []));
}

/** Every variable the inputs state: `{ id, name, web }`, by id. */
function knownVariables(docs, ds) {
  const known = new Map();
  const add = (id, name, web = null) => { if (id && name) known.set(id, { id, name, web: web ?? known.get(id)?.web ?? null }); };
  for (const c of ds?.collections ?? []) for (const v of c.variables ?? []) add(v.id, v.name, v.codeSyntax?.WEB?.value);
  for (const doc of docs) {
    for (const t of doc.variableTokens ?? []) add(t.id, t.name);
    eachNode(doc, (n) => { for (const b of Object.values(n.tokenBindings ?? {})) add(b.variableId, b.variableName); });
  }
  return known;
}

function resolveVariable(query, known, ds) {
  const all = [...known.values()];
  if (query.startsWith("--")) {
    if (!ds) fail(`bindings: ${query} is a CSS name; resolving it needs the Design System Handoff export (--ds-export), or give the variable name`);
    const hit = all.find((v) => v.web === query);
    if (!hit) fail(`bindings: ${query} is not a CSS name the export states (codeSyntax.WEB)`);
    return hit;
  }
  const hit = all.find((v) => v.name === query || v.id === query);
  if (!hit) fail(`bindings: ${query} is not a variable the input states`);
  return hit;
}

/**
 * @param {object[]} docs  layer exports (schema `design-handoff`)
 * @param {{ variables: string[], ds?: object }} opts  variable names, ids or `--css-names`; the DS export, optional
 * @returns {{ variables: object[], notes: string[] }}
 */
export function bindingMap(docs, { variables, ds = null }) {
  const notes = [];
  for (const doc of docs) {
    const version = Number(doc.schemaVersion);
    let named = 0;
    let bare = 0;
    eachNode(doc, (n) => { named += Object.keys(n.tokenBindings ?? {}).length; bare += aliasIds(n.variableBindings).length; });
    if (version < 12) notes.push(`${label(doc)}: schema ${version} predates tokenBindings (added at schema 12); no bindings can be read from it`);
    else if (named === 0 && bare === 0) notes.push(`${label(doc)}: schema ${version} but no tokenBindings or variableBindings on any node; nothing in this export binds a variable`);
    else if (named === 0) notes.push(`${label(doc)}: no tokenBindings; only bare variableBindings, so no property names`);
  }

  const known = knownVariables(docs, ds);
  const dsVars = new Map((ds?.collections ?? []).flatMap((c) => c.variables ?? []).map((v) => [v.id, v]));
  const out = variables.map((query) => {
    const v = resolveVariable(query, known, ds);
    const consumers = [];
    for (const doc of docs) {
      const shots = new Map((doc.screenshots?.exported ?? []).map((s) => [s.nodeId, s.name]));
      eachNode(doc, (node, ancestors) => {
        const chain = [...ancestors, node];
        const named = Object.entries(node.tokenBindings ?? {}).filter(([, b]) => b.variableId === v.id);
        const bare = aliasIds(node.variableBindings).filter((id) => id === v.id).length;
        const rows = named.map(([property, b]) => ({ property, source: b.source ?? "direct" }));
        for (let i = 0; i < bare - named.length; i += 1) rows.push({ property: null, source: "variableBindings" });
        if (!rows.length) return;
        const instance = [...chain].reverse().find((n) => n.type === "INSTANCE");
        const definition = instance ? null : [...chain].reverse().find((n) => n.type === "COMPONENT" || n.type === "COMPONENT_SET");
        const frame = chain.find((n) => shots.has(n.id)) ?? chain[0];
        for (const r of rows) {
          consumers.push({
            nodeId: node.id, nodeName: node.name, nodeType: node.type, property: r.property, source: r.source,
            component: instance ? instanceName(instance) : (definition?.name ?? null),
            instance: instance ? { nodeId: instance.id, name: instance.name } : null,
            path: chain.map((n) => n.name).join(" › "),
            frame: { nodeId: frame.id, name: frame.name, screenshot: shots.get(frame.id) ?? null, file: label(doc) },
          });
        }
      });
    }
    const u = dsVars.get(v.id)?.usage;
    const library = u ? {
      directBindingOccurrences: u.directBindingOccurrences,
      directBindingUniqueConsumerNodes: u.directBindingUniqueConsumerNodes,
      styleMediatedUniqueConsumerNodes: u.styleMediatedUniqueConsumerNodes,
      named: (u.topConsumers ?? []).length,
      note: `${(u.topConsumers ?? []).length} of ${u.directBindingUniqueConsumerNodes} consumer nodes are named by the library export (it stops at five, with no component or property); the rows above are what the layer export places`,
    } : null;
    return { name: v.name, id: v.id, web: v.web, consumers, library };
  });
  return { variables: out, notes };
}

export function renderBindingsMarkdown(map, { imageFor = () => null, exportNames = [] } = {}) {
  const lines = ["# Binding map", ""];
  if (exportNames.length) lines.push(`From ${exportNames.join(", ")}.`, "");
  for (const n of map.notes) lines.push(`- Note: ${n}`);
  if (map.notes.length) lines.push("");
  for (const v of map.variables) {
    lines.push(`## ${v.name}${v.web ? ` (\`${v.web}\`)` : ""}`, "");
    lines.push(`${v.consumers.length} ${v.consumers.length === 1 ? "consumer" : "consumers"} in the layer export.`, "");
    if (v.consumers.length) {
      lines.push("| Component | Instance | Node | Property | Frame |", "| --- | --- | --- | --- | --- |");
      for (const c of v.consumers) {
        const img = imageFor(c.frame);
        lines.push(`| ${c.component ?? "(none)"} | ${c.instance ? `${c.instance.name} \`${c.instance.nodeId}\`` : "—"} | ${c.path} \`${c.nodeId}\` | ${c.property ? `\`${c.property}\`` : "(alias, no property named)"} | ${img ?? `${c.frame.name} (no frame image in the input)`} |`);
      }
      lines.push("");
    }
    if (v.library) lines.push(`Library: ${v.library.directBindingOccurrences} direct bindings; ${v.library.note}.`, "");
  }
  return `${lines.join("\n")}\n`;
}
