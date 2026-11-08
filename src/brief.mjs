// P17/0.4.1 — the Design Handoff plugin (export v14+, schema `design-handoff`
// v10) now emits a JSON companion for the layer-brief markdown itself, in
// addition to the `design-system-handoff` JSON the tokens come from. THIS
// JSON is the machine contract for the brief: its shape is checked against
// `schema/design-handoff.v10.schema.json`, and its identity fields are the
// ones the markdown front matter must reconcile against — never the reverse.
//
// The markdown stays the human-readable rendering of the same brief. Once a
// JSON companion is present, the markdown side of `validate` drops to a light
// structural pass (front matter present, legend present, identity matches the
// JSON) rather than the full v6/v9 line grammar — that grammar stays exactly
// as it is for a lone `.md` (no companion given), and is not extended here.
import { createRequire } from "node:module";

import Ajv2020 from "ajv/dist/2020.js";

import { parseFrontMatter } from "./front-matter.mjs";
import { parseHandoffMarkdown, policyMismatches } from "./validate-handoff-md.mjs";

const require = createRequire(import.meta.url);

/** The published v10 schema for the brief JSON, also reachable as `handoff-css/schema/brief`. */
export const briefSchema = require("../schema/design-handoff.v10.schema.json");

/**
 * 0.4.3 — schema v11 (export v15+) makes alignment explicit: `gridPlacement`
 * carries `justifySelf`/`alignSelf`, `layout` carries CSS-resolved
 * `alignItems`/`justifyContent`. v10 stays accepted for older exports;
 * dispatch is by the document's own `schemaVersion`, never a flag.
 */
export const briefSchemaV11 = require("../schema/design-handoff.v11.schema.json");

/**
 * 0.8.0 — schema v12 (export v16+) is additive over v11: every layer node may
 * carry per-node token/variable-binding provenance (`tokenBindings`,
 * `variableBindings`, `styleBindings`), spacer/variant metadata
 * (`componentPropertyDefinitions`, `variantStates`, `siblingIndex`), semantic
 * inference detail (`semanticSource`, `semanticRejected`), and cosmetic node
 * state (`opacity`, `rotation`, `description`, `descriptionHints`); the
 * document itself may carry `schemaNote` and `validation.findings`. v10/v11
 * stay accepted for older exports; dispatch is by the document's own
 * `schemaVersion`, never a flag.
 */
export const briefSchemaV12 = require("../schema/design-handoff.v12.schema.json");

/**
 * 0.8.2 — schema v13 (export v17+) is additive over v12: `dimensions` may
 * carry minWidth/minWidthToken/maxWidth/maxWidthToken/minHeight/
 * minHeightToken/maxHeight/maxHeightToken — variable bindings for
 * auto-layout min/max size constraints, matching the existing
 * padding/gap binding pattern. v10/v11/v12 stay accepted for older
 * exports; dispatch is by the document's own `schemaVersion`, never a flag.
 */
export const briefSchemaV13 = require("../schema/design-handoff.v13.schema.json");

/**
 * 0.11.0 — schema v14 is additive over v13, written only when the selection
 * holds a spec or a code layer: `specs[]` (markdown null when Figma gives the
 * exporter no spec text) and `builtReference[]`. v13 also gained the fields
 * the plugin already wrote at v13 (`screenshots`, `spacer`, nullable
 * annotation fields) and the link-run script's `linkRun`.
 */
export const briefSchemaV14 = require("../schema/design-handoff.v14.schema.json");

/**
 * 0.13.0 — schema v15 is additive over v14, written only when the selection
 * holds an image or video fill: `media[]`, the media list.
 */
export const briefSchemaV15 = require("../schema/design-handoff.v15.schema.json");

/**
 * 0.15.0 — schema v16 is additive over v15, written only when a layer in the selection has a
 * Dev Mode measurement: `layerTree[].measurements[]`, the measurements that start from that layer.
 */
export const briefSchemaV16 = require("../schema/design-handoff.v16.schema.json");

/**
 * 0.17.0 — schema v17 is additive over v16, written whenever the selection holds a component or
 * component set with properties: `componentProperties[]`, every property the Figma properties panel
 * shows (own, then each exposed nested instance's), and `component.exposed` / `exposedInstances` on
 * each instance. `validateBriefJson` also requires a row for every such property (PROPERTY_ROW_MISSING)
 * and refuses a row with no property behind it (PROPERTY_ROW_DANGLING).
 */
export const briefSchemaV17 = require("../schema/design-handoff.v17.schema.json");

