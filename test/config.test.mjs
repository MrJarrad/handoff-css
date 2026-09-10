// `schema/config.schema.json` is the declarative statement of what a config
// may contain, and the document a consumer reads to write one. If it drifts
// from what the code needs, the schema stops being usable as documentation —
// so the shipped preset is validated against it, and the validator is
// red-tested on each class of mistake a consumer actually makes.
import { test } from "node:test";
import assert from "node:assert/strict";

import { configSchema, generate, validateConfig } from "../src/index.mjs";
import jhd from "../presets/jhd.config.mjs";

/** A structural clone, so a mutation in one test cannot leak into another. */
const clone = () => structuredClone(jhd);

test("the shipped jhd preset validates against schema/config.schema.json", () => {
  assert.deepEqual(validateConfig(jhd), []);
});

test("every key the plan locked is present in the preset", () => {
  // Enumerated from the plan's config-key table so a lifted-but-unwired key
  // (or a key silently renamed) fails here rather than at some consumer.
  for (const dotted of [
    "schema.name", "schema.versions",
    "paths.input", "paths.out", "paths.theme", "paths.report",
    "paths.handAuthored", "paths.exclusions",
    "exclude.paths",
    "color.format",
    "layout.collection", "layout.variantAttribute", "layout.baseMode",
    "modes.collectionModeAttribute",
    "themes.collection", "themes.total",
    "tailwind.namespaces", "tailwind.held", "tailwind.rootFontSizePx",
    "viewport.heightUnit", "viewport.widthUnit", "viewport.descriptionFallback",
    "viewport.groups",
    "aliases",
    "report.title", "report.policyRef", "report.parity", "report.colourCollections",
    "report.notes", "report.notes.breakpointNote",
    "header.regenerateCommand",
  ]) {
    const value = dotted.split(".").reduce((o, k) => (o == null ? o : o[k]), jhd);
    assert.notEqual(value, undefined, `${dotted} is missing from presets/jhd.config.mjs`);
  }
});

test("the schema uses only keywords the validator implements", () => {
  // The validator is a deliberate subset walk, not a JSON Schema engine. A
  // keyword it does not understand would silently validate nothing, so the
  // walk reports it as an error against the schema itself.
  const errors = validateConfig(jhd, configSchema());
  assert.deepEqual(errors.filter((e) => e.includes("not supported by this validator")), []);
});

test("an unknown key is rejected, not ignored", () => {
  const bad = clone();
  bad.layout.variantAttrbute = "data-typo";
  const errors = validateConfig(bad);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /config\.layout: unknown key `variantAttrbute`/);
});

test("a missing required key is named", () => {
  const bad = clone();
  delete bad.exclude.paths;
  assert.match(validateConfig(bad).join("\n"), /config\.exclude: missing required key `paths`/);
});

test("a value outside an enum is named with the allowed set", () => {
  const bad = clone();
  bad.layout.baseMode = "widest";
  assert.match(
    validateConfig(bad).join("\n"),
    /config\.layout\.baseMode: "widest" is not one of "smallest-default-variant", "collection-default"/,
  );
});

test("a wrong type is named with what was expected", () => {
  const bad = clone();
  bad.exclude.paths = "layout/grid/aspect/";
  assert.match(validateConfig(bad).join("\n"), /config\.exclude\.paths: expected array, got string/);
});

test("generate() refuses an invalid config rather than emitting from defaults", () => {
  // There are no defaults on purpose: a silently defaulted house policy is how
  // a token pipeline starts emitting values nobody chose.
  const bad = clone();
  delete bad.header;
  assert.throws(
    () => generate({ collections: [] }, bad),
    /invalid config —[\s\S]*missing required key `header`/,
  );
});
