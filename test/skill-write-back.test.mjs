// The skill tells the agent how to write a note onto a layer through Figma's MCP and read it back.
// The rules are the ones that went wrong when notes were written by hand: the wrong layer, a category
// invented, a note replaced, a label quoted that later changed, a write never checked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skill = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills", "handoff-to-code");
const main = readFileSync(path.join(skill, "SKILL.md"), "utf8");
const steps = readFileSync(path.join(skill, "references", "write-back.md"), "utf8");

test("the skill points at the write-back step from the asks, where a note for Figma is handed over", () => {
  const asks = main.slice(main.indexOf("### 5b."), main.indexOf("### 6."));
  assert.match(asks, /references\/write-back\.md/);
});

for (const [rule, pattern] of [
  ["it is done through Figma's MCP, with the Figma skill loaded first", /use_figma[\s\S]*figma-use|figma-use[\s\S]*use_figma/],
  ["it writes only when the person has said to", /only when the person has (?:said|agreed|asked)/i],
  ["it writes on the outermost instance, not an inner part", /outermost instance/],
  ["the category is one the file already has", /getAnnotationCategoriesAsync/],
  ["it adds to the layer's notes and never replaces or removes one", /never (?:replace|overwrite|remove)/i],
  ["a note does not restate a property", /never restate|does not restate|not restate/i],
  ["a note names the part or its role, not a label that can change", /(?:visible label|label that can change)/i],
  ["an existing note goes back with only one of label or labelMarkdown", /only one of label or labelMarkdown/i],
  ["every note is read back and compared", /read (?:it |each note )?back/i],
  ["a mismatch is fixed once and then reported", /fix(?:ed)? (?:it )?once/i],
  ["each written note is a row in the return", /deviation table/i],
]) {
  test("write-back: " + rule, () => assert.match(steps, pattern));
}
