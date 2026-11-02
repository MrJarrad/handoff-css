// One design system split across Figma files. Each file's
// Design System Handoff export lists only its own variables; a variable used
// from a library arrives as an alias whose id carries the library's key
// (`VariableID:<key>/<id>`) and whose chain hop names that key. Given every
// file's export, the set is joined BY VARIABLE KEY into one document the
// generator reads as it reads a single export — so a library alias becomes
// `var(--its-name)` instead of an inlined terminal value.
//
// Joining never guesses: the same key stated two different ways, two keys
// claiming one CSS name, or the same export given twice stops the run with the
// two files named. A key no given export holds is left as it was, and the
// generator reports it (terminal value inlined) exactly as for a single export.
import { fail } from "./resolve.mjs";

// The library key inside a remote variable id: `VariableID:<40 hex>/<local id>`.
const REMOTE = /^VariableID:([0-9a-f]{40})\//;

/** What a variable states, for comparing two copies of one key. */
const statement = (v) => JSON.stringify({ name: v.codeSyntax?.WEB?.value ?? null, type: v.type,
  modes: v.modes.map((m) => [m.modeName, m.alias?.terminalValue ?? m.raw ?? null]) });

/**
 * @param {object[]} docs  parsed Design System Handoff exports, one per Figma file
 * @returns {object} one export-shaped document holding every file's variables
 */
export function mergeExports(docs) {
  if (docs.length === 1) return docs[0];
  const label = (doc) => doc.artifactFilename ?? doc.documentName ?? "export";
  // #44 r1: an export is the same export when its content is (contentHash), whatever it is named.
  const identity = (doc) => doc.contentHash ?? JSON.stringify(doc);
  const seen = new Map();
  for (const doc of docs) {
    const held = seen.get(identity(doc));
    if (held) fail(`MERGE_SAME_EXPORT: ${label(doc)} is the same export as ${label(held)} (content ${String(doc.contentHash ?? "").slice(0, 12)}…) — give each file's export once`);
    seen.set(identity(doc), doc);
  }

  // Figma ids are unique only within a file: two files can both hold "VariableID:1:10". Give every
  // variable and collection an id from its key (unique across files) before anything is joined, and
  // point that file's own references at the new ids.
  docs = docs.map(globalIds);

  // Every variable by key; the first copy given owns the key (an export lists only its own file's
  // variables, so a later identical copy adds nothing and a differing one is refused below).
  const byKey = new Map();
  const byName = new Map();
  for (const doc of docs) {
    for (const c of doc.collections) {
      for (const v of c.variables) {
        const held = byKey.get(v.key);
        if (held) {
          if (statement(held.v) !== statement(v)) {
            fail(`MERGE_KEY_CONFLICT: variable key ${v.key} is ${held.v.name} in ${label(held.doc)} and ${v.name} in ${label(doc)}, stated differently — re-export both files from one state`);
          }
          continue;
        }
        const name = v.codeSyntax?.WEB?.value;
        const claimed = name && byName.get(name);
        if (claimed) {
          fail(`MERGE_NAME_COLLISION: ${name} is ${claimed.v.name} (key ${claimed.v.key}) in ${label(claimed.doc)} and ${v.name} (key ${v.key}) in ${label(doc)} — two variables cannot share one CSS name`);
        }
        byKey.set(v.key, { v, doc });
        if (name) byName.set(name, { v, doc });
      }
    }
  }

  // Point every library alias at the joined variable's own id.
  const local = (id) => { const key = REMOTE.exec(id ?? "")?.[1]; return key && byKey.get(key)?.v.id; };
  const relink = (value) => JSON.parse(JSON.stringify(value), (k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const hop = typeof v.variableId === "string" && (byKey.get(v.variableKey)?.v.id ?? local(v.variableId));
      if (hop && hop !== v.variableId) return { ...v, variableId: hop, remote: false };
      if (v.type === "VARIABLE_ALIAS" && local(v.id)) return { ...v, id: local(v.id) };
    }
    return v;
  });

  const owned = new Set([...byKey.values()].map(({ v }) => v));
  const collections = docs.flatMap((doc) => doc.collections
    .map((c) => ({ ...c, variables: c.variables.filter((v) => owned.has(v)) }))
    .filter((c) => c.variables.length > 0))
    .map(relink);

  const [first] = docs;
  const types = [...new Set(docs.flatMap((doc) => Object.keys(doc.styles ?? {})))];
  return {
    ...first,
    documentName: docs.map((doc) => doc.documentName ?? label(doc)).join(" + "),
    generatedAt: docs.map((doc) => doc.generatedAt).join(" + "),
    fingerprint: { ...first.fingerprint, designSystemStateHash: docs.map((doc) => doc.fingerprint?.designSystemStateHash).join(" + ") },
    collections,
    styles: Object.fromEntries(types.map((t) => [t, relink(docs.flatMap((doc) => doc.styles?.[t] ?? []))])),
    styleSummaries: docs.flatMap((doc) => doc.styleSummaries ?? []),
    cssCustomPropertySheets: relink(docs.flatMap((doc) => doc.cssCustomPropertySheets ?? [])),
    // A mode is one entry, whichever export lists it.
    breakpoints: { ...first.breakpoints, entries: [...new Map(docs.flatMap((doc) => doc.breakpoints?.entries ?? [])
      .map((e) => [`${e.collectionId ?? e.collectionName}|${e.modeId}`, e])).values()] },
  };
}

/** One export with every local variable and collection id replaced by one built from its key. */
function globalIds(doc) {
  const ids = new Map();
  for (const c of doc.collections) {
    if (c.key) ids.set(c.id, `VariableCollectionId:${c.key}`);
    for (const v of c.variables) if (v.key) ids.set(v.id, `VariableID:${v.key}`);
  }
  if (ids.size === 0) return doc;
  return JSON.parse(JSON.stringify(doc), (k, v) => (typeof v === "string" && ids.has(v) ? ids.get(v) : v));
}