const schemasByVersion = new Map([
  [10, briefSchema],
  [11, briefSchemaV11],
  [12, briefSchemaV12],
  [13, briefSchemaV13],
  [14, briefSchemaV14],
  [15, briefSchemaV15],
  [16, briefSchemaV16],
  [17, briefSchemaV17],
]);

const compiledByVersion = new Map();
const validatorFor = (schemaVersion) => {
  const schema = schemasByVersion.get(schemaVersion) ?? briefSchema;
  if (!compiledByVersion.has(schema)) {
    compiledByVersion.set(schema, new Ajv2020({ allErrors: true, strict: false }).compile(schema));
  }
  return compiledByVersion.get(schema);
};

/** Every design-handoff schema version this checker validates in full. */
export const BRIEF_SCHEMA_VERSIONS = [...schemasByVersion.keys()];
const NEWEST = Math.max(...BRIEF_SCHEMA_VERSIONS);

/** The only shape errors a newer-than-checker version can excuse: a field this checker has never seen. */
export const UNKNOWN_FIELD_KEYWORDS = new Set(["additionalProperties", "unevaluatedProperties"]);

const cleanKey = (key) => key.replace(/#\d+:\d+$/, "");

/**
 * The panel, rebuilt from the layer tree: a component set (or a component with definitions) lists its
 * own properties; the first variant's chain of exposed instances lists theirs. An instance that is not
 * exposed is not in the panel, so nothing inside it is expected. Each of these needs a row.
 */
function expectedPropertyRows(layerTree) {
  const expected = [];
  const exposedInside = (node, owner) => {
    for (const child of node.children ?? []) {
      if (child.component) {
        if (!child.component.exposed) continue;
        for (const key of Object.keys(child.component.props ?? {})) expected.push({ nodeId: child.id, property: cleanKey(key), where: `${owner} › ${child.name}` });
        exposedInside(child, owner);
      } else exposedInside(child, owner);
    }
  };
  const walk = (node) => {
    if (node.type === "COMPONENT_SET" || (node.type === "COMPONENT" && node.componentPropertyDefinitions)) {
      for (const key of Object.keys(node.componentPropertyDefinitions ?? {})) expected.push({ nodeId: node.id, property: cleanKey(key), where: node.name });
      const holder = node.type === "COMPONENT_SET" ? (node.children ?? [])[0] : node;
      if (holder) exposedInside(holder, node.name);
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  (layerTree ?? []).forEach(walk);
  return expected;
}

/** Schema 17 and later: the property table matches the tree, both ways. */
function checkComponentProperties(doc) {
  const errors = [];
  const rows = doc.componentProperties ?? [];
  const byId = new Map();
  (function index(node) { byId.set(node.id, node); (node.children ?? []).forEach(index); })({ id: "", children: doc.layerTree ?? [] });
  const have = new Set(rows.map((row) => `${row.nodeId}\u0000${row.property}`));
  for (const want of expectedPropertyRows(doc.layerTree)) {
    if (!have.has(`${want.nodeId}\u0000${want.property}`)) {
      errors.push({ code: "PROPERTY_ROW_MISSING", keyword: "componentProperties", path: "/componentProperties", message: `${want.where} \`${want.property}\` (node ${want.nodeId}) is a property the Figma panel shows and has no row in componentProperties[]` });
    }
  }
  rows.forEach((row, index) => {
    const node = byId.get(row.nodeId);
    const keys = !node ? null : row.source === "own" ? Object.keys(node.componentPropertyDefinitions ?? {}) : Object.keys(node.component?.props ?? {});
    if (!keys || !keys.map(cleanKey).includes(row.property)) {
      errors.push({ code: "PROPERTY_ROW_DANGLING", keyword: "componentProperties", path: `/componentProperties/${index}`, message: !node ? `row ${row.key}: node ${row.nodeId} is not in the layer tree` : `row ${row.key}: node ${row.nodeId} has no property \`${row.property}\`` });
    }
  });
  return errors;
}

/**
 * Validate a parsed brief JSON document against its published shape. Dispatches
 * on the document's own `schemaVersion` (10–17); an unrecognised older version
 * falls back to v10 so it still surfaces as a clear `schemaVersion` const
 * mismatch rather than a thrown error.
 *
 * A version NEWER than this package knows is the plugin moving ahead of
 * its checker, not a broken export: it is checked against the newest schema
 * known, and passes with `SCHEMA_NEWER_THAN_CHECKER` warnings naming each
 * unknown field; a missing required field or a wrong type is still an error.
 *
 * @param {object} doc
 * @returns {{ ok: boolean, errors: {path: string, message: string, keyword: string}[], warnings: {code: string, path: string, message: string}[] }}
 */
export function validateBriefJson(doc) {
  if (doc == null || typeof doc !== "object") {
    return { ok: false, errors: [{ path: "", message: "brief is not an object", keyword: "type" }], warnings: [] };
  }
  const newer = typeof doc.schemaVersion === "number" && doc.schemaVersion > NEWEST;
  const validate = validatorFor(newer ? NEWEST : doc.schemaVersion);
  const ok = validate(newer ? { ...doc, schemaVersion: NEWEST } : doc);
  const errors = ok ? [] : validate.errors.map((e) => ({
    path: e.instancePath || "/",
    message: e.params?.additionalProperty ? `${e.message}: \`${e.params.additionalProperty}\`` : e.message,
    keyword: e.keyword,
  }));
  // A version newer than this checker is judged on shape only (its tables may mean more than v17's).
  if (!newer && typeof doc.schemaVersion === "number" && doc.schemaVersion >= 17 && Array.isArray(doc.layerTree)) {
    errors.push(...checkComponentProperties(doc));
  }
  if (!newer) return { ok: ok && errors.length === 0, errors, warnings: [] };
  const hard = errors.filter((e) => !UNKNOWN_FIELD_KEYWORDS.has(e.keyword));
  return {
    ok: hard.length === 0,
    errors: hard,
    warnings: [
      { code: "SCHEMA_NEWER_THAN_CHECKER", path: "/schemaVersion", message: `design-handoff v${doc.schemaVersion} is newer than this handoff-css knows (v${NEWEST}); checked against v${NEWEST} — update handoff-css to check it in full` },
      ...errors.filter((e) => UNKNOWN_FIELD_KEYWORDS.has(e.keyword)).map((e) => ({ code: "SCHEMA_NEWER_THAN_CHECKER", path: e.path, message: `not in v${NEWEST}: ${e.message} (${e.keyword})` })),
    ],
  };
}

const CONTENT_HASH = /^\*\*Content hash:\*\* `([^`]*)`/m;
const LEGEND = /^\*\*Legend:\*\*/m;

/**
 * The light structural pass a markdown brief gets once its JSON companion is
 * the contract: front matter present, the legend line present, and the
 * identity fields reconciled against the JSON — never the full node-table
 * grammar (that stays with `validateHandoffMarkdown` for a lone `.md`).
 *
 * @param {object} doc     the parsed brief JSON
 * @param {string} mdText  the markdown brief's raw text
 * @returns {{ ok: boolean, findings: {code: string, severity: "error"|"warning", message: string}[] }}
 */
export function validateBriefPair(doc, mdText) {
  const findings = [];
  const add = (code, severity, message) => findings.push({ code, severity, message });

  const { frontMatter: fm, body } = parseFrontMatter(mdText);
  if (fm == null) {
    add("MD_FRONT_MATTER_MISSING", "error", "the markdown carries no `---` front-matter block");
    return { ok: false, findings };
  }
  if (!LEGEND.test(body)) {
    add("MD_LEGEND_MISSING", "error", "no `**Legend:**` line in the markdown body");
  }

  const bodyHash = CONTENT_HASH.exec(body);
  const check = (label, jsonValue, mdValue) => {
    if (jsonValue !== mdValue) {
      add("PAIR_IDENTITY_MISMATCH", "error",
        `${label}: JSON has \`${jsonValue}\`, markdown has \`${mdValue}\``);
    }
  };

  check("schema", doc.schema, fm.schema);
  check("schemaVersion", doc.schemaVersion, fm.schemaVersion);
  check("contract", doc.contract, fm.contract);
  check("exportVersion", doc.exportVersion, fm.exportVersion);
  check("contentHash", doc.contentHash, bodyHash?.[1] ?? null);
  check("designSystemStateHash", doc.designSystemStateHash, fm.fingerprint?.designSystemStateHash);
  check("companion.schemaVersion", doc.companion?.schemaVersion, fm.companion?.schemaVersion);
  check("companion.contentHash", doc.companion?.contentHash, fm.companion?.contentHash);
  check("companion.designSystemStateHash", doc.companion?.designSystemStateHash, fm.companion?.designSystemStateHash);
  for (const f of policyMismatches(parseHandoffMarkdown(mdText))) add(f.code, f.severity, f.message);

  return { ok: findings.every((f) => f.severity !== "error"), findings };
}
