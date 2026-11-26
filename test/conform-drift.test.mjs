// Component token drift: a component rule that reads a different token than the
// design system's export binds. Proven on three real code-only overrides (an Action
// label, a switch inactive half, a skip-link ring) against the real export.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

import { dispatch } from "../src/cli.mjs";
import { conform, FINDINGS } from "../src/conform.mjs";
import { componentDrift, parseDeclarations, resolveBindings } from "../src/conform-drift.mjs";

const HERE = new URL("../fixtures/ht137-drift/", import.meta.url).pathname;
const EXPORT = new URL("../fixtures/ht134-contrast/ds-export-21-nov.json.gz", import.meta.url).pathname;
const doc = () => JSON.parse(gunzipSync(readFileSync(EXPORT)).toString("utf8"));
const bindings = () => JSON.parse(readFileSync(path.join(HERE, "action-bindings.json"), "utf8"));
const css = (name) => ({ path: name, text: readFileSync(path.join(HERE, name), "utf8") });
// Aliases the generated sheet would state; the fixtures need none.
const run = (name) => componentDrift({ doc: doc(), bindings: bindings(), files: [css(name)], graph: new Map() });

test("parseDeclarations keeps the nesting stack and the line of each declaration", () => {
  const out = parseDeclarations("a {\n  .x & { color: red; }\n}\n");
  assert.deepEqual(out.map((d) => [d.property, d.value, d.line, d.stack.join(" > ")]), [["color", "red", 2, "a > .x &"]]);
});

test("resolveBindings turns variable names into the export's CSS names, and refuses an unknown variable", () => {
  const r = resolveBindings(doc(), bindings());
  assert.equal(r.find((b) => b.id === "action-label").names[0], "--content-action-primary");
  assert.throws(() => resolveBindings(doc(), { bindings: [{ id: "x", selectors: ["a"], property: "color", variable: "color/nope" }] }), /color\/nope/);
});

test("the three code-only overrides are COMPONENT_TOKEN_DRIFT, red, naming read and bound token", () => {
  const drift = run("code-only-overrides.css").filter((f) => f.code === "COMPONENT_TOKEN_DRIFT");
  const by = (id) => drift.find((f) => f.binding === id);
  assert.deepEqual(drift.map((f) => f.binding).sort(), ["action-focus-ring", "action-label", "switch-inactive-half"]);
  assert.deepEqual([by("action-label").reads, by("action-label").binds], [["--content-focused-dark"], ["--content-action-primary"]]);
  assert.deepEqual([by("switch-inactive-half").reads, by("switch-inactive-half").binds], [["--color-palette-malibu-600"], ["--content-action-secondary"]]);
  assert.deepEqual([by("action-focus-ring").reads, by("action-focus-ring").binds], [["--border-focused-darker"], ["--border-focused-dark"]]);
  for (const f of drift) assert.equal(f.severity, "red");
  assert.deepEqual(drift.map((f) => f.line).sort((a, b) => a - b), [6, 14, 21]);
});

test("a rule that reads the bound token, bare or alias-resolved, is not drift; other components are out of scope", () => {
  const found = run("conforming.css");
  assert.deepEqual(found.filter((f) => f.severity === "red"), []);
});

test("opacity-modified use of the bound token is amber COMPONENT_TOKEN_MODIFIED, not red", () => {
  const found = run("conforming.css");
  assert.deepEqual(found.map((f) => [f.code, f.severity, f.binding]), [["COMPONENT_TOKEN_MODIFIED", "amber", "switch-inactive-half"]]);
});

test("an alias that resolves to the bound export name is legitimate", () => {
  const found = componentDrift({
    doc: doc(), bindings: bindings(), graph: new Map([["--my-label", "--content-action-primary"]]),
    files: [{ path: "a.css", text: "@utility action-base { color: var(--my-label); }" }],
  });
  assert.deepEqual(found, []);
});

test("a raw literal where a token is bound is red; a name the export never states is CODE_ONLY_TOKEN amber", () => {
  const found = componentDrift({
    doc: doc(), bindings: bindings(), graph: new Map(),
    files: [{ path: "a.css", text: "@utility action-base { color: #1c6ca0; }\n@utility action-base { color: var(--local-ink); }" }],
  });
  assert.deepEqual(found.map((f) => [f.code, f.severity]), [["COMPONENT_TOKEN_DRIFT", "red"], ["CODE_ONLY_TOKEN", "amber"]]);
});

