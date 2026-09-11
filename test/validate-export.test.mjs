// P14 — the export contract. The generator's first soft joint: before 0.3.0 it
// trusted any JSON that said `schemaVersion: 8`, so a malformed export failed
// somewhere downstream, or silently dropped a token. Every test here is a
// mutation of the REAL v8b export: the shape is asserted against the document
// the plugin actually produces, not against a hand-written sample of it.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { validateExport, assertValidExport, exportSchema, VALIDATED_SCHEMA_VERSIONS } from "../src/validate-export.mjs";
import { consumerCss, doc as docV7b, docV8b, preset } from "./fixture.mjs";

/** Every error pointer, so a mutation can be asserted at its JSON pointer. */
const paths = (doc) => validateExport(doc).errors.map((e) => e.path);
const layoutVar = (doc, name) =>
  doc.collections.find((c) => c.name === "layout").variables.find((v) => v.name === name);

test("the real v8b export validates", () => {
  const res = validateExport(docV8b());
  assert.deepEqual(res.errors, []);
  assert.equal(res.ok, true);
  assert.equal(res.skipped, false);
});

test("a schema-7 export is skipped, not validated — and says so", () => {
  const v7 = docV7b();
  assert.equal(v7.schemaVersion, 7);
  const res = validateExport(v7);
  assert.equal(res.ok, true);
  assert.equal(res.skipped, true);
  assert.deepEqual(VALIDATED_SCHEMA_VERSIONS, [8]);
});

test("an unknown future schema version is skipped by this validator, not failed", () => {
  const doc = docV8b();
  doc.schemaVersion = 9;
  const res = validateExport(doc);
  assert.equal(res.skipped, true);
});

test("a deleted codeSyntax.WEB value fails at the variable's pointer", () => {
  const doc = docV8b();
  const v = layoutVar(doc, "device/screen-height/full");
  delete v.codeSyntax.WEB.value;
  const hit = validateExport(doc).errors.find((e) => e.path.endsWith("/codeSyntax/WEB"));
  assert.ok(hit, `expected an error at …/codeSyntax/WEB, got ${paths(doc).slice(0, 5).join(", ")}`);
  assert.match(hit.message, /required property 'value'/);
});

test("a WEB name that is not a custom property fails on the pattern", () => {
  const doc = docV8b();
  layoutVar(doc, "device/width").codeSyntax.WEB.value = "deviceWidth";
  const hit = validateExport(doc).errors.find((e) => e.path.endsWith("/codeSyntax/WEB/value"));
  assert.ok(hit);
  assert.equal(hit.keyword, "pattern");
});

test("an unknown key inside codeSyntax.WEB fails — WEB is closed", () => {
  const doc = docV8b();
  layoutVar(doc, "device/width").codeSyntax.WEB.valeu = "--device-width";
  const hit = validateExport(doc).errors.find((e) => e.keyword === "additionalProperties");
  assert.ok(hit, "a typo'd key inside WEB must not read as a default");
});

test("a string viewportFraction fails at the rule's pointer", () => {
  const doc = docV8b();
  const v = layoutVar(doc, "device/screen-height/full");
  const rule = v.responsiveBehavior.rules.find((r) => r.strategy.startsWith("viewport-"));
  rule.viewportFraction = "0.9";
  const hit = validateExport(doc).errors.find((e) => e.path.endsWith("/viewportFraction"));
  assert.ok(hit, `expected an error at …/viewportFraction, got ${paths(doc).slice(0, 5).join(", ")}`);
  assert.equal(hit.keyword, "type");
});

test("a viewport rule with no fraction at all fails — schema 8 states it", () => {
  const doc = docV8b();
  const v = layoutVar(doc, "device/screen-height/full");
  const rule = v.responsiveBehavior.rules.find((r) => r.strategy.startsWith("viewport-"));
  delete rule.viewportFraction;
  const hit = validateExport(doc).errors.find((e) => e.message.includes("viewportFraction"));
  assert.ok(hit);
});

test("a fluid-clamp rule with no css fails — the generator never composes one", () => {
  const doc = docV8b();
  const v = doc.collections
    .flatMap((c) => c.variables)
    .find((x) => (x.responsiveBehavior?.rules ?? []).some((r) => r.strategy === "fluid-clamp"));
  const rule = v.responsiveBehavior.rules.find((r) => r.strategy === "fluid-clamp");
  delete rule.css;
  assert.ok(validateExport(doc).errors.some((e) => e.message.includes("css")));
});

test("an unknown responsive strategy fails on the enum", () => {
  const doc = docV8b();
  const v = layoutVar(doc, "device/screen-height/full");
  v.responsiveBehavior.rules[0].strategy = "viewport-diagonal";
  const hit = validateExport(doc).errors.find((e) => e.keyword === "enum");
  assert.ok(hit);
  assert.match(hit.path, /\/responsiveBehavior\/rules\/0\/strategy$/);
});

test("a missing designSystemStateHash fails at /fingerprint", () => {
  const doc = docV8b();
  delete doc.fingerprint.designSystemStateHash;
  assert.ok(paths(doc).includes("/fingerprint"));
});

test("a truncated contentHash fails at /contentHash", () => {
  const doc = docV8b();
  doc.contentHash = "deadbeef";
  const hit = validateExport(doc).errors.find((e) => e.path === "/contentHash");
  assert.ok(hit);
  assert.equal(hit.keyword, "pattern");
});

test("an empty breakpoints.entries fails at /breakpoints/entries", () => {
  const doc = docV8b();
  doc.breakpoints.entries = [];
  const hit = validateExport(doc).errors.find((e) => e.path === "/breakpoints/entries");
  assert.ok(hit);
  assert.equal(hit.keyword, "minItems");
});

test("a wrong `schema` string fails — a design-handoff markdown companion is not an export", () => {
  const doc = docV8b();
  doc.schema = "design-handoff";
  assert.ok(paths(doc).includes("/schema"));
});

test("generate() refuses a WEB-less export instead of emitting half a stylesheet", () => {
  const doc = docV8b();
  delete layoutVar(doc, "device/screen-height/full").codeSyntax.WEB;
  assert.throws(
    () => generate(doc, preset, { handAuthoredCss: consumerCss() }),
    /export does not match schema design-system-handoff 8/,
  );
});

test("generate() still runs a schema-7 export — validation is skipped, not failed", () => {
  assert.doesNotThrow(() => generate(docV7b(), preset, { handAuthoredCss: consumerCss() }));
});

test("assertValidExport names at most five pointers and counts the rest", () => {
  const doc = docV8b();
  for (const v of doc.collections.flatMap((c) => c.variables)) delete v.codeSyntax.WEB;
  try {
    assertValidExport(doc);
    assert.fail("expected a throw");
  } catch (err) {
    assert.equal(err.message.split("\n").filter((l) => l.startsWith("  ") && !l.includes("more")).length, 5);
    assert.match(err.message, /… and \d+ more/);
  }
});

test("the schema document is published as part of the package", () => {
  assert.equal(exportSchema.properties.schemaVersion.const, 8);
  assert.equal(exportSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
});
