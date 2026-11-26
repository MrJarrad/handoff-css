// Ruling tables name the design system's authoring place in their second column: `figma` (the
// column every existing table has) or `source`. Both read the same; item keys stay `.figma`.
// Writers emit `figma` for the default source and `source` for any other kind.
import { test } from "node:test";
import assert from "node:assert/strict";

import { readRulings, renderMarkdown } from "../src/match.mjs";
import { renderRawValues } from "../src/raw-values.mjs";
import { renderResolveMarkdown } from "../src/resolve-need.mjs";
import { renderResolveComponentMarkdown } from "../src/resolve-component.mjs";
import { sourceOf } from "../src/config.mjs";

const table = (col) => `| kind | ${col} | ruling | code | note |\n| --- | --- | --- | --- | --- |\n| token | color/a | use | --a | ok |\n| raw-colour | #fff | keep |  |  |\n`;

test("a table headed `source` reads the same rows as one headed `figma`", () => {
  assert.deepEqual(readRulings(table("source")), readRulings(table("figma")));
  assert.equal(readRulings(table("source"))[0].figma, "color/a");
  assert.equal(readRulings(table("source")).length, 2);
});

test("both columns, or neither, is a clear error", () => {
  const both = "| kind | figma | source | ruling | code |\n| --- | --- | --- | --- | --- |\n| token | a | b | use | --a |\n";
  assert.throws(() => readRulings(both), /both `figma` and `source`/);
  const neither = "| kind | name | ruling | code |\n| --- | --- | --- | --- |\n| token | a | use | --a |\n";
  assert.throws(() => readRulings(neither), /neither a `figma` nor a `source` column/);
});

test("a table with no ruling column is still not a ruling table", () => {
  assert.deepEqual(readRulings("| kind | figma | token | why |\n| --- | --- | --- | --- |\n| raw-colour | #fff | --a | x |\n"), []);
});

const matchResult = { items: [{ kind: "token", figma: "color/a", status: "unmatched", proposal: null, alternatives: [] }], findings: [], counts: { items: 1, proposed: 0, unmatched: 1, ruled: 0 } };
const rawResult = { items: [{ kind: "colour", figma: "#fff", status: "unmatched", reason: "no-token", suggestions: [], layers: [], built: false }], findings: [], counts: { raw: 1 } };
const resolveNeed = { counts: {}, findings: [], items: [{ need: { id: "n1" }, status: "unresolved", kind: "resolve-need", candidates: [] }], needs: [], open: [{ need: { id: "n1" }, reason: "x", candidates: [] }], resolved: [] };

test("the match writer's header follows the source: figma by default, source otherwise", () => {
  assert.match(renderMarkdown(matchResult), /\| kind \| figma \| ruling \| code \| note \|/);
  assert.match(renderMarkdown(matchResult, { source: sourceOf({}) }), /\| kind \| figma \| ruling/);
  assert.match(renderMarkdown(matchResult, { source: sourceOf({ source: { kind: "storybook" } }) }), /\| kind \| source \| ruling \| code \| note \|/);
  assert.match(renderMarkdown(matchResult, { source: sourceOf({ source: { kind: "other", label: "Penpot" } }) }), /\| kind \| source \|/);
});

test("the raw-value writer follows the source", () => {
  const out = renderRawValues(rawResult, { source: sourceOf({ source: { kind: "tokens-code" } }) });
  assert.doesNotMatch(out, /\| figma \|/);
  assert.match(renderRawValues(rawResult), /\| kind \| figma \| ruling/);
});

test("a table the writer emits for another source reads back through readRulings", () => {
  const out = renderMarkdown(matchResult, { source: sourceOf({ source: { kind: "storybook" } }) });
  const filled = out.replace("| token | color/a |  |", "| token | color/a | skip |");
  assert.deepEqual(readRulings(filled).map((r) => [r.kind, r.figma, r.ruling]), [["token", "color/a", "skip"]]);
});

test("the resolve writers accept the same option", () => {
  for (const fn of [renderResolveMarkdown, renderResolveComponentMarkdown]) {
    assert.equal(typeof fn, "function");
    assert.ok(fn.length <= 2);
  }
});
