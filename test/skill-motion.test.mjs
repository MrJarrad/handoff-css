// The skill sends the agent to Figma's motion reader for a layer that has keyframes. The link route reads the
// layer from Figma's REST API, which has no keyframes, so the keyframes come from get_motion_context.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skill = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills", "handoff-to-code");
const main = readFileSync(path.join(skill, "SKILL.md"), "utf8");
const steps = readFileSync(path.join(skill, "references", "motion.md"), "utf8");

test("the skill points at the motion step from the implementation step", () => {
  const build = main.slice(main.indexOf("### 4."), main.indexOf("### 5."));
  assert.match(build, /references\/motion\.md/);
});

for (const [rule, pattern] of [
  ["it says why the brief does not carry keyframes", /REST/],
  ["it uses Figma's motion reader on the animated layer, recursively", /get_motion_context[\s\S]*recursive/],
  ["the snippets are used as given, not regenerated from the tracks", /codeSnippets[\s\S]*(?:as given|verbatim|as they are)/i],
  ["motion is merged into the build by node id", /node id/i],
  ["motion's value is built and each timing or easing disagreement is a deviation row naming both values", /motion's value is built[\s\S]*deviation row naming both values/i],
  ["no keyframes means no keyframe animation, and the brief's prototype transition still applies", /no keyframes means no keyframe animation[\s\S]*prototype transition from the brief still applies/i],
  ["nothing is borrowed from another layer", /Do not borrow/],
  ["reduced motion is honoured", /prefers-reduced-motion/],
  ["a duration or easing off the design system's motion tokens is a deviation row", /motion tokens[\s\S]*deviation table|deviation table[\s\S]*motion tokens/i],
  ["without Figma's MCP it asks instead of guessing", /(?:is not connected|without .*MCP)[\s\S]*ask/i],
]) {
  test("motion: " + rule, () => assert.match(steps, pattern));
}
