// HT-102: values a layer states as plain numbers (not bound to a Figma variable), matched to the
// project's own coded tokens. Locks: HT-104 a clear match is built with the token and listed; HT-105
// colour maps only when the two can't be told apart, slightly off is listed with the token suggested;
// HT-106 a number between two steps keeps its exact value and is listed with both neighbours.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { deltaE2000, matchRawValues } from "../src/raw-values.mjs";
import { matchCommand } from "../src/match-cli.mjs";

const css = (text) => [{ path: "tokens.css", text }];
const TOKENS = css(`:root {
  --color-ink: #1a1a1a;
  --color-ink-soft: #3a3a3a;
  --color-accent: rgb(0 102 255);
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-8: 2rem;
  --radius-md: 8px;
  --radius-full: 9999px;
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-weight-medium: 500;
  --gap-default: var(--space-4);
}`);
const row = (kind, property, value, nodeId = "1:1") => ({ nodeId, node: "Card", kind, property, value });
const one = (rows, files = TOKENS, rulings = null) => matchRawValues({ rows, files, rulings }).items;

test("CIEDE2000 agrees with Sharma, Wu & Dalal's published test pairs", () => {
  assert.equal(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]).toFixed(4), "2.0425");
  assert.equal(deltaE2000([50, 2.5, 0], [73, 25, -18]).toFixed(4), "27.1492");
  assert.equal(deltaE2000([60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387]).toFixed(4), "1.2644");
});

test("a colour you can't tell apart from a token is built with it and listed (HT-104, HT-105)", () => {
  const [item] = one([row("colour", "fill", "#1B1A1AFF")]);
  assert.equal(item.status, "built");
  assert.equal(item.token, "--color-ink");
  assert.match(item.why, /ΔE 0\.\d/);
});

test("a slightly-off colour keeps its value and comes to the operator with the token suggested (HT-105)", () => {
  const [item] = one([row("colour", "fill", "#2F2F2FFF")]);
  assert.equal(item.status, "listed");
  assert.equal(item.reason, "slightly-off");
  assert.equal(item.token, null);
  assert.equal(item.suggestions[0].token, "--color-ink-soft");
});

test("a colour far from every token is listed as no close match, with the nearest two", () => {
  const [item] = one([row("colour", "fill", "#E5007AFF")]);
  assert.equal(item.reason, "no-match");
  assert.equal(item.suggestions.length, 2);
});

test("alpha must match too: the same colour at 60% is not the opaque token", () => {
  const [item] = one([row("colour", "fill", "#1A1A1A99")]);
  assert.equal(item.status, "listed");
});

test("an equal spacing is built with the token, px against rem at a 16px root, within half a pixel", () => {
  const [item] = one([row("spacing", "paddingTop", 15.99)]);
  assert.deepEqual([item.status, item.token], ["built", "--space-4"]);
});

test("a spacing between two steps keeps the exact number, listed with both neighbours (HT-106)", () => {
  const [item] = one([row("spacing", "gap", 12)]);
  assert.equal(item.status, "listed");
  assert.equal(item.reason, "between");
  assert.equal(item.token, null);
  assert.deepEqual(item.suggestions.map((s) => s.token), ["--space-2", "--space-4"]);
});

test("a spacing beyond the scale is listed with the nearest step", () => {
  const [item] = one([row("spacing", "gap", 80)]);
  assert.deepEqual([item.reason, item.suggestions.map((s) => s.token)], ["outside", ["--space-8"]]);
});

test("a value only matches tokens of its own kind: a 16px radius is not --space-4", () => {
  const [item] = one([row("radius", "cornerRadius", 16)]);
  assert.notEqual(item.token, "--space-4");
  assert.ok(item.suggestions.every((s) => s.token.startsWith("--radius")));
});

test("a pill radius maps to the full token", () => {
  const [item] = one([row("radius", "cornerRadius", 9999)]);
  assert.deepEqual([item.status, item.token], ["built", "--radius-full"]);
});

test("type matches per property: font size against font-size tokens, weight exactly", () => {
  const items = one([row("type", "fontSize", 14), row("type", "fontSize", 15), row("type", "fontWeight", 500), row("type", "fontWeight", 600)]);
  const by = (p, v) => items.find((i) => i.property === p && i.value === v);
  assert.deepEqual([by("fontSize", 14).status, by("fontSize", 14).token], ["built", "--font-size-sm"]);
  assert.deepEqual(by("fontSize", 15).suggestions.map((s) => s.token), ["--font-size-sm", "--font-size-md"]);
  assert.equal(by("fontWeight", 500).token, "--font-weight-medium");
  assert.equal(by("fontWeight", 600).status, "listed");
});

test("two tokens with the same value are a tie: listed with both, never picked", () => {
  const [item] = one([row("spacing", "gap", 16)], css(":root { --space-4: 1rem; --space-md: 16px; }"));
  assert.equal(item.reason, "tie");
  assert.deepEqual(item.suggestions.map((s) => s.token).sort(), ["--space-4", "--space-md"]);
});

test("an alias is not a second token: --gap-default resolves to --space-4 and is not a tie", () => {
  const [item] = one([row("spacing", "gap", 16)]);
  assert.deepEqual([item.status, item.token], ["built", "--space-4"]);
});

test("Tailwind v4 @theme is read as CSS custom properties", () => {
  const [item] = one([row("spacing", "gap", 16)], css("@import 'tailwindcss';\n@theme {\n  --spacing-4: 1rem;\n}"));
  assert.equal(item.token, "--spacing-4");
});

test("one row per kind and value, every layer that states it kept", () => {
  const items = one([row("spacing", "gap", 12, "1:1"), row("spacing", "paddingTop", 12, "2:2")]);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].layers.map((l) => l.nodeId), ["1:1", "2:2"]);
});

