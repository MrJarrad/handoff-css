// Schema 17 — `policies.units` v5 -> v6. Letter-spacing and line-height
// variables now resolve their font-size divisor from sibling variables, so
// every `letter-spacing/*` and `line-height/*` cell arrives RESOLVED with its
// own `build.css` in `em` / unitless instead of `status: "unresolved"`.
//
// The generator's job is to emit that `css` VERBATIM (P4) and to stop counting
// those cells as UNCONVERTED — without loosening P13, which is what keeps an
// export that genuinely cannot resolve a divisor from being handed an invented
// one. The schema-16 export of the same design system is pinned here as the
// before-half of that pair: same variables, still unresolved, still raw px.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { assertSchema } from "../src/schema.mjs";
import { validateExport, VALIDATED_SCHEMA_VERSIONS } from "../src/validate-export.mjs";
import { consumerConfig042, consumerCssV13, docV16, docV17, preset } from "./fixture.mjs";

const doc = docV17();
const TYPOGRAPHY = /^(letter-spacing|line-height)\//;

/** Every FLOAT mode cell of a `letter-spacing/*` or `line-height/*` variable. */
const typographyCells = (d) => {
  const out = [];
  for (const c of d.collections) {
    for (const v of c.variables) {
      if (v.type !== "FLOAT" || !TYPOGRAPHY.test(v.name)) continue;
      for (const m of v.modes) {
        if (m.alias) continue;
        out.push({ collection: c.name, variable: v, mode: m, web: v.codeSyntax.WEB.value });
      }
    }
  }
  return out;
};

test("the fixture is the 2026-09-13 17:08 export at schema 17, units policy v6", () => {
  assert.equal(doc.schema, "design-system-handoff");
  assert.equal(doc.schemaVersion, 17);
  assert.equal(doc.policies.units.version, "6");
  assert.equal(doc.generatedAt, "2026-09-13T17:08:05.918Z");
});

test("schema 17's one stated delta is the units policy bump — the export says so itself", () => {
  assert.deepEqual(doc.changes.policyChanges, [{ field: "units", before: "5", after: "6" }]);
  assert.equal(doc.changes.summary.policyChanged, 1);
});

test("units v6 adds exactly one rule to v5 — the sibling font-size divisor", () => {
  const v5 = docV16().policies.units.rules;
  const v6 = doc.policies.units.rules;
  const added = v6.filter((r) => !v5.includes(r));
  assert.deepEqual(v5.filter((r) => !v6.includes(r)), [], "no v5 rule was dropped");
  assert.equal(added.length, 1);
  assert.match(added[0], /^Letter-spacing and line-height variables resolve their associated font-size divisor from sibling variables/);
});

test("schema 17 validates", () => {
  const res = validateExport(doc);
  assert.equal(res.ok, true, JSON.stringify(res.errors ?? []).slice(0, 800));
  assert.ok(VALIDATED_SCHEMA_VERSIONS.includes(17));
});

test("an unknown schemaVersion is still refused — widening is 17, not `any`", () => {
  const res = validateExport({ ...doc, schemaVersion: 18 });
  assert.equal(res.ok, false);
});

test("the house preset accepts schema 17, so the DS consumer can drop its override", () => {
  assert.ok(preset.schema.versions.includes("17"));
  assert.doesNotThrow(() => assertSchema(doc, preset));
  assert.throws(() => assertSchema({ ...doc, schemaVersion: 18 }, preset), /unsupported schemaVersion 18/);
});

test("every letter-spacing/line-height cell in the schema-17 export is resolved with a css in em or unitless", () => {
  const cells = typographyCells(doc);
  assert.ok(cells.length > 0);
  const bad = cells
    .filter((c) => c.mode.build?.status !== "resolved" || typeof c.mode.build?.css !== "string")
    .map((c) => `${c.web}/${c.mode.modeName}`);
  assert.deepEqual(bad, []);
  const wrongUnit = cells
    .filter((c) => !["em", "unitless"].includes(c.mode.build.unit))
    .map((c) => `${c.web}/${c.mode.modeName}=${c.mode.build.unit}`);
  assert.deepEqual(wrongUnit, []);
});

const out = generate(doc, consumerConfig042, { handAuthoredCss: consumerCssV13() });

test("the generator emits each typography token's `build.css` verbatim — never px", () => {
  const emitted = new Map();
  for (const line of out.tokensCss.split("\n")) {
    const m = /^\s*(--[a-z0-9-]+):\s*(.+?);/.exec(line);
    if (m && !emitted.has(m[1])) emitted.set(m[1], m[2]);
  }
  const mismatches = [];
  let checked = 0;
  for (const c of typographyCells(doc)) {
    const value = emitted.get(c.web);
    if (value === undefined) continue; // hand-authored, excluded or hidden — P2/P7
    checked += 1;
    if (value !== c.mode.build.css) mismatches.push(`${c.web}: emitted ${value}, export states ${c.mode.build.css}`);
  }
  assert.deepEqual(mismatches, []);
  // Not a vacuous pass: the sheet carries all 57 typography tokens (19
  // letter-spacing + 38 line-height), where schema 16 emitted 19 as raw px.
  assert.equal(checked, 57);
  assert.equal(out.rows.filter((r) => /^--(letter-spacing|line-height)-/.test(r.name)).length, 57);
  assert.ok(!/--(letter-spacing|line-height)[a-z0-9-]*:\s*-?[\d.]+px;/.test(out.tokensCss), "no typography token emits px");
});

test("the four values the ruling names are in the sheet exactly as the export writes them", () => {
  for (const [name, value] of [
    ["--letter-spacing-050", "0em"],
    ["--letter-spacing-350", "-0.01em"],
    ["--line-height-title-050", "1.15"],
    ["--line-height-body-050", "1.45"],
  ]) {
    assert.match(out.tokensCss, new RegExp(`${name}:\\s*${value.replace(/[.\\+*?[^\]$(){}=!<>|:#-]/g, "\\$&")};`), name);
  }
});

test("no letter-spacing or line-height token is UNCONVERTED under schema 17", () => {
  const rows = out.rows.filter((r) => r.unconverted && /letter-spacing|line-height/.test(r.name));
  assert.deepEqual(rows.map((r) => r.name), []);
});

test("P13 is kept, not loosened — the schema-16 export of the same system still reports these cells raw and UNCONVERTED", () => {
  const before = typographyCells(docV16()).filter((c) => c.mode.build?.status === "unresolved");
  assert.ok(before.length > 0, "the before-half of the pair must actually be unresolved");
  const v16out = generate(docV16(), consumerConfig042, { handAuthoredCss: consumerCssV13() });
  const unconverted = v16out.rows.filter((r) => r.unconverted && /letter-spacing|line-height/.test(r.name));
  assert.ok(unconverted.length > 0);
  for (const r of unconverted) assert.match(r.generated, /px$|^-?[\d.]+$/);
});

test("no cell-trust finding on the schema-17 typography cells — the export agrees with itself", () => {
  const untrusted = out.untrustedRows.filter((r) => /letter-spacing|line-height/.test(r.name));
  assert.deepEqual(untrusted, []);
});

test("a second generate() over the schema-17 export is byte-identical (deterministic)", () => {
  const again = generate(doc, consumerConfig042, { handAuthoredCss: consumerCssV13() });
  for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
    assert.equal(again[field], out[field]);
  }
});
