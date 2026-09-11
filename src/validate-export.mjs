// P14 — EXPORT VALIDATION. The generator used to trust any JSON that named
// schema 8: a missing `codeSyntax.WEB` or a string `viewportFraction` surfaced
// as a confusing crash three modules later, or worse, as a silently skipped
// token. This module is the contract check that runs before any CSS is emitted.
//
// It validates SHAPE only. What a value MEANS is still the export's business —
// a wrong fraction is a design-file defect the report names (P11/P13), never a
// schema error. See docs/POLICIES.md P14.
import { createRequire } from "node:module";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const require = createRequire(import.meta.url);

/** The published schema document, also reachable as `handoff-css/schema/export`. */
export const exportSchema = require("../schema/design-system-handoff.schema.json");

/** The schema versions this module knows how to validate. A v7 export is
 * legacy: it parses, it generates, and it is NOT validated (schema 7 predates
 * `responsiveBehavior` and the WEB-name contract). Dropped in 0.4.0. Schema 9
 * is the same shape as 8 — designer-signal viewport gating and whole-percent
 * fraction snapping are semantic changes the export makes, not structural
 * ones this schema needs to distinguish. */
export const VALIDATED_SCHEMA_VERSIONS = [8, 9];

let compiled = null;
const validator = () => {
  if (compiled == null) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    compiled = ajv.compile(exportSchema);
  }
  return compiled;
};

/**
 * Validate a parsed export document.
 *
 * @param {object} doc
 * @returns {{ ok: boolean, skipped: boolean, errors: {path: string, message: string, keyword: string}[],
 *             warnings: {code: string, variable?: string, detail?: string}[] }}
 *   `skipped` is true only for a schema version OLDER than every version this
 *   module validates (legacy, e.g. 7) — an unvalidated document is never
 *   reported as a valid one. A version NEWER than the newest one known (e.g.
 *   a future 10) is not skipped: it is run through the schema, whose
 *   `schemaVersion` enum fails it at `/schemaVersion` — "unrecognized" must
 *   never read as "passed."
 *
 *   `warnings` surfaces the plugin's OWN `validation.findings` (schema 9+) as
 *   `PLUGIN_FINDING` — the export self-reporting something the generator did
 *   not itself detect. An empty array (the common case) means the plugin
 *   found nothing to say.
 */
export function validateExport(doc) {
  if (doc == null || typeof doc !== "object") {
    return { ok: false, skipped: false, errors: [{ path: "", message: "export is not an object", keyword: "type" }], warnings: [] };
  }
  if (typeof doc.schemaVersion === "number" && doc.schemaVersion < Math.min(...VALIDATED_SCHEMA_VERSIONS)) {
    return { ok: true, skipped: true, errors: [], warnings: [] };
  }
  const validate = validator();
  const ok = validate(doc);
  const findings = Array.isArray(doc.validation?.findings) ? doc.validation.findings : [];
  return {
    ok,
    skipped: false,
    errors: ok
      ? []
      : (validate.errors ?? []).map((e) => ({
          // Ajv's `instancePath` IS a JSON pointer, which is what a defect
          // report against a 5 MB export needs to be addressable at all.
          path: e.instancePath || "/",
          message: e.message ?? "invalid",
          keyword: e.keyword,
        })),
    warnings: findings.map((f) => ({ code: "PLUGIN_FINDING", variable: f.variable, detail: f.detail ?? f.code })),
  };
}

/** `validateExport`, as a throw. The message names at most the first five
 * pointers: an export that is wrong is usually wrong the same way 500 times. */
export function assertValidExport(doc) {
  const { ok, errors } = validateExport(doc);
  if (ok) return;
  const shown = errors.slice(0, 5).map((e) => `  ${e.path} ${e.message}`);
  const more = errors.length > shown.length ? `\n  … and ${errors.length - shown.length} more` : "";
  throw new Error(`export does not match schema design-system-handoff ${doc.schemaVersion}:\n${shown.join("\n")}${more}`);
}
