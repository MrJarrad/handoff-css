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

const require = createRequire(import.meta.url);

/** The published schema for the brief JSON, also reachable as `handoff-css/schema/brief`. */
export const briefSchema = require("../schema/design-handoff.v10.schema.json");

let compiled = null;
const validator = () => {
  if (compiled == null) {
    compiled = new Ajv2020({ allErrors: true, strict: false }).compile(briefSchema);
  }
  return compiled;
};

/**
 * Validate a parsed brief JSON document against its published shape.
 *
 * @param {object} doc
 * @returns {{ ok: boolean, errors: {path: string, message: string, keyword: string}[] }}
 */
export function validateBriefJson(doc) {
  if (doc == null || typeof doc !== "object") {
    return { ok: false, errors: [{ path: "", message: "brief is not an object", keyword: "type" }] };
  }
  const validate = validator();
  const ok = validate(doc);
  return {
    ok,
    errors: ok ? [] : validate.errors.map((e) => ({ path: e.instancePath || "/", message: e.message, keyword: e.keyword })),
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

  return { ok: findings.every((f) => f.severity !== "error"), findings };
}
