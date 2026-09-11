// Lock 2 — one skill, every host. The committed adapters must BE what the
// builder produces, every law sentence must survive into every host, and no
// host output may carry a machine-local path or an unfilled placeholder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildAll, CURSOR_GLOBS, demoteHeadings, fill, outputs, read } from "../scripts/build-skill-adapters.mjs";
import { carries, LAW_SENTENCES, LAW_WARNING_CODES } from "./skill-law-sentences.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const committed = (rel) => readFileSync(path.join(root, rel), "utf8");

test("every committed adapter is exactly what the builder produces", () => {
  for (const [rel, body] of Object.entries(outputs())) {
    assert.equal(committed(rel), body,
      `${rel} is stale — run \`node scripts/build-skill-adapters.mjs\``);
  }
});

test("the four dist outputs and the root AGENTS.md are the whole build", () => {
  assert.deepEqual(Object.keys(outputs()).sort(), [
    "AGENTS.md",
    "skills/handoff-to-code/dist/claude-plugin/SKILL.md",
    "skills/handoff-to-code/dist/codex/AGENTS.md",
    "skills/handoff-to-code/dist/cursor/handoff-to-code.mdc",
    "skills/handoff-to-code/dist/standalone/SKILL.md",
  ]);
  assert.equal(committed("AGENTS.md"), committed("skills/handoff-to-code/dist/codex/AGENTS.md"));
});

test("every law sentence survives verbatim into every host output", () => {
  for (const [rel, body] of Object.entries(outputs())) {
    for (const sentence of LAW_SENTENCES) {
      assert.ok(carries(body, sentence), `${rel} dropped: ${sentence.slice(0, 60)}…`);
    }
    for (const code of LAW_WARNING_CODES) {
      assert.ok(body.includes(code), `${rel} dropped warning code ${code}`);
    }
  }
});

test("no law sentence lives inside a host-varying hunk", () => {
  // The canonical text with every placeholder REMOVED: what is left is the
  // text every host shares, and that is where law has to live.
  const { text } = read();
  const shared = text.replace(/\{\{[a-z-]+\}\}/g, "");
  for (const sentence of LAW_SENTENCES) {
    assert.ok(carries(shared, sentence), `law sentence is host-varying: ${sentence.slice(0, 60)}…`);
  }
});

test("no host output carries a machine-local path or an unfilled placeholder", () => {
  for (const [rel, body] of Object.entries(outputs())) {
    assert.doesNotMatch(body, /\/Users\/|~\/JHD/, `${rel} carries a machine-local path`);
    assert.doesNotMatch(body, /\{\{/, `${rel} carries an unfilled placeholder`);
  }
});

test("house names appear in the plugin host only, and only after `## At JHD`", () => {
  const built = outputs();
  for (const [rel, body] of Object.entries(built)) {
    if (rel.includes("claude-plugin")) continue;
    assert.doesNotMatch(body, /jhd-design-system/, `${rel} names the house consumer`);
  }
  const plugin = built["skills/handoff-to-code/dist/claude-plugin/SKILL.md"];
  const at = plugin.indexOf("## At JHD");
  assert.ok(at > 0, "the plugin host must carry an `## At JHD` section");
  assert.doesNotMatch(plugin.slice(0, at), /jhd-design-system/, "house names belong under `## At JHD` only");
});

test("the cursor adapter is an .mdc with description, globs and alwaysApply", () => {
  const mdc = committed("skills/handoff-to-code/dist/cursor/handoff-to-code.mdc");
  const [, frontmatter, body] = mdc.split(/^---$/m);
  assert.match(frontmatter, /description: Build code from a Design Handoff export pair/);
  assert.match(frontmatter, new RegExp(`globs: ${CURSOR_GLOBS.join(",").replace(/[*.]/g, "\\$&")}`));
  assert.match(frontmatter, /alwaysApply: false/);
  assert.equal(frontmatter.split("\n").filter((l) => l.trim()).length, 3, "exactly three frontmatter keys");
  assert.match(body, /^\s*# Handoff to Code/);
});

test("the codex adapter is a section, with headings demoted outside fences", () => {
  const codex = committed("skills/handoff-to-code/dist/codex/AGENTS.md");
  assert.match(codex, /^## Handoff to Code\n/);
  assert.match(codex, /\n### Steps\n/);
  assert.match(codex, /\n#### 3\. Map every binding/);
  assert.doesNotMatch(codex, /\n# [A-Z]/, "no top-level heading survives in a section");
  // A `#` inside a fence is content, not a heading.
  assert.equal(demoteHeadings("```\n# not a heading\n```\n## real"), "```\n# not a heading\n```\n### real");
});

test("a host missing a value is a build failure, not a half-filled file", () => {
  assert.throws(() => fill("x {{tail}}", {}), /missing a value for \{\{tail\}\}/);
  const { text, hosts } = read();
  const broken = { ...hosts, standalone: { ...hosts.standalone } };
  delete broken.standalone["fires-table"];
  assert.throws(() => buildAll(text, broken), /missing a value for \{\{fires-table\}\}/);
});

test("the two host files declare identical key sets", () => {
  const { hosts } = read();
  const keys = (o) => Object.keys(o).filter((k) => k !== "_").sort();
  assert.deepEqual(keys(hosts.standalone), keys(hosts["claude-plugin"]));
  assert.deepEqual(keys(hosts.standalone),
    ["contract-read", "description-scope", "fires-table", "ruling-ref-cites", "sibling-skills", "tail"]);
});

test("the standalone host names no sibling skill it cannot ship", () => {
  const standalone = committed("skills/handoff-to-code/dist/standalone/SKILL.md");
  for (const sibling of ["capture-figma", "audit-build"]) {
    assert.ok(!standalone.includes(sibling), `standalone must not point at \`${sibling}\``);
  }
  // …and the plugin host, which ships them, does.
  const plugin = committed("skills/handoff-to-code/dist/claude-plugin/SKILL.md");
  assert.match(plugin, /`capture-figma`/);
  assert.match(plugin, /`audit-build`/);
});
