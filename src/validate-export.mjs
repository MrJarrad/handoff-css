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
export const exportSchema = require("../schema/design-system-handoff.v8.schema.json");

/** The schema versions this module knows how to validate. A v7 export is
 * legacy: it parses, it generates, and it is NOT validated (schema 7 predates
 * `responsiveBehavior` and the WEB-name contract). Dropped in 0.4.0. */
export const VALIDATED_SCHEMA_VERSIONS = [8];

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
 * @returns {{ ok: boolean, skipped: boolean, errors: {path: string, message: string, keyword: string}[] }}
 *   `skipped` is true for a schema version outside `VALIDATED_SCHEMA_VERSIONS`
 *   — an unvalidated document is never reported as a valid one.
 */
export function validateExport(doc) {
  if (doc == null || typeof doc !== "object") {
    return { ok: false, skipped: false, errors: [{ path: "", message: "export is not an object", keyword: "type" }] };
  }
  if (!VALIDATED_SCHEMA_VERSIONS.includes(doc.schemaVersion)) {
    return { ok: true, skipped: true, errors: [] };
  }
  const validate = validator();
  const ok = validate(doc);
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
  };
}

/** `validateExport`, as a throw. The message names at most the first five
 * pointers: an export that is wrong is usually wrong the same way 500 times. */
export function assertValidExport(doc) {
  const { ok, errors } = validateExport(doc);
  if (ok) return;
  const shown = errors.slice(0, 5).map((e) => `  ${e.path} ${e.message}`);
  const more = errors.length > shown.length ? `\n  … and ${errors.length - shown.length} more` : "";
  throw new Error(`export does not match schema design-system-handoff 8:\n${shown.join("\n")}${more}`);
}
