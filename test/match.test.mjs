// `handoff-css match` — brownfield mode (HT-21). A project that already has code
// and no Design System Handoff export: each Figma variable and component in the
// brief gets a proposed code match with its evidence and a confidence, or is
// reported unmatched for a human to rule on. Never adopted, never invented.
// The brief is the 29 Oct link-run fixture, read at run time; each test builds
// the codebase it needs from the brief's own names and values.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { dispatch } from "../src/cli.mjs";
import { parseHandoffMarkdown } from "../src/validate-handoff-md.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "script-2026-10-29");
const briefMd = gunzipSync(readFileSync(path.join(dir, "navigation.md.gz"))).toString("utf8");
const brief = parseHandoffMarkdown(briefMd);

/** Write `files` (path → text) under a temp project, run `match --json`, return {code, result}. */
async function match(files, extra = [], { handoff = briefMd } = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-match-"));
  writeFileSync(path.join(cwd, "brief.md"), handoff);
  mkdirSync(path.join(cwd, "src"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(cwd, "src", name)), { recursive: true });
    writeFileSync(path.join(cwd, "src", name), text);
  }
  let out = "";
  const code = await dispatch(["match", "--handoff", "brief.md", "--src", "src", ...extra, "--json"], {
    cwd, stdout: { write: (s) => { out += s; } }, stderr: { write: () => {} },
  });
  return { code, cwd, result: JSON.parse(out) };
}
const item = (result, kind, figma) => result.items.find((i) => i.kind === kind && i.figma === figma);

test("a code stylesheet declaring the brief's own CSS name and value is a high-confidence proposal", async () => {
  const token = brief.tokens[0];
  const { result } = await match({ "a.css": `:root { ${token.web}: ${token.values[0]}; }\n` });
  const it = item(result, "token", token.token);
  assert.equal(it.status, "proposed");
  assert.equal(it.proposal.code, token.web);
  assert.equal(it.proposal.confidence, "high");
  assert.ok(it.proposal.why.some((w) => w.startsWith("name")));
  assert.ok(it.proposal.why.some((w) => w.startsWith("value") && w.includes(token.values[0])));
});

test("the brief's CSS name with a value the brief never states is proposed at medium, and says both values", async () => {
  const token = brief.tokens[0];
  const { result } = await match({ "a.css": `:root { ${token.web}: 999.5rem; }\n` });
  const it = item(result, "token", token.token);
  assert.equal(it.proposal.code, token.web);
  assert.equal(it.proposal.confidence, "medium");
  const value = it.proposal.why.find((w) => w.startsWith("value"));
  assert.ok(value.includes("999.5rem") && value.includes(token.values[0]));
});

test("a name used in the code but declared outside it (a design-system package) is still a match, and says where it is not", async () => {
  const token = brief.tokens[0];
  const { result } = await match({ "a.tsx": `export const A = () => <div style={{ width: "var(${token.web})" }} />;\n` });
  const it = item(result, "token", token.token);
  assert.equal(it.proposal.confidence, "high");
  assert.ok(it.proposal.why.some((w) => w.startsWith("usage") && w.includes("declared outside")));
});

test("a code name sharing most of the brief name's segments is proposed, higher when its value agrees", async () => {
  const token = brief.tokens.find((t) => t.web.split("-").filter(Boolean).length >= 3 && t.values.length);
  const near = `${token.web}-legacy`;
  const agreeing = await match({ "a.css": `:root { ${near}: ${token.values[0]}; }\n` });
  const differing = await match({ "a.css": `:root { ${near}: 999.5rem; }\n` });
  assert.deepEqual([item(agreeing.result, "token", token.token).proposal.confidence, item(differing.result, "token", token.token).proposal.confidence], ["medium", "low"]);
  assert.equal(item(agreeing.result, "token", token.token).proposal.code, near);
});

test("a token the code has no name for is unmatched; a code property with only its value is an alternative, never the proposal", async () => {
  const token = brief.tokens.find((t) => t.values.some((v) => v.endsWith("rem")));
  const value = token.values.find((v) => v.endsWith("rem"));
  const { result } = await match({ "a.css": `:root { --unrelated-thing: ${value}; }\n` });
  const it = item(result, "token", token.token);
  assert.equal(it.status, "unmatched");
  assert.equal(it.proposal, null);
  assert.deepEqual(it.alternatives.map((a) => a.code), ["--unrelated-thing"]);
  assert.ok(it.alternatives[0].why.some((w) => w.startsWith("value")));
  assert.equal(result.counts.unmatched, result.items.filter((i) => i.status === "unmatched").length);
});

const components = briefMd.split("\n").filter((l) => /^- \[[^\]]+\]\([^)]*\) #\S+ — \d+ instances?/.test(l)).map((l) => /^- \[([^\]]+)\]/.exec(l)[1]);

test("every component the brief uses is an item; a code component of the same name is proposed high, with its uses", async () => {
  const label = components.find((c) => /^[A-Z]/.test(c));
  const { result } = await match({
    "c.tsx": `export function ${label}() { return null; }\n`,
    "page.tsx": `import { ${label} } from "./c";\nexport default function Page() { return <${label} />; }\n`,
  });
  assert.deepEqual(result.items.filter((i) => i.kind === "component").map((i) => i.figma).sort(), [...components].sort());
  const it = item(result, "component", label);
  assert.equal(it.proposal.code, label);
  assert.equal(it.proposal.confidence, "high");
  assert.ok(it.proposal.why.some((w) => w.startsWith("usage") && w.includes("1×") && w.includes("c.tsx")));
});

