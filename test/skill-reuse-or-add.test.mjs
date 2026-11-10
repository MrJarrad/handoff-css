// The skill teaches profile -> resolve -> ramp (HT-111, HT-112): write down how the system is built,
// reuse what exists, add a name or a whole ramp only as one question, and write into the design file
// only after a yes. Each test pins one operator decision.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { outputs } from "../scripts/build-skill-adapters.mjs";
import { carries } from "./skill-law-sentences.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = path.join(root, "skills", "handoff-to-code");
const main = readFileSync(path.join(skill, "SKILL.md"), "utf8");
const ref = readFileSync(path.join(skill, "references", "reuse-or-add.md"), "utf8");
const section = (from, to) => main.slice(main.indexOf(from), main.indexOf(to));
const profileStep = section("### 2b.", "### 3.");
const addStep = section("### 3b.", "### 4.");
const resolveSrc = readFileSync(path.join(root, "src", "resolve-need.mjs"), "utf8");

test("1: the system is profiled first and the profile is kept beside the work", () => {
  assert.match(profileStep, /handoff-css profile --export/);
  assert.match(profileStep, /system-profile\.md/);
  assert.match(profileStep, /beside the work/i);
  assert.match(profileStep, /--check/);
});

test("2: no particular system is assumed and nothing is house-named", () => {
  for (const [name, text] of [["SKILL.md", main], ["reuse-or-add.md", ref]]) {
    assert.doesNotMatch(text, /jhd/i, `${name} names the house`);
  }
  assert.match(profileStep, /not all built alike/i);
});

test("3: reuse first through resolve, add only when nothing fits", () => {
  assert.match(addStep, /handoff-css resolve --export/);
  assert.ok(addStep.indexOf("resolve") < addStep.indexOf("handoff-css ramp"), "resolve comes before ramp");
  assert.match(addStep, /nothing (?:in the system )?fits|only when nothing/i);
});

test("4: a colour is added as a whole ramp with its semantic step mapping, never one raw colour", () => {
  assert.match(addStep, /handoff-css ramp --export/);
  assert.match(addStep, /whole (?:primitive )?ramp/i);
  assert.match(addStep, /never (?:a )?single (?:raw )?colou?r/i);
  assert.match(addStep, /--for/);
  assert.match(addStep, /--on/);
});

test("5: the name is asked as one question: generated or the designer's own", () => {
  assert.match(addStep, /generated/i);
  assert.match(addStep, /your own|their own|own name/i);
  assert.match(addStep, /one question/i);
  assert.match(ref, /nameSource/);
});

test("6: the word orbit appears nowhere the skill ships", () => {
  const files = [main, ref, ...readdirSync(path.join(skill, "references")).map((f) => readFileSync(path.join(skill, "references", f), "utf8")), ...Object.values(outputs())];
  for (const t of files) assert.doesNotMatch(t, /orbit/i);
});

test("the Figma write is a required stop on a yes, then a read-back, with no one tool assumed", () => {
  assert.match(addStep, /stop/i);
  assert.match(addStep, /yes/i);
  assert.match(addStep, /read(?:s)? (?:it )?back/i);
  assert.ok(carries(addStep, "host's Figma write tool, following that tool's own instructions"));
  assert.doesNotMatch(addStep, /use_figma|figma-use/, "the step names no tool; the reference carries the worked case");
  assert.match(ref, /write-back\.md/);
});

test("the lightness mode is named, not restated", () => {
  assert.match(addStep, /--from-scratch/);
  assert.doesNotMatch(addStep + ref, /0\.30|L 0\.3/);
});

test("one path: the raw-value fallback is stated once, and step 3 points at 3b", () => {
  assert.match(main.slice(main.indexOf("### 3."), main.indexOf("### 3b.")), /3b/);
  assert.equal((main.match(/assumed-ask/g) || []).length >= 1, true);
  assert.equal((addStep.match(/assumed-ask/g) || []).length, 1);
  assert.doesNotMatch(readFileSync(path.join(skill, "references", "write-back.md"), "utf8"), /Nothing else in the skill writes/);
});

test("every verdict resolve can give is in the reference", () => {
  const verdicts = new Set([...resolveSrc.matchAll(/verdict = "([A-Z_]+)"/g)].map((m) => m[1]));
  assert.ok(verdicts.size >= 4);
  for (const v of [...verdicts, "RULED", "RULING_STALE"]) assert.ok(ref.includes(v), `reference misses ${v}`);
});

test("exit code 2 means an open need, not a failure", () => {
  assert.match(addStep + ref, /exit(?:s)? 2|exit code 2/i);
});

test("every host carries the new steps", () => {
  for (const body of Object.values(outputs())) {
    assert.ok(carries(body, "handoff-css profile --export"), "profile missing");
    assert.ok(carries(body, "handoff-css ramp --export"), "ramp missing");
  }
});
