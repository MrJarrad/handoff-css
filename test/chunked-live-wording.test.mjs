// A layer too big for one use_figma return is read in chunks, so every place that tells a person or
// agent how to pass the live read says one --live for each chunk (HT-64).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(path.join(root, ...p), "utf8");

test("export-set.md's regenerate command says one --live for each chunk", () => {
  const text = read("skills", "handoff-to-code", "references", "export-set.md");
  const block = text.slice(text.indexOf("**Bringing a stale brief up to date**"));
  assert.match(block.slice(0, 700), /one `--live` (?:for each|per) chunk/i);
});

test("set.mjs's description of the live read says one --live for each chunk", () => {
  const text = read("src", "set.mjs");
  assert.doesNotMatch(text, /\(`design-handoff --live`\)/);
  assert.match(text, /one `--live` for each chunk/);
});