test("a code component whose name contains the Figma component's is proposed at medium; none is unmatched", async () => {
  const label = components.find((c) => /^[A-Z]/.test(c));
  const { result } = await match({ "c.tsx": `export const ${label}Block = () => null;\n` });
  assert.deepEqual([item(result, "component", label).proposal.code, item(result, "component", label).proposal.confidence], [`${label}Block`, "medium"]);
  const other = components.find((c) => c !== label && /^[A-Z]/.test(c) && !c.includes(label) && !label.includes(c));
  assert.equal(item(result, "component", other).status, "unmatched");
});

const rulingTable = (rows) => [
  "# Brownfield rulings",
  "",
  "| kind | figma | ruling | code | note |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.join(" | ")} |`),
  "",
].join("\n");

test("a recorded ruling is reused: the item is ruled, not re-proposed, and carries the ruling", async () => {
  const [a, b] = brief.tokens;
  const label = components.find((c) => /^[A-Z]/.test(c));
  const files = { "a.css": `:root { --kept-name: 1rem; }\n` };
  const rulings = rulingTable([["token", `\`${a.token}\``, "use", "`--kept-name`", "operator 30 Oct"], ["token", b.token, "new", "", ""], ["component", label, "skip", "", "not on this page"]]);
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-rulings-"));
  writeFileSync(path.join(cwd, "rulings.md"), rulings);
  const { result } = await match(files, ["--rulings", path.join(cwd, "rulings.md")]);
  assert.deepEqual(item(result, "token", a.token).ruling, { ruling: "use", code: "--kept-name", note: "operator 30 Oct" });
  assert.equal(item(result, "token", a.token).status, "ruled");
  assert.equal(item(result, "token", b.token).ruling.ruling, "new");
  assert.equal(item(result, "component", label).status, "ruled");
  assert.equal(result.counts.ruled, 3);
});

test("a `use` ruling naming code that no longer exists is stale: reported, and the item needs ruling again", async () => {
  const token = brief.tokens[0];
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-rulings-"));
  writeFileSync(path.join(cwd, "rulings.md"), rulingTable([["token", token.token, "use", "--gone-name", ""]]));
  const { result } = await match({ "a.css": ":root {}\n" }, ["--rulings", path.join(cwd, "rulings.md")]);
  const it = item(result, "token", token.token);
  assert.notEqual(it.status, "ruled");
  assert.deepEqual(result.findings.map((f) => [f.code, f.figma]), [["RULING_STALE", token.token]]);
});

test("the run exits 1 while any item has no ruling, and 0 once every item is ruled", async () => {
  const open = await match({ "a.css": `:root { ${brief.tokens[0].web}: ${brief.tokens[0].values[0]}; }\n` });
  assert.equal(open.code, 1);
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-rulings-"));
  writeFileSync(path.join(cwd, "rulings.md"), rulingTable([
    ...brief.tokens.map((t) => ["token", t.token, "new", "", ""]),
    ...components.map((c) => ["component", c, "skip", "", ""]),
  ]));
  const done = await match({}, ["--rulings", path.join(cwd, "rulings.md")]);
  assert.equal(done.code, 0);
});

test("the text report gives counts, and every unruled item as a ruling row to fill, proposal pre-filled", async () => {
  const token = brief.tokens[0];
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-match-"));
  writeFileSync(path.join(cwd, "brief.md"), briefMd);
  mkdirSync(path.join(cwd, "src"));
  writeFileSync(path.join(cwd, "src", "a.css"), `:root { ${token.web}: ${token.values[0]}; }\n`);
  let out = "";
  await dispatch(["match", "--handoff", "brief.md", "--src", "src"], { cwd, stdout: { write: (s) => { out += s; } }, stderr: { write: () => {} } });
  const items = brief.tokens.length + components.length;
  assert.match(out, new RegExp(`${items} items · 1 proposed · ${items - 1} unmatched · 0 ruled`));
  assert.ok(out.includes("| kind | figma | ruling | code | note |"));
  assert.ok(out.includes(`| token | ${token.token} |  | ${token.web} | high:`));
  assert.equal(out.split("\n").filter((l) => /^\| (token|component) \|/.test(l)).length, items);
});

test("only a PascalCase export from a .tsx/.jsx file is a component — a constant or a .ts export is not", async () => {
  const label = components.find((c) => /^[A-Z]/.test(c));
  const { result } = await match({
    "draft.ts": `export const ${label.toUpperCase()} = 1;\nexport function ${label}() {}\n`,
    "c.tsx": `export const ${label.toUpperCase()} = 1;\n`,
  });
  assert.equal(item(result, "component", label).status, "unmatched");
});

test("a token row with no CSS name (older grammar, no codeSyntax.WEB) is unmatched with that reason, never a crash", async () => {
  const row = briefMd.split("\n").find((l) => l.startsWith(`- $${brief.tokens[0].token} → CSS`));
  const handoff = briefMd.replace(row, `- $${brief.tokens[0].token} · light #fff`);
  const { result } = await match({ "a.css": ":root { --anything: #fff; }\n" }, [], { handoff });
  const it = item(result, "token", brief.tokens[0].token);
  assert.equal(it.status, "unmatched");
  assert.ok(it.reason.includes("no CSS name"));
});

test("an unresolved mode sample (`?`) is never a value the brief states", async () => {
  const unresolved = brief.tokens.find((t) => briefMd.split("\n")[t.line - 1].includes("=?"));
  assert.ok(unresolved, "the fixture carries an unresolved sample");
  assert.ok(!unresolved.values.includes("?"));
  const { result } = await match({ "a.css": `:root { ${unresolved.web}: #123456; }\n` });
  const value = item(result, "token", unresolved.token).proposal.why.find((w) => w.startsWith("value"));
  assert.ok(value.includes("no resolved value") && !value.includes("states ?"));
});
