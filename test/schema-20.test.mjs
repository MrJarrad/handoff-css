// Design System Handoff schema 20 (HT-126): components[] — every component and component set the file
// defines, once each — and counts.components. Built from the schema-19 fixture so every other field
// is real; the components are the test's own list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { validateExport, VALIDATED_SCHEMA_VERSIONS } from "../src/validate-export.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "jhd-v19-2026-10-29");
const base = () => JSON.parse(gunzipSync(readFileSync(path.join(dir, "design-system-handoff.json.gz"))).toString("utf8"));
const v20 = () => {
  const doc = base();
  doc.schemaVersion = 20;
  doc.components = [
    { id: "10:1", name: "Button", kind: "set", page: "Components", properties: [{ name: "Size", type: "VARIANT", defaultValue: "M", options: ["S", "M", "L"] }, { name: "Label", type: "TEXT", defaultValue: "Go", options: [] }] },
    { id: "12:1", name: "Icon/Arrow", kind: "component", page: "Components", properties: [] },
  ];
  doc.counts = { ...doc.counts, components: doc.components.length };
  return doc;
};

test("a schema 20 export with components[] validates with no warning", () => {
  const res = validateExport(v20());
  assert.deepEqual(res.errors, []);
  assert.equal(res.ok, true);
  assert.equal(res.warnings.some((w) => w.code === "SCHEMA_NEWER_THAN_CHECKER"), false);
  assert.ok(VALIDATED_SCHEMA_VERSIONS.includes(20));
});

test("components[] is typed: a missing id, a kind that is neither set nor component, or a property without a type is a schema error", () => {
  const cases = [
    ["component without an id", (d) => { delete d.components[0].id; }],
    ["kind outside set/component", (d) => { d.components[0].kind = "variant"; }],
    ["property without a type", (d) => { delete d.components[0].properties[0].type; }],
    ["a field the schema does not name", (d) => { d.components[0].variants = []; }],
  ];
  for (const [name, mutate] of cases) {
    const doc = v20();
    mutate(doc);
    assert.equal(validateExport(doc).ok, false, name);
  }
});

test("components[] on an export that declares a version before 20 is refused: a field added without a bump fails", () => {
  const doc = v20();
  doc.schemaVersion = 19;
  assert.equal(validateExport(doc).ok, false);
});

test("a schema 21 export passes only with a warning naming it", () => {
  const doc = v20();
  doc.schemaVersion = 21;
  const res = validateExport(doc);
  assert.equal(res.ok, true);
  assert.equal(res.warnings[0].code, "SCHEMA_NEWER_THAN_CHECKER");
});

test("the house preset accepts schema 20, so tokens regenerate from the current export", async () => {
  const { default: preset } = await import("../presets/jhd.config.mjs");
  const { assertSchema } = await import("../src/schema.mjs");
  assert.doesNotThrow(() => assertSchema(v20(), preset));
});
