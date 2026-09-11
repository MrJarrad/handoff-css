// P16 — the consumer conformance check. One fixture per finding class, plus a
// clean file and the alias-hop case, all checked against the REAL v8b pair: a
// conformance tool whose fixtures are also hand-written proves nothing about
// the export it is supposed to police.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { dispatch } from "../src/cli.mjs";
import {
  aliasGraph, bindingsFromHandoff, conform, exportNames, FINDINGS, renderMarkdown, resolveName,
  samplePixels, tokenizeCss,
} from "../src/conform.mjs";
import { configSchema } from "../src/config.mjs";
import { parseHandoffMarkdown } from "../src/validate-handoff-md.mjs";

const DIR = new URL("../fixtures/jhd-v8b-2026-09-10/", import.meta.url).pathname;
const CONFORM = new URL("../fixtures/conform/", import.meta.url).pathname;

const doc = () => JSON.parse(readFileSync(path.join(DIR, "export.json"), "utf8"));
const handoff = () => parseHandoffMarkdown(readFileSync(path.join(DIR, "design-handoff-block-navigation.md"), "utf8"));
const tokensCss = () => readFileSync(path.join(DIR, "expected/tokens.generated.css"), "utf8");
const fixture = (name) => ({ path: name, text: readFileSync(path.join(CONFORM, name), "utf8") });

const check = (...names) =>
  conform({ doc: doc(), handoff: handoff(), tokensCss: tokensCss(), files: names.map(fixture) });

// 0.3.2 — `conform` reads bindings identically off the plugin's new
// single-meaning-sigil export (v2) as off the legacy one (v1). Both live
// under jhd-v9b, sharing one export.json/tokens.generated.css pair.
const V9B = new URL("../fixtures/jhd-v9b-2026-09-11/", import.meta.url).pathname;
const v9bDoc = () => JSON.parse(readFileSync(path.join(V9B, "export.json"), "utf8"));
const v9bTokensCss = () => readFileSync(path.join(V9B, "expected/tokens.generated.css"), "utf8");
const v9bHandoff = (v) =>
  parseHandoffMarkdown(readFileSync(path.join(V9B, `design-handoff-block-navigation${v}.md`), "utf8"));
const v9bCheck = (v, ...names) => conform({
  doc: v9bDoc(), handoff: v9bHandoff(v), tokensCss: v9bTokensCss(), files: names.map(fixture),
});

test("conform reads bindings from the v2 (`†`-sigil) brief identically to v1", () => {
  const v1 = v9bCheck("", "alias-hop.css", "clean.css", "unknown-name.css");
  const v2 = v9bCheck("-v2", "alias-hop.css", "clean.css", "unknown-name.css");
  assert.deepEqual(v2.findings.map((f) => f.code), v1.findings.map((f) => f.code));
  assert.deepEqual(v1.findings.map((f) => f.code), ["UNKNOWN_NAME"]);
});

test("UNMAPPED_BINDING fires the same way whether the export stopped declaring a v1 or v2 binding", () => {
  const forVersion = (v) => {
    const parsed = v9bHandoff(v);
    const target = parsed.tokens.find((t) => t.token === "device/screen-height/full");
    target.web = "--device-screen-height-forever";
    return conform({ doc: v9bDoc(), handoff: parsed, tokensCss: v9bTokensCss(), files: [fixture("clean.css")] });
  };
  const v1 = forVersion("");
  const v2 = forVersion("-v2");
  assert.deepEqual(v2.findings.map((f) => f.code), v1.findings.map((f) => f.code));
  assert.deepEqual(v1.findings.map((f) => f.code), ["UNMAPPED_BINDING"]);
});

test("a clean stylesheet has no findings at all", () => {
  const { findings, summary } = check("clean.css");
  assert.deepEqual(findings, [], findings.map((f) => `${f.line} ${f.code}`).join("; "));
  assert.equal(summary.red, 0);
  assert.equal(summary.amber, 0);
});

test("the alias hop resolves — `--screen-height-full` is never UNKNOWN_NAME", () => {
  const { findings } = check("alias-hop.css");
  assert.deepEqual(findings, [], findings.map((f) => `${f.code} ${f.name}`).join("; "));
  // The hop itself, asserted directly: two hops, ending at the export's name.
  const graph = aliasGraph(tokensCss());
  assert.equal(resolveName("--screen-height-full", graph), "--device-screen-height-full");
  assert.equal(resolveName("--height-screen-full", graph), "--device-screen-height-full");
  assert.ok(exportNames(doc()).has("--device-screen-height-full"));
});

test("an unresolvable name is UNKNOWN_NAME, red, at its line", () => {
  const { findings, summary } = check("unknown-name.css");
  assert.equal(findings.length, 1);
  const [f] = findings;
  assert.equal(f.code, "UNKNOWN_NAME");
  assert.equal(f.severity, "red");
  assert.equal(f.line, 2);
  assert.equal(f.name, "--screen-height-huge");
  assert.equal(summary.red, 1);
});

