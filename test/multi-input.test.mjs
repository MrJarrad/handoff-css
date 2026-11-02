// HT-24 / HT-6 (d) — one design system split across Figma files: the variables
// of each file arrive in that file's own Design System Handoff export, and an
// alias to a library variable carries the library's key (`VariableID:<key>/…`)
// instead of a local id. Given every export, the generator joins them by
// variable key and emits one token file, aliases kept as `var()`.
//
// The fixture is the real 29 Oct export cut in two the way Figma would cut it:
// the primitive collections in a "library" file, everything else in a file
// that uses that library. The expected output is the generator's own output
// for the uncut export — an independent source, not a value copied here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { generate, generateSet } from "../src/index.mjs";
import preset from "../presets/jhd.config.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "jhd-v19-2026-10-29");
const exportText = gunzipSync(readFileSync(path.join(dir, "design-system-handoff.json.gz"))).toString("utf8");
const whole = () => JSON.parse(exportText);

const LIBRARY = new Set(["text-primitives", "core", "color-primitives"]);

/** Cut the export into a library file and a file that uses it, as Figma would export each. */
export function split(doc = whole()) {
  const library = { ...doc, collections: doc.collections.filter((c) => LIBRARY.has(c.name)),
    documentName: "Library", artifactFilename: "library-design-system-handoff" };
  // Styles and their sheets are defined in the library; the product file holds none of its own.
  const user = { ...doc, collections: doc.collections.filter((c) => !LIBRARY.has(c.name)),
    styles: Object.fromEntries(Object.keys(doc.styles).map((t) => [t, []])), styleSummaries: [], cssCustomPropertySheets: [],
    documentName: "Product", artifactFilename: "product-design-system-handoff" };
  const keyOf = new Map(library.collections.flatMap((c) => c.variables.map((v) => [v.id, v.key])));
  const remote = (id) => (keyOf.has(id) ? `VariableID:${keyOf.get(id)}/${id.slice("VariableID:".length)}` : id);
  user.collections = JSON.parse(JSON.stringify(user.collections), (k, v) => {
    if (v && typeof v === "object" && typeof v.variableId === "string" && keyOf.has(v.variableId)) return { ...v, variableId: remote(v.variableId), remote: true };
    if (v && typeof v === "object" && v.type === "VARIABLE_ALIAS" && keyOf.has(v.id)) return { ...v, id: remote(v.id) };
    return v;
  });
  return { library, user };
}

// The header names the source export(s); everything else must be identical.
const body = (css) => css.replace(/^ +(Source|Exported|State): .*$/gm, "");

test("two exports of one split design system generate the same tokens as the uncut export", () => {
  const { library, user } = split();
  const expected = generate(whole(), preset, { handAuthoredCss: "" });
  const merged = generateSet([library, user], preset, { handAuthoredCss: "" });
  assert.equal(body(merged.tokensCss), body(expected.tokensCss));
});

test("the product file alone cannot be generated — its library's variables are not in it", () => {
  const { user } = split();
  assert.throws(() => generate(user, preset, { handAuthoredCss: "" }), /not in export/);
});

test("the theme and style classes of a split design system match the uncut export too", () => {
  const { library, user } = split();
  const expected = generate(whole(), preset, { handAuthoredCss: "" });
  const merged = generateSet([library, user], preset, { handAuthoredCss: "" });
  assert.equal(body(merged.themeCss), body(expected.themeCss));
  assert.equal(body(merged.stylesCss ?? ""), body(expected.stylesCss ?? ""));
});

test("one variable key stated two ways in two exports stops the run, naming both files", () => {
  const { library, user } = split();
  const copy = structuredClone(library.collections.find((c) => c.name === "core"));
  copy.variables = [{ ...copy.variables[0], modes: copy.variables[0].modes.map((m) => ({ ...m, raw: 12345, alias: undefined })) }];
  user.collections.push(copy);
  assert.throws(() => generateSet([library, user], preset), (err) =>
    /MERGE_KEY_CONFLICT/.test(err.message) && err.message.includes("library-design-system-handoff") && err.message.includes("product-design-system-handoff"));
});

test("two different variables claiming one CSS name stop the run", () => {
  const { library, user } = split();
  const taken = library.collections[0].variables[0];
  user.collections[0].variables[0] = { ...user.collections[0].variables[0], codeSyntax: { ...user.collections[0].variables[0].codeSyntax, WEB: { value: taken.codeSyntax.WEB.value, source: "manual" } } };
  assert.throws(() => generateSet([library, user], preset), new RegExp(`MERGE_NAME_COLLISION: ${taken.codeSyntax.WEB.value}`));
});

test("the same export given twice stops the run", () => {
  const { library } = split();
  assert.throws(() => generateSet([library, structuredClone(library)], preset), /MERGE_SAME_EXPORT: library-design-system-handoff/);
});

test("one export through generateSet is exactly generate", () => {
  const a = generate(whole(), preset, { handAuthoredCss: "" });
  const b = generateSet([whole()], preset, { handAuthoredCss: "" });
  assert.equal(b.tokensCss, a.tokensCss);
  assert.equal(b.report, a.report);
});

// --- the command line -------------------------------------------------------
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dispatch } from "../src/cli.mjs";

const sink = () => { const out = { text: "", write(s) { out.text += s; return true; } }; return out; };
/** A consuming repo holding both files' exports; outputs land in a temp dir, never in this tree. */
function splitConsumer() {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-multi-"));
  const { library, user } = split();
  mkdirSync(path.join(cwd, "design"), { recursive: true });
  writeFileSync(path.join(cwd, "design", "library.json"), JSON.stringify(library));
  writeFileSync(path.join(cwd, "design", "product.json"), JSON.stringify(user));
  writeFileSync(path.join(cwd, "styles.css"), "");
  const presetUrl = new URL("../presets/jhd.config.mjs", import.meta.url).href;
  writeFileSync(path.join(cwd, "handoff.config.mjs"),
    `import preset from ${JSON.stringify(presetUrl)};\nexport default { ...preset, paths: { ...preset.paths, input: "design/library.json", handAuthored: "styles.css" } };\n`);
  return cwd;
}

test("--input given once per file writes one token file, joined by key", async () => {
  const cwd = splitConsumer();
  const stdout = sink();
  const code = await dispatch(["--config", "handoff.config.mjs", "--input", "design/library.json", "--input", "design/product.json"], { cwd, stdout, stderr: sink() });
  assert.equal(code, 0);
  const expected = generate(whole(), preset, { handAuthoredCss: "" });
  assert.equal(body(readFileSync(path.join(cwd, preset.paths.out), "utf8")), body(expected.tokensCss));
  assert.match(stdout.text, /inputs +2 \(library-design-system-handoff, product-design-system-handoff\)/);
});

test("a config may name every file's export as a list", async () => {
  const cwd = splitConsumer();
  writeFileSync(path.join(cwd, "handoff.config.mjs"), readFileSync(path.join(cwd, "handoff.config.mjs"), "utf8")
    .replace('input: "design/library.json"', 'input: ["design/library.json", "design/product.json"]'));
  assert.equal(await dispatch(["--config", "handoff.config.mjs"], { cwd, stdout: sink(), stderr: sink() }), 0);
  assert.equal(await dispatch(["--config", "handoff.config.mjs", "--check"], { cwd, stdout: sink(), stderr: sink() }), 0);
});
