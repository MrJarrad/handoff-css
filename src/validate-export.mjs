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

/** The schema 12-and-up document — the base above plus the structures schema
 * 12 introduced and 13 keeps (style classes, type ramp v2, `fontWeightNumeric`,
 * `cssCustomPropertySheets`). Schema 13 changed the CONTENT of those classes
 * (effect and grid classes bind their variables, grid selectors carry a
 * `grid-` prefix), not their shape, so it validates against the same document.
 * Reachable as `handoff-css/schema/export/v12plus`. */
export const exportSchemaV12Plus = require("../schema/design-system-handoff.v12plus.schema.json");

/** The schema versions this module knows how to validate. A v7 export is
 * legacy: it parses, it generates, and it is NOT validated (schema 7 predates
 * `responsiveBehavior` and the WEB-name contract). Dropped in 0.4.0. Schema 9
 * is the same shape as 8 — designer-signal viewport gating and whole-percent
 * fraction snapping are semantic changes the export makes, not structural
 * ones this schema needs to distinguish. */
export const VALIDATED_SCHEMA_VERSIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/** Which schema document validates a given `schemaVersion` (0.5.0). 8-11 share
 * the base shape; 12 adds required structures the base must NOT demand of an
 * older export, so it gets its own document rather than a widened base. */
export const schemaFor = (schemaVersion) =>
  Number(schemaVersion) >= 12 ? exportSchemaV12Plus : exportSchema;

/**
 * P11 — a `fluid-clamp` rule's `css` is the export's OWN clamp expression, and
 * the generator emits it verbatim (never recomputed). But an export can state
 * a clamp whose numbers do not reproduce the very samples it was fit from —
 * the 2026-09-12 19:12 export's `vw` coefficient is `slopeRemPerPx × 100`
 * where it should be `× 1600` (rem-per-px to vw-per-100vw needs the 16px root
 * AND the /100 in the same step), so every sampled width evaluates 16× too
 * small. `FLUID_CLAMP_MISMATCH` catches this at the one place it is checkable
 * without recomputing anything: evaluate the export's own `css` at each
 * sample's own `widthPx` and compare to that sample's own `rawPx`.
 */
const CLAMP_RE = /^clamp\(\s*([-\d.]+)rem\s*,\s*([-\d.]+)vw\s*\+\s*([-\d.]+)rem\s*,\s*([-\d.]+)rem\s*\)$/;

/** rem tolerance the samples are held to (P11) — half the smallest step this
 * package's own float rounding could introduce, same tolerance the export's
 * own `fit.toleranceRem` publishes for `mode-stepped`/`fixed`. */
export const FLUID_CLAMP_TOLERANCE_REM = 0.125;
const ROOT_FONT_SIZE_PX = 16;

/** Evaluate a `clamp(<min>rem, <slope>vw + <intercept>rem, <max>rem)` string
 * at one viewport width in px, in px. Returns `null` when `css` is not that
 * shape — a clamp this checker cannot parse is not silently skipped: the
 * caller reports `FLUID_CLAMP_UNPARSEABLE` instead of comparing nothing. */
export function evalClampPx(css, widthPx) {
  const m = CLAMP_RE.exec(String(css ?? "").trim());
  if (!m) return null;
  const [, minRem, slopeVw, interceptRem, maxRem] = m.map(Number);
  const minPx = minRem * ROOT_FONT_SIZE_PX;
  const maxPx = maxRem * ROOT_FONT_SIZE_PX;
  const preferredPx = (slopeVw * widthPx) / 100 + interceptRem * ROOT_FONT_SIZE_PX;
  return Math.min(maxPx, Math.max(minPx, preferredPx));
}

/**
 * Every `fluid-clamp` rule's `css` checked against its own `samples`.
 *
 * @returns {{ code: string, variable: string, variant: string, detail: string }[]}
 *   One finding per (variable, layoutVariant) rule that misses at least one of
 * its own samples by more than `FLUID_CLAMP_TOLERANCE_REM` — not one per
 * sample, so a rule wrong at every width is still one line naming all of them.
 */
export function fluidClampFindings(doc) {
  const out = [];
  for (const c of doc.collections ?? []) {
    for (const v of c.variables ?? []) {
      const rules = v.responsiveBehavior?.rules ?? [];
      for (const r of rules) {
        if (r.strategy !== "fluid-clamp" || !r.css) continue;
        const variant = r.layoutVariant ?? "default";
        const samples = Array.isArray(r.samples) ? r.samples : [];
        const misses = [];
        for (const s of samples) {
          if (typeof s.widthPx !== "number" || typeof s.rawPx !== "number") continue;
          const evaluated = evalClampPx(r.css, s.widthPx);
          if (evaluated == null) {
            out.push({
              code: "FLUID_CLAMP_UNPARSEABLE",
              variable: v.name,
              variant,
              detail: `${v.name} (${variant}): css ${JSON.stringify(r.css)} is not a recognised clamp() expression`,
            });
            misses.length = 0;
            break;
          }
          if (Math.abs(evaluated - s.rawPx) > FLUID_CLAMP_TOLERANCE_REM * ROOT_FONT_SIZE_PX) {
            misses.push({ sample: s.modeName ?? s.family ?? String(s.widthPx), widthPx: s.widthPx, rawPx: s.rawPx, evaluated });
          }
        }
        if (misses.length > 0) {
          const detail = misses
            .map(
              (m) =>
                `sample ${m.sample} (${m.widthPx}px): css evaluates to ${(m.evaluated / ROOT_FONT_SIZE_PX).toFixed(6)}rem, sample is ${(m.rawPx / ROOT_FONT_SIZE_PX).toFixed(6)}rem`,
            )
            .join("; ");
          out.push({
            code: "FLUID_CLAMP_MISMATCH",
            variable: v.name,
            variant,
            detail: `${v.name} (${variant}): css ${JSON.stringify(r.css)} misses ${misses.length} of its own samples — ${detail}`,
          });
        }
      }
    }
  }
  return out;
}

const compiled = new Map(); // $id -> compiled validator
const validator = (schema) => {
  if (!compiled.has(schema.$id)) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    // The v12 document is the base `allOf` its own additions, so the base has
    // to be resolvable by `$id` before the v12 one compiles.
    if (schema !== exportSchema) ajv.addSchema(exportSchema);
    compiled.set(schema.$id, ajv.compile(schema));
  }
  return compiled.get(schema.$id);
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
    return { ok: false, skipped: false, errors: [{ path: "", message: "export is not an object", keyword: "type" }], warnings: [], clampFindings: [] };
  }
  if (typeof doc.schemaVersion === "number" && doc.schemaVersion < Math.min(...VALIDATED_SCHEMA_VERSIONS)) {
    return { ok: true, skipped: true, errors: [], warnings: [], clampFindings: [] };
  }
  const validate = validator(schemaFor(doc.schemaVersion));
  const ok = validate(doc);
  const findings = Array.isArray(doc.validation?.findings) ? doc.validation.findings : [];
  // P11 — a shape-valid export can still state a `fluid-clamp` rule whose
  // `css` does not reproduce its own samples. Reported separately from the
  // SHAPE errors above (which gate `assertValidExport`/`generate` — P14):
  // this is a semantic defect the export makes about ITS OWN numbers, and
  // `generate` still emits the export's `css` verbatim (P11 never
  // recomputes it) while `validate`/`--check` refuse to pass it quietly.
  const clampFindings = fluidClampFindings(doc);
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
    clampFindings,
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
