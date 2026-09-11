#!/usr/bin/env node
// ONE SKILL, EVERY HOST. `skills/handoff-to-code/SKILL.md` is canonical; the
// six sentences that can only be written per-host are `{{placeholders}}` filled
// from `hosts/*.json`. Everything else — the contract sentence, the steps, the
// warning table, the Build standards, the deviation table — exists exactly once
// and is copied byte for byte into every output.
//
// The drift this ends: the package and the discipline plugin carried two
// hand-edited copies of this skill, and nothing failed when they disagreed.
// Now `test/skill-adapters.test.mjs` fails when a committed output is not what
// this script produces.
//
//   node scripts/build-skill-adapters.mjs          # write dist + AGENTS.md
//   node scripts/build-skill-adapters.mjs --check  # exit 1 if any would change
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = path.join(root, "skills", "handoff-to-code");

/** Cursor matches rules by glob, so the rule fires on the pair's own files. */
export const CURSOR_GLOBS = ["**/design-handoff-*.md", "**/*-design-system-handoff.json", "**/handoff.config.mjs"];

const PLACEHOLDER = /\{\{([a-z-]+)\}\}/g;

/** Fill the canonical text for one host. An unfilled placeholder is a build failure. */
export function fill(text, values) {
  const out = text.replace(PLACEHOLDER, (_, key) => {
    if (!(key in values)) throw new Error(`host is missing a value for {{${key}}}`);
    return values[key];
  });
  if (out.includes("{{")) throw new Error("an output still carries a placeholder");
  return out;
}

/** `---\n…\n---\n` off the front, plus the frontmatter as text. */
function splitFrontmatter(text) {
  if (!text.startsWith("---\n")) return { frontmatter: "", body: text };
  const end = text.indexOf("\n---\n", 4);
  return { frontmatter: text.slice(4, end + 1), body: text.slice(end + 5).replace(/^\n+/, "") };
}

/** The frontmatter `description:` as one line. */
function description(frontmatter) {
  const at = frontmatter.indexOf("description:");
  const rest = frontmatter.slice(at + "description:".length).replace(/^\s*>-\s*\n/, "");
  const lines = [];
  for (const line of rest.split("\n")) {
    if (/^\S/.test(line)) break;
    lines.push(line.trim());
  }
  return lines.join(" ").trim();
}

/**
 * Markdown headings one level deeper, fenced blocks untouched — a `#` inside a
 * code fence is content, and demoting it corrupts the example.
 */
export function demoteHeadings(body) {
  let fenced = false;
  return body.split("\n").map((line) => {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) return line;
    return /^#{1,5} /.test(line) ? `#${line}` : line;
  }).join("\n");
}

/**
 * Every host output, in memory. Pure: the tests call this rather than the
 * filesystem, and the writer below is the only thing that touches disk.
 *
 * @param {string} text   the canonical SKILL.md
 * @param {{standalone: object, "claude-plugin": object}} hosts
 * @returns {Record<string, string>} relative path -> file contents
 */
export function buildAll(text, hosts) {
  const standalone = fill(text, hosts.standalone);
  const plugin = fill(text, hosts["claude-plugin"]);

  const { frontmatter, body } = splitFrontmatter(standalone);
  const cursor = [
    "---",
    `description: ${description(frontmatter)}`,
    `globs: ${CURSOR_GLOBS.join(",")}`,
    "alwaysApply: false",
    "---",
    "",
    body,
  ].join("\n");

  // Codex reads one AGENTS.md, so the skill becomes a SECTION of it: its own
  // `# Handoff to Code` title is the section heading, and everything below it
  // moves one level down so the outline stays well-formed.
  const codex = ["## Handoff to Code", "", demoteHeadings(body.replace(/^# Handoff to Code\n+/, ""))].join("\n");

  return {
    "dist/standalone/SKILL.md": standalone,
    "dist/claude-plugin/SKILL.md": plugin,
    "dist/cursor/handoff-to-code.mdc": cursor,
    "dist/codex/AGENTS.md": codex,
  };
}

/** The canonical text + host values, read from the skill directory. */
export function read() {
  const hosts = {
    standalone: JSON.parse(readFileSync(path.join(skillDir, "hosts", "standalone.json"), "utf8")),
    "claude-plugin": JSON.parse(readFileSync(path.join(skillDir, "hosts", "claude-plugin.json"), "utf8")),
  };
  // The plugin's house tail is markdown, not a JSON string: it is a section a
  // human edits, and a JSON blob with \n in it is not that.
  hosts["claude-plugin"].tail = readFileSync(path.join(skillDir, "hosts", "claude-plugin.tail.md"), "utf8").trimEnd();
  return { text: readFileSync(path.join(skillDir, "SKILL.md"), "utf8"), hosts };
}

/** path -> contents for everything this build owns, dist and the root AGENTS.md. */
export function outputs() {
  const { text, hosts } = read();
  const built = buildAll(text, hosts);
  return {
    ...Object.fromEntries(Object.entries(built).map(([rel, body]) => [path.join("skills/handoff-to-code", rel), body])),
    // The repo's own agent file IS the codex adapter: one skill, every host,
    // including this repo.
    "AGENTS.md": built["dist/codex/AGENTS.md"],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  let changed = 0;
  for (const [rel, body] of Object.entries(outputs())) {
    const abs = path.join(root, rel);
    let current = null;
    try {
      current = readFileSync(abs, "utf8");
    } catch {}
    if (current === body) continue;
    changed += 1;
    if (check) process.stdout.write(`would change: ${rel}\n`);
    else {
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, body);
      process.stdout.write(`wrote: ${rel}\n`);
    }
  }
  if (changed === 0) process.stdout.write("skill adapters up to date\n");
  if (check && changed > 0) process.exitCode = 1;
}
