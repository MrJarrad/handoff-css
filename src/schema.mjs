// The export contract: which schema this package understands, and the one
// piece of it every other module reads — the published WEB name (policy P1).
import { fail } from "./resolve.mjs";

/**
 * P1 — NAMES come from `codeSyntax.WEB.value`, verbatim, never re-derived. A
 * variable without one is a hard failure: the export's own naming policy
 * guarantees one for every variable, so its absence means a malformed export.
 */
export const webName = (v) => {
  const n = v.codeSyntax?.WEB?.value;
  if (!n) fail(`variable ${v.id} (${v.name}) has no codeSyntax.WEB.value`);
  return n;
};

/** id -> variable, across every collection. */
export function indexById(doc) {
  const byId = new Map();
  for (const c of doc.collections) for (const v of c.variables) byId.set(v.id, v);
  return byId;
}

/**
 * Refuse an export this package was not written against. A superseded schema
 * usually still parses, so accepting one silently would emit plausible-looking
 * CSS from fields that have since changed meaning.
 */
export function assertSchema(doc, cfg) {
  if (doc.schema !== cfg.schema.name) fail(`unexpected schema ${doc.schema}`);
  if (!cfg.schema.versions.includes(String(doc.schemaVersion))) {
    fail(`unsupported schemaVersion ${doc.schemaVersion}`);
  }
}
