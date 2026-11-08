// Every published design-handoff schema file is a version this checker validates in full, and
// the other way round — a new schema/design-handoff.vN.schema.json cannot land unregistered (HT-52).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRIEF_SCHEMA_VERSIONS, validateBriefJson } from "../src/brief.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "schema");
const onDisk = readdirSync(dir)
  .map((f) => /^design-handoff\.v(\d+)\.schema\.json$/.exec(f)?.[1])
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b);

test("BRIEF_SCHEMA_VERSIONS is exactly the design-handoff schema files in schema/", () => {
  assert.deepEqual([...BRIEF_SCHEMA_VERSIONS].sort((a, b) => a - b), onDisk);
});

test("a version one past the newest passes as newer-than-checker, never as an unknown error", () => {
  const next = Math.max(...onDisk) + 1;
  const { errors, warnings } = validateBriefJson({ schemaVersion: next });
  assert.ok(!errors.some((e) => e.path === "/schemaVersion"), JSON.stringify(errors));
  assert.ok(warnings.some((w) => w.code === "SCHEMA_NEWER_THAN_CHECKER"));
});
