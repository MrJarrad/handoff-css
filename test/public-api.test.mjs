// The package's `exports` map publishes `.` only, so `src/index.mjs` is the
// whole public surface: anything not re-exported there is unreachable from a
// consumer, however many tests in this repo import it by deep path.
//
// P16's `conform` is the case that matters for 0.4.0 — `jhd-design-system`
// runs it from its own test suite rather than through the CLI, and until now
// could not import it at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as api from "../src/index.mjs";
import { docV9b, V9B } from "./fixture.mjs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("`.` is the only published entry for source — a deep import is not a supported path", () => {
  assert.equal(pkg.exports["."], "./src/index.mjs");
});

for (const name of [
  "generate", "run",
  "validateConfig", "configSchema",
  "validateExport", "assertValidExport", "exportSchema", "VALIDATED_SCHEMA_VERSIONS",
  "conform", "FINDINGS", "renderConformMarkdown", "renderConformJson",
  "parseHandoffMarkdown", "validateHandoffMarkdown",
]) {
  test(`${name} is reachable from the package entry`, () => {
    assert.notEqual(api[name], undefined);
  });
}

test("conform runs end to end through the public entry, against the real v8b pair", () => {
  const doc = docV9b();
  const handoff = {
    ...api.parseHandoffMarkdown(readFileSync(`${V9B}/design-handoff-block-navigation.md`, "utf8")),
    file: "design-handoff-block-navigation.md",
  };
  const tokensCss = readFileSync(`${V9B}/expected/tokens.generated.css`, "utf8");
  const result = api.conform({
    doc, handoff, tokensCss,
    files: [{ path: "clean.css", text: ":root { color: var(--background-default-primary); }" }],
  });
  assert.ok(Array.isArray(result.findings));
  assert.equal(typeof result.summary.red, "number");
  assert.match(api.renderConformMarkdown(result), /^# /m);
  assert.deepEqual(Object.keys(JSON.parse(api.renderConformJson(result))).sort(), ["findings", "summary"]);
});

test("FINDINGS still states a severity for every code, so a caller can rank without the CLI", () => {
  assert.deepEqual(Object.keys(api.FINDINGS).sort(), [
    "GRID_ARITHMETIC", "LOCAL_ONLY", "PLACEHOLDER_COPY", "SAMPLE_PX_LITERAL",
    "UNKNOWN_NAME", "UNMAPPED_BINDING",
  ]);
});