test("a name the stylesheet declares itself is LOCAL_ONLY, amber", () => {
  const { findings } = check("local-only.css");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "LOCAL_ONLY");
  assert.equal(findings[0].severity, "amber");
  assert.equal(findings[0].line, 4);
});

test("a device sample is red, a token px is amber, an @media breakpoint is exempt", () => {
  const { findings } = check("sample-px-literal.css");
  assert.deepEqual(
    findings.map((f) => [f.code, f.severity, f.line]),
    [["SAMPLE_PX_LITERAL", "red", 5], ["SAMPLE_PX_LITERAL", "amber", 6]],
    findings.map((f) => `${f.line} ${f.severity} ${f.message}`).join("\n"),
  );
  assert.match(findings[0].message, /812px is a device\/viewport sample/);
  // 768 is a breakpoint and appears only in the @media prelude: never flagged.
  assert.ok(samplePixels(doc()).device.has(768));
  assert.ok(!findings.some((f) => f.message.includes("768px")));
});

test("the device set is viewport dimensions only — a mode named `200` is not one", () => {
  const { device, token } = samplePixels(doc());
  assert.deepEqual([...device].sort((a, b) => a - b), [375, 720, 768, 812, 1024, 1080, 1280, 1920]);
  assert.ok(token.has(24), "a real token px sample is in the token set");
  assert.ok(!device.has(200), "`icon-dimension/height` at mode 200 is not a device dimension");
});

test("column maths where the handoff states col-span N/12 is GRID_ARITHMETIC, red", () => {
  const { findings, summary } = check("grid-arithmetic.css");
  const grid = findings.filter((f) => f.code === "GRID_ARITHMETIC");
  assert.deepEqual(grid.map((f) => f.line), [5, 7]);
  assert.equal(grid[0].severity, "red");
  assert.match(grid[0].message, /Build standard 5 names a grid container/);
  assert.ok(summary.red >= 2);
  // The handoff is what states the 12: nothing here is hard-coded.
  assert.deepEqual([...bindingsFromHandoff(handoff()).columns], [12]);
});

test("a `⚠ placeholder` string shipped as content is PLACEHOLDER_COPY, amber", () => {
  const { findings } = check("placeholder-copy.css");
  const hit = findings.find((f) => f.code === "PLACEHOLDER_COPY");
  assert.ok(hit, findings.map((f) => f.code).join("; "));
  assert.equal(hit.severity, "amber");
  assert.equal(hit.line, 3);
  assert.match(hit.message, /the design has not stated this copy/);
});

test("a binding the generated tokens never declare is UNMAPPED_BINDING, amber", () => {
  const parsed = handoff();
  const target = parsed.tokens.find((t) => t.token === "device/screen-height/full");
  target.web = "--device-screen-height-forever"; // the export stops declaring it
  const { findings } = conform({ doc: doc(), handoff: parsed, tokensCss: tokensCss(), files: [fixture("clean.css")] });
  const hit = findings.find((f) => f.code === "UNMAPPED_BINDING");
  assert.ok(hit);
  assert.equal(hit.severity, "amber");
  assert.equal(hit.line, target.line);
  assert.match(hit.message, /bind nothing until the export is fixed/);
});

test("every fixture in fixtures/conform is covered by a named class or is clean", () => {
  const files = readdirSync(CONFORM).filter((f) => f.endsWith(".css"));
  assert.deepEqual(files.sort(), [
    "alias-hop.css", "clean.css", "grid-arithmetic.css", "local-only.css",
    "placeholder-copy.css", "sample-px-literal.css", "unknown-name.css",
  ]);
  // Every code except UNMAPPED_BINDING (a handoff-side finding) has a fixture.
  const codes = new Set(check(...files).findings.map((f) => f.code));
  for (const code of Object.keys(FINDINGS)) {
    if (code === "UNMAPPED_BINDING") continue;
    assert.ok(codes.has(code), `no fixture raises ${code}`);
  }
});

test("the real v8b styles.css smoke: one red, and it is the font the package asks consumers to supply", () => {
  const { findings, summary } = conform({
    doc: doc(),
    handoff: handoff(),
    tokensCss: tokensCss(),
    files: [{ path: "styles.css", text: readFileSync(path.join(DIR, "styles.css"), "utf8") }],
  });
  assert.equal(summary.red, 1, findings.filter((f) => f.severity === "red").map((f) => `${f.line} ${f.code} ${f.name}`).join("\n"));
  const [red] = findings.filter((f) => f.severity === "red");
  assert.equal(red.code, "UNKNOWN_NAME");
  assert.equal(red.name, "--font-suisse");
  assert.equal(summary.byCode.GRID_ARITHMETIC, 0, "the house stylesheet does no column maths");
});

test("the same smoke with `--font-suisse` allowed is 0 red — `allowNames`", () => {
  // `--font-suisse` is the one name in the house stylesheet that no export can
  // ever declare: the package tells consumers to supply their own font face.
  // An allowlist is how a consumer says that out loud once, instead of
  // carrying a permanent red it has learned to ignore.
  const { findings, summary } = conform({
    doc: doc(),
    handoff: handoff(),
    tokensCss: tokensCss(),
    files: [{ path: "styles.css", text: readFileSync(path.join(DIR, "styles.css"), "utf8") }],
    allowNames: ["--font-suisse"],
  });
  assert.equal(summary.red, 0, findings.filter((f) => f.severity === "red").map((f) => `${f.line} ${f.code} ${f.name}`).join("\n"));
  assert.deepEqual(findings.filter((f) => f.name === "--font-suisse"), []);
});