test("a ruling overrules: keep holds a clear match raw, use binds a listed value, a gone token is stale", () => {
  const rulings = `| kind | figma | ruling | code | note |
| --- | --- | --- | --- | --- |
| raw-colour | #1A1A1AFF | keep | | brand black stays |
| raw-spacing | 12px | use | --space-2 | |
| raw-spacing | 80px | use | --space-20 | |`;
  const result = matchRawValues({ rows: [row("colour", "fill", "#1A1A1AFF"), row("spacing", "gap", 12), row("spacing", "gap", 80)], files: TOKENS, rulings });
  const [colour, gap, wide] = result.items;
  assert.deepEqual([colour.status, colour.token], ["ruled", null]);
  assert.deepEqual([gap.status, gap.token], ["ruled", "--space-2"]);
  assert.equal(wide.stale, true);
  assert.deepEqual(result.findings.map((f) => f.code), ["RULING_STALE"]);
});

// The parent's constraint on HT-106: a listed value never stops a build — the build uses the raw value
// with a deviation row until it is ruled. `match` exits 0 on listed raw values alone.
test("listed raw values never fail the run: match --export exits 0 and prints them", () => {
  const dir = mkdtempSync(join(tmpdir(), "raw-"));
  writeFileSync(join(dir, "tokens.css"), TOKENS[0].text);
  const brief = { schema: "design-handoff", contentHash: "h" };
  writeFileSync(join(dir, "b.json"), JSON.stringify(brief));
  writeFileSync(join(dir, "b.link-run.json"), JSON.stringify({ schema: "design-handoff-link-run", schemaVersion: 1, brief: { contentHash: "h" },
    linkRun: { generatedBy: "design-handoff-script", designSystemExports: [], sources: [], findings: [] }, unboundValues: [row("spacing", "gap", 12), row("colour", "fill", "#2F2F2FFF")] }));
  let out = "";
  const code = matchCommand(["--export", join(dir, "b.json"), "--src", join(dir, "tokens.css")], { cwd: dir, stdout: { write: (s) => { out += s; } }, stderr: { write: (s) => { out += s; } } });
  assert.equal(code, 0, out);
  assert.match(out, /## Raw values/);
  assert.match(out, /Needs your call/);
});

test("a brief with no link-run list is refused, naming the script run that writes it", () => {
  const dir = mkdtempSync(join(tmpdir(), "raw-"));
  writeFileSync(join(dir, "b.json"), JSON.stringify({ schema: "design-handoff", contentHash: "h" }));
  writeFileSync(join(dir, "tokens.css"), ":root{}");
  let err = "";
  const code = matchCommand(["--export", join(dir, "b.json"), "--src", join(dir, "tokens.css")], { cwd: dir, stdout: { write() {} }, stderr: { write: (s) => { err += s; } } });
  assert.equal(code, 1);
  assert.match(err, /unboundValues/);
  assert.match(err, /design-handoff/);
});

// The worked example (HT-102 done-when): a real link-run brief from design-handoff-script and a small
// custom-properties file → a clear match built, a slightly-off colour listed with a suggestion, an
// in-between spacing listed with both neighbours.
test("worked example: fixtures/ht102-raw-values", () => {
  const dir = new URL("../fixtures/ht102-raw-values/", import.meta.url);
  const notes = JSON.parse(readFileSync(new URL("card.link-run.json", dir), "utf8"));
  const { items } = matchRawValues({ rows: notes.unboundValues, files: [{ path: "tokens.css", text: readFileSync(new URL("tokens.css", dir), "utf8") }] });
  const find = (kind, value) => items.find((i) => i.kind === kind && i.value === value);
  assert.deepEqual([find("colour", "#1A1A1AFF").status, find("colour", "#1A1A1AFF").token], ["built", "--color-ink"]);
  assert.deepEqual([find("colour", "#2F2F2FFF").reason, find("colour", "#2F2F2FFF").suggestions[0].token], ["slightly-off", "--color-ink-soft"]);
  assert.deepEqual(find("spacing", 12).suggestions.map((s) => s.token), ["--space-2", "--space-4"]);
  const expected = readFileSync(new URL("match.md", dir), "utf8");
  let out = "";
  matchCommand(["--export", "card.json", "--src", "tokens.css"], { cwd: new URL(".", dir).pathname, stdout: { write: (s) => { out += s; } }, stderr: { write() {} } });
  assert.equal(out, expected);
});

test("the skill says a listed raw value is built exact with a deviation row and never stops the build", () => {
  const skill = readFileSync(new URL("../skills/handoff-to-code/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /Build the exact value and\s+write a deviation row/);
  assert.match(skill, /never stop, never round/);
  assert.match(skill, /Listed raw values never fail `match` \(exit 0\)/);
});

test("the link-run schema takes the unboundValues list, and the worked example's file passes it", async () => {
  const { validateLinkRunJson } = await import("../src/link-run.mjs");
  const notes = JSON.parse(readFileSync(new URL("../fixtures/ht102-raw-values/card.link-run.json", import.meta.url), "utf8"));
  assert.deepEqual(validateLinkRunJson(notes).findings, []);
  assert.equal(validateLinkRunJson({ ...notes, unboundValues: [{ nodeId: "1:1", node: "x", kind: "shade", property: "fill", value: 1 }] }).ok, false);
});

test("a brief made with no Design System Handoff export validates as a set (companion null, HT-107)", async () => {
  const { spawnSync } = await import("node:child_process");
  const dir = new URL("../fixtures/ht102-raw-values/", import.meta.url).pathname;
  const run = spawnSync(process.execPath, [new URL("../bin/handoff-css.mjs", import.meta.url).pathname, "validate", "card.json", "card.md"], { cwd: dir, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});
