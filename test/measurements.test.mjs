// Schema design-handoff v16: a layer carries the Dev Mode measurements that start from it
// (`layerTree[].measurements[]`), read from the layer by the plugin or by the link run's live read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { BRIEF_SCHEMA_VERSIONS, validateBriefJson } from "../src/brief.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const overlay = () => JSON.parse(gunzipSync(readFileSync(path.join(fixtures, "script-2026-10-29", "overlay.json.gz"))).toString("utf8"));
const measurement = { id: "m1", start: { nodeId: "4227:16274", side: "BOTTOM" }, end: { nodeId: "5142:26375", name: "Project", side: "TOP" }, offset: { type: "OUTER", fixed: 24 }, freeText: null };
const withMeasurement = (m) => { const brief = { ...overlay(), schemaVersion: 16 }; brief.layerTree[0].measurements = [m]; return brief; };

test("v16 is a brief version the checker validates in full", () => {
  assert.ok(BRIEF_SCHEMA_VERSIONS.includes(16));
});

test("a v16 brief with a measurement on a layer is valid; an inner offset and a note are valid too", () => {
  for (const m of [measurement, { ...measurement, offset: { type: "INNER", relative: 0.5 }, freeText: "section gap" }]) {
    const result = validateBriefJson(withMeasurement(m));
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  }
});

test("a measurement with an unknown side, a missing end or an extra field is refused", () => {
  for (const m of [{ ...measurement, start: { ...measurement.start, side: "MIDDLE" } }, { ...measurement, end: undefined }, { ...measurement, colour: "red" }]) {
    assert.equal(validateBriefJson(withMeasurement(JSON.parse(JSON.stringify(m)))).ok, false, JSON.stringify(m));
  }
});

test("v15 has no measurements: a v15 brief carrying one is refused", () => {
  assert.equal(validateBriefJson({ ...withMeasurement(measurement), schemaVersion: 15 }).ok, false);
});