test("@apply utilities resolve to the token they bind", () => {
  const found = componentDrift({
    doc: doc(), bindings: bindings(), graph: new Map(),
    files: [{ path: "a.css", text: "@utility action-base { @apply text-content-focused-dark; }" }],
  });
  assert.deepEqual(found.map((f) => [f.code, f.reads]), [["COMPONENT_TOKEN_DRIFT", ["--content-focused-dark"]]]);
});

test("conform() carries the drift findings into its report and exit-worthy summary", () => {
  assert.equal(FINDINGS.COMPONENT_TOKEN_DRIFT, "red");
  const r = conform({ doc: doc(), handoff: undefined, tokensCss: "", files: [css("code-only-overrides.css")], bindings: bindings(), allowNames: [] });
  assert.equal(r.summary.byCode.COMPONENT_TOKEN_DRIFT, 3);
  assert.ok(r.summary.red >= 3);
});

test("CLI: conform --bindings runs without --handoff, lists the drift, exits 1", async () => {
  let out = "";
  const code = await dispatch(["conform", "--export", EXPORT,
    "--bindings", path.join(HERE, "action-bindings.json"), "--css", path.join(HERE, "code-only-overrides.css")],
  { stdout: { write: (s) => (out += s) }, stderr: { write: (s) => (out += s) } });
  assert.equal(code, 1);
  assert.match(out, /COMPONENT_TOKEN_DRIFT/);
  assert.match(out, /reads `--content-focused-dark`.*binds `--content-action-primary`/);
});

test("a name the export states is never followed through the generated alias graph", () => {
  // The generated sheet aliases the semantic name to a primitive inside a mode block.
  const found = componentDrift({
    doc: doc(), bindings: bindings(), graph: new Map([["--content-action-primary", "--color-palette-malibu-600"]]),
    files: [{ path: "a.css", text: "@utility action-base { color: var(--content-action-primary); }" }],
  });
  assert.deepEqual(found, []);
});

test("CLI --drift-only reports the drift codes and nothing else", async () => {
  let out = "";
  await dispatch(["conform", "--export", EXPORT, "--bindings", path.join(HERE, "action-bindings.json"), "--drift-only",
    "--css", path.join(HERE, "code-only-overrides.css")], { stdout: { write: (s) => (out += s) }, stderr: { write: (s) => (out += s) } });
  assert.match(out, /3 red/);
  assert.doesNotMatch(out, /LOCAL_ONLY|UNKNOWN_NAME/);
});

test("a raw literal beside the bound token is surfaced as CODE_ONLY_TOKEN alongside the modified use", () => {
  const found = componentDrift({
    doc: doc(), bindings: bindings(), graph: new Map(),
    files: [{ path: "a.css", text: "@utility action-base { color: linear-gradient(var(--content-action-primary), #f00); }" }],
  });
  assert.deepEqual(found.map((f) => [f.code, f.severity, f.reads]), [
    ["COMPONENT_TOKEN_MODIFIED", "amber", ["--content-action-primary"]],
    ["CODE_ONLY_TOKEN", "amber", ["#f00"]],
  ]);
});

test("a raw literal beside a non-colour token (a ring width) is still a raw literal where a token is bound: red", () => {
  const found = componentDrift({
    doc: doc(), bindings: bindings(), graph: new Map(),
    files: [{ path: "a.css", text: "@utility action-focus-ring { box-shadow: 0 0 0 var(--border-200) #f00; }" }],
  });
  assert.deepEqual(found.map((f) => [f.code, f.severity, f.binding]), [["COMPONENT_TOKEN_DRIFT", "red", "action-focus-ring"]]);
});

test("a var() fallback and a colour function that reads the token are not literals", () => {
  const found = componentDrift({
    doc: doc(), bindings: bindings(), graph: new Map(),
    files: [{ path: "a.css", text: "@utility action-focus-ring { box-shadow: 0 0 0 var(--border-200) var(--border-focused-dark, #f00); }\n@utility action-base { color: color-mix(in oklch, rgb(from var(--content-action-primary) r g b / 0.5), transparent); }" }],
  });
  assert.deepEqual(found.map((f) => [f.code, f.reads]), [["COMPONENT_TOKEN_MODIFIED", ["--content-action-primary"]]]);
});
