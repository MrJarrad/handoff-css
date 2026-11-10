// HT-102: values a layer states as plain numbers (not bound to a Figma variable), matched to the
// project's own coded tokens. Locks: HT-104 a clear match is built with the token and listed; HT-105
// colour maps only when the two can't be told apart, slightly off is listed with the token suggested;
// HT-106 a number between two steps keeps its exact value and is listed with both neighbours.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { deltaE2000, matchRawValues, parseColour, renderRawValues } from "../src/raw-values.mjs";
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

test("HT-110: two tokens with the same value are a tie: built with the name-order pick, losers listed", () => {
  const [item] = one([row("spacing", "gap", 16)], css(":root { --space-md: 16px; --space-4: 1rem; }"));
  assert.deepEqual([item.status, item.reason, item.token], ["built", "tie-picked", "--space-4"]);
  assert.match(item.why, /2 tokens state 16px; picked --space-4 \(closest, then name order; also --space-md\)/);
  assert.deepEqual(item.suggestions.map((s) => s.token), ["--space-md"]);
});

test("HT-110: the closer token wins a near-tie before name order is consulted", () => {
  const [item] = one([row("spacing", "gap", 16)], css(":root { --space-a: 16.4px; --space-b: 16px; }"));
  assert.deepEqual([item.token, item.reason], ["--space-b", "tie-picked"]);
  assert.deepEqual(item.suggestions.map((s) => s.token), ["--space-a"]);
});

test("HT-110: colours that can't be told apart tie the same way", () => {
  const [item] = one([row("colour", "fill", "#112233")], css(":root { --color-z: #112233; --color-b: #112233; }"));
  assert.deepEqual([item.status, item.reason, item.token], ["built", "tie-picked", "--color-b"]);
  assert.deepEqual(item.suggestions.map((s) => s.token), ["--color-z"]);
});

test("HT-110: a ruling still overrides the pick", () => {
  const rulings = "| kind | figma | ruling | code | note |\n|---|---|---|---|---|\n| raw-spacing | 16px | use | --space-md | n |";
  const [item] = one([row("spacing", "gap", 16)], css(":root { --space-4: 1rem; --space-md: 16px; }"), rulings);
  assert.equal(item.token, "--space-md");
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

// Review round 1 (red): Tailwind v4 pairs each text size with its own line height, `--text-sm--line-height`.
test("Tailwind v4's --text-*--line-height is a line height, not a font size", () => {
  const files = css("@theme {\n  --text-sm: 0.875rem;\n  --text-sm--line-height: 1.25rem;\n  --text-base: 1rem;\n  --text-base--line-height: 1.5rem;\n  --text-sm--letter-spacing: 0.01rem;\n}");
  const items = one([row("type", "fontSize", 20), row("type", "lineHeight", 20), row("type", "fontSize", 14), row("type", "letterSpacing", 0.16)], files);
  const by = (p, v) => items.find((i) => i.property === p && i.value === v);
  assert.ok(by("fontSize", 20).suggestions.every((s) => !s.token.includes("line-height")), JSON.stringify(by("fontSize", 20)));
  assert.notEqual(by("fontSize", 20).token, "--text-sm--line-height");
  assert.deepEqual([by("lineHeight", 20).status, by("lineHeight", 20).token], ["built", "--text-sm--line-height"]);
  assert.equal(by("fontSize", 14).token, "--text-sm");
  assert.equal(by("letterSpacing", 0.16).token, "--text-sm--letter-spacing");
});

// Review round 1 (amber): hsl() and oklch() colours are read; a colour the pass cannot read is named, never dropped.
test("hsl() and oklch() colour tokens are read", () => {
  assert.deepEqual(parseColour("hsl(0 0% 10.2%)").map((c) => Math.round(c * 255)), [26, 26, 26, 255]);
  assert.deepEqual(parseColour("hsla(210, 100%, 50%, 0.5)").map((c) => Math.round(c * 255)), [0, 128, 255, 128]);
  assert.deepEqual(parseColour("oklch(62.8% 0.2577 29.23)").slice(0, 3).map((c) => Math.round(c * 255)), [255, 0, 0]);
  const [item] = one([row("colour", "fill", "#1A1A1AFF")], css(":root { --ink: oklch(0.2178 0 0); }"));
  assert.deepEqual([item.status, item.token], ["built", "--ink"]);
});

test("a colour token the pass cannot read is named in the report, not reported as no colour token", () => {
  const result = matchRawValues({ rows: [row("colour", "fill", "#1A1A1AFF")], files: css(":root { --ink: color-mix(in srgb, black 90%, white); --paper: lab(100 0 0); }") });
  assert.notEqual(result.items[0].why, "the code declares no colour token");
  assert.match(result.items[0].why, /could not read 2 colour tokens/);
  assert.deepEqual(result.unreadable, ["--ink", "--paper"]);
  assert.match(renderRawValues(result), /Not read: --ink, --paper/);
});

// HT-109: hue units.
const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-3);
test("HT-109: hsl() hues in turn, rad and grad read as the same colour as degrees", () => {
  const cyan = parseColour("hsl(180deg 100% 50%)");
  for (const h of ["0.5turn", "3.14159265rad", "200grad", "180", "-180deg", "540deg"]) {
    assert.ok(near(parseColour(`hsl(${h} 100% 50%)`), cyan), h);
  }
  assert.ok(near(parseColour("hsla(0.5turn, 100%, 50%, 0.5)").slice(0, 3), cyan.slice(0, 3)));
});

test("HT-109: oklch() hues in turn, rad and grad read as the same colour as degrees", () => {
  const ref = parseColour("oklch(0.7 0.15 90deg)");
  for (const h of ["0.25turn", "1.5707963rad", "100grad", "90"]) {
    assert.ok(near(parseColour(`oklch(0.7 0.15 ${h})`), ref), h);
  }
});

test("HT-109: a turn hue is matched to its token end to end", () => {
  const [item] = one([row("colour", "fill", "#00FFFF")], css(":root { --color-c: hsl(0.5turn 100% 50%); }"));
  assert.deepEqual([item.status, item.token], ["built", "--color-c"]);
});