test("an allowed name that is declared locally is still LOCAL_ONLY, not silence", () => {
  // The allowlist answers ONE question — "this name comes from outside the
  // export" — and is not a mute button for every finding that mentions it.
  const { findings } = conform({
    doc: doc(), handoff: handoff(), tokensCss: tokensCss(),
    files: [fixture("local-only.css")],
    allowNames: [...new Set(check("local-only.css").findings.map((f) => f.name))],
  });
  assert.deepEqual(findings.map((f) => f.code), check("local-only.css").findings.map((f) => f.code));
});

test("`--allow-name` is repeatable on the CLI and takes a `--`-prefixed value", async () => {
  const sink = () => {
    const chunks = [];
    return { write: (s) => chunks.push(s), get text() { return chunks.join(""); } };
  };
  const args = (...extra) => [
    "conform",
    "--export", path.join(DIR, "export.json"),
    "--handoff", path.join(DIR, "design-handoff-block-navigation.md"),
    "--tokens", path.join(DIR, "expected/tokens.generated.css"),
    "--css", path.join(DIR, "styles.css"),
    ...extra,
  ];

  assert.equal(await dispatch(args("--json"), { stdout: sink(), stderr: sink() }), 1);

  const stdout = sink();
  assert.equal(
    await dispatch(args("--allow-name", "--font-suisse", "--allow-name", "--font-nothing", "--json"),
      { stdout, stderr: sink() }),
    0,
  );
  const parsed = JSON.parse(stdout.text);
  assert.equal(parsed.summary.red, 0);
  assert.deepEqual(parsed.findings.filter((f) => f.name === "--font-suisse"), []);
});

test("tokenizeCss ignores comments, so prose about px and col-unit is not a finding", () => {
  const { pxLiterals, usages } = tokenizeCss("/* 812px, --nav-col-unit */\n.a { height: var(--device-width); }\n");
  assert.deepEqual(pxLiterals, []);
  assert.deepEqual(usages, [{ name: "--device-width", line: 2 }]);
});

test("the markdown report names the file, the code and the line", () => {
  const out = renderMarkdown(check("unknown-name.css"));
  assert.match(out, /\*\*1 red\*\*/);
  assert.match(out, /## unknown-name\.css/);
  assert.match(out, /`UNKNOWN_NAME` line 2/);
  assert.match(renderMarkdown(check("clean.css")), /No findings/);
});

test("`handoff-css conform` exits 1 on red, 0 on clean, and --json is machine-readable", async () => {
  const sink = () => {
    const chunks = [];
    return { write: (s) => chunks.push(s), get text() { return chunks.join(""); } };
  };
  const args = (css, ...extra) => [
    "conform",
    "--export", path.join(DIR, "export.json"),
    "--handoff", path.join(DIR, "design-handoff-block-navigation.md"),
    "--tokens", path.join(DIR, "expected/tokens.generated.css"),
    "--css", path.join(CONFORM, css),
    ...extra,
  ];

  assert.equal(await dispatch(args("clean.css"), { stdout: sink(), stderr: sink() }), 0);

  const stdout = sink();
  assert.equal(await dispatch(args("unknown-name.css", "--json"), { stdout, stderr: sink() }), 1);
  const parsed = JSON.parse(stdout.text);
  assert.equal(parsed.summary.red, 1);
  assert.equal(parsed.findings[0].code, "UNKNOWN_NAME");

  const stderr = sink();
  assert.equal(await dispatch(["conform"], { stdout: sink(), stderr }), 1);
  assert.match(stderr.text, /--export <json> --handoff <md>/);
});

test("`conform.allowNames` in the config is the same statement as the flag", async () => {
  const sink = () => {
    const chunks = [];
    return { write: (s) => chunks.push(s), get text() { return chunks.join(""); } };
  };
  const configPath = path.join(CONFORM, "allow-font.config.mjs");
  const stdout = sink();
  const code = await dispatch([
    "conform",
    "--export", path.join(DIR, "export.json"),
    "--handoff", path.join(DIR, "design-handoff-block-navigation.md"),
    "--tokens", path.join(DIR, "expected/tokens.generated.css"),
    "--css", path.join(DIR, "styles.css"),
    "--config", configPath,
    "--json",
  ], { stdout, stderr: sink() });
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout.text).summary.red, 0);
});

test("the config's `conform` block is a valid config block", () => {
  // `schema/config.schema.json` is the single statement of what a config may
  // contain, and `additionalProperties: false` at the root means a key the
  // schema does not know is a hard failure — so `conform` has to be IN it.
  const { properties } = configSchema();
  assert.deepEqual(Object.keys(properties.conform.properties), ["allowNames"]);
  assert.equal(properties.conform.properties.allowNames.type, "array");
});
