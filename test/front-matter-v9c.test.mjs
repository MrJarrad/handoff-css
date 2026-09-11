// P17 — the plugin's export v4 brief opens with a `---` YAML front-matter
// block and its responsive tables carry a proper `Notes` header column
// instead of the legacy ragged trailing cell (`jhd-v9b`'s `† token-swap`).
// Every case here is a MUTATION of the real v9c brief.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseHandoffMarkdown, validateHandoffMarkdown } from "../src/validate-handoff-md.mjs";
import { V9C } from "./fixture.mjs";
import path from "node:path";

const PATH = path.join(V9C, "design-handoff-block-navigation.md");
const brief = () => readFileSync(PATH, "utf8");

const edit = (text, find, replace) => {
  const at = text.indexOf(find);
  assert.notEqual(at, -1, `fixture no longer contains: ${find.slice(0, 60)}`);
  return text.slice(0, at) + replace + text.slice(at + find.length);
};
const only = (findings, code) => findings.filter((f) => f.code === code);

test("the v9c brief (export v4) validates with zero errors and zero warnings", () => {
  const { ok, findings } = validateHandoffMarkdown(brief());
  assert.equal(ok, true);
  assert.deepEqual(findings, []);
});

test("the front matter is parsed: schema identity, policies.units, exportVersion", () => {
  const p = parseHandoffMarkdown(brief());
  assert.ok(p.frontMatter);
  assert.equal(p.frontMatter.schema, "design-handoff");
  assert.equal(p.frontMatter.schemaVersion, 6);
  assert.equal(p.frontMatter.exportVersion, 3);
  assert.equal(p.frontMatter.policies.units, 5);
  assert.equal(p.frontMatter.companion.schemaVersion, 9);
});

test("the Notes column populates row.note on colGap, rowGap and padding — never a cell-vocabulary error", () => {
  const { findings } = validateHandoffMarkdown(brief());
  assert.deepEqual(only(findings, "TABLE_CELL_UNKNOWN"), []);

  const p = parseHandoffMarkdown(brief());
  const table = p.tables.find((t) => t.hasNotesColumn && t.rows.some((r) => r.cells[0] === "colGap"));
  assert.ok(table, "expected a table with a Notes column and a colGap row");
  const colGap = table.rows.find((r) => r.cells[0] === "colGap");
  const rowGap = table.rows.find((r) => r.cells[0] === "rowGap");
  const padding = table.rows.find((r) => r.cells[0] === "padding (v/h)");
  assert.equal(colGap.note, "token-swap");
  assert.equal(rowGap.note, "variant-only");
  assert.equal(padding.note, "token-swap");
});

test("a row-wrap Notes cell keeps its full free-text note", () => {
  const p = parseHandoffMarkdown(brief());
  const table = p.tables.find((t) => t.hasNotesColumn && t.rows.some((r) => r.note?.startsWith("row-wrap")));
  assert.ok(table);
  const row = table.rows.find((r) => r.note?.startsWith("row-wrap"));
  assert.match(row.note, /^row-wrap: 2 rows \(row 1: .+, row 2: .+\)$/);
});

test("a mutated front-matter schemaVersion (6 -> 5) is FRONT_MATTER_MISMATCH, naming the field", () => {
  const text = edit(brief(), "schemaVersion: 6\ncontract:", "schemaVersion: 5\ncontract:");
  const { ok, findings } = validateHandoffMarkdown(text);
  assert.equal(ok, false);
  const hits = only(findings, "FRONT_MATTER_MISMATCH");
  assert.equal(hits.length, 1, findings.map((f) => `${f.code}: ${f.message}`).join("; "));
  assert.match(hits[0].message, /front matter `schemaVersion` is `5`.*bold line \(line 69\) states `6`/s);
});

test("a document with no front matter at all still parses and validates from the bold lines alone (v9b unaffected)", () => {
  const v9b = readFileSync(new URL("../fixtures/jhd-v9b-2026-09-11/design-handoff-block-navigation.md", import.meta.url), "utf8");
  const p = parseHandoffMarkdown(v9b);
  assert.equal(p.frontMatter, null);
  assert.equal(p.schemaVersion, 6);
  const { ok, findings } = validateHandoffMarkdown(v9b);
  assert.equal(ok, true);
  assert.deepEqual(findings.map((f) => f.code), []);
});
