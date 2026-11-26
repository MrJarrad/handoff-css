// HT-138: `handoff-css bindings` — which components and instances bind a variable, by which
// property, read from the layer export. Expected rows are counted from the export's own
// `tokenBindings` by hand (see the fixture README line), not recomputed with the module's walk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dispatch } from "../src/cli.mjs";
import { bindingMap } from "../src/bindings.mjs";
import { makeZip } from "./bindings-zip.mjs";

const fx = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const layerPath = path.join(fx, "jhd-v18-placed-2026-11-08", "design-handoff-mediarow.json.gz");
const dsPath = path.join(fx, "ht134-contrast", "ds-export-21-nov.json.gz");
const gz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString("utf8"));
const layer = gz(layerPath);

test("a colour variable: the one instance that paints with it, by property", () => {
  const { variables } = bindingMap([layer], { variables: ["color/background/default/primary"] });
  const [v] = variables;
  assert.equal(v.consumers.length, 1);
  assert.deepEqual(
    { nodeId: v.consumers[0].nodeId, property: v.consumers[0].property, component: v.consumers[0].component, instance: v.consumers[0].instance?.nodeId },
    { nodeId: "5527:5397", property: "fills[0].token", component: "MediaRow", instance: "5527:5397" },
  );
});

test("a nested node names its enclosing instance and the path to it", () => {
  const { variables: [v] } = bindingMap([layer], { variables: ["grid/gap"] });
  const nested = v.consumers.find((c) => c.nodeId === "I5527:5397;5171:9745");
  assert.equal(nested.property, "layout.gap.token");
  assert.equal(nested.component, "MediaRow");
  assert.equal(nested.instance.nodeId, "5527:5397");
  assert.equal(nested.path, "MediaRow › content › header");
});

test("grid/gap: two named bindings plus the one the export states only as a bare alias", () => {
  const { variables: [v] } = bindingMap([layer], { variables: ["grid/gap"] });
  assert.equal(v.consumers.length, 3);
  assert.equal(v.consumers.filter((c) => c.source === "variableBindings").length, 1);
  assert.equal(v.consumers.filter((c) => c.source === "variableBindings")[0].property, null);
});

test("an unknown variable is an error, never an empty result", () => {
  assert.throws(() => bindingMap([layer], { variables: ["color/nope"] }), /color\/nope/);
});

test("a variable the export states but nothing binds reports none", () => {
  const doc = structuredClone(layer);
  doc.variableTokens.push({ id: "VariableID:0:0", name: "color/unbound", aliasId: "VariableID:0:0", count: 0 });
  const { variables: [v] } = bindingMap([doc], { variables: ["color/unbound"] });
  assert.deepEqual(v.consumers, []);
});

test("an export older than schema 12 carries no tokenBindings: said, not guessed", () => {
  const old = JSON.parse(readFileSync(path.join(fx, "jhd-v11-2026-09-12", "design-handoff-block-navigation.json"), "utf8"));
  const { notes } = bindingMap([old], { variables: [] });
  assert.match(notes.join("\n"), /schema 11.*predates.*tokenBindings/s);
});

test("schema 12+ with no bindings anywhere is flagged as such", () => {
  const empty = structuredClone(layer);
  const strip = (n) => { delete n.tokenBindings; delete n.variableBindings; (n.children ?? []).forEach(strip); };
  empty.layerTree.forEach(strip);
  const { notes } = bindingMap([empty], { variables: [] });
  assert.match(notes.join("\n"), /no tokenBindings/);
});

test("the DS export adds the library-wide count and the 5-node cap", () => {
  const ds = gz(dsPath);
  const { variables: [v] } = bindingMap([layer], { variables: ["color/background/default/primary"], ds });
  assert.equal(v.library.directBindingOccurrences, ds.collections.flatMap((c) => c.variables).find((x) => x.name === "color/background/default/primary").usage.directBindingOccurrences);
  assert.ok(v.library.named <= 5);
  assert.match(v.library.note, /named by the library export/);
});

test("a CSS custom property resolves through the DS export's codeSyntax.WEB", () => {
  const ds = gz(dsPath);
  const name = ds.collections.flatMap((c) => c.variables).find((x) => x.name === "color/background/default/primary").codeSyntax.WEB.value;
  const { variables: [v] } = bindingMap([layer], { variables: [name], ds });
  assert.equal(v.name, "color/background/default/primary");
});

test("a WEB name without the DS export is an error that says which input is missing", () => {
  assert.throws(() => bindingMap([layer], { variables: ["--color-background-default-primary"] }), /--ds-export/);
});

async function run(args, cwd) {
  let out = "", err = "";
  const code = await dispatch(["bindings", ...args], { cwd, stdout: { write: (s) => { out += s; } }, stderr: { write: (s) => { err += s; } } });
  return { code, out, err };
}

test("the zip's frame image is extracted next to the report and linked from the row", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ht138-"));
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==", "base64");
  writeFileSync(path.join(dir, "mediarow.zip"), makeZip([
    ["design-handoff-mediarow.json", Buffer.from(JSON.stringify(layer))],
    ["screenshots/MediaRow.png", png],
  ]));
  const out = path.join(dir, "out");
  const { code, out: stdout } = await run(["--export", "mediarow.zip", "--variable", "color/background/default/primary", "--out", out], dir);
  assert.equal(code, 0);
  assert.ok(existsSync(path.join(out, "frames", "MediaRow.png")));
  const md = readFileSync(path.join(out, "bindings.md"), "utf8");
  assert.match(md, /\]\(frames\/MediaRow\.png\)/);
  assert.match(stdout, /1 consumer/);
});

test("no image in the input: the frame is named and the gap is said", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ht138-"));
  const { code, out } = await run(["--export", layerPath, "--variable", "color/background/default/primary"], dir);
  assert.equal(code, 0);
  assert.match(out, /no frame image in the input/);
});

test("the same input twice gives byte-identical output", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ht138-"));
  const a = await run(["--export", layerPath, "--variable", "grid/gap", "--variable", "space/spacer-300", "--json"], dir);
  const b = await run(["--export", layerPath, "--variable", "grid/gap", "--variable", "space/spacer-300", "--json"], dir);
  assert.equal(a.out, b.out);
  assert.ok(a.out.length > 100);
});

test("no --variable is a usage error", async () => {
  const { code, err } = await run(["--export", layerPath], process.cwd());
  assert.equal(code, 1);
  assert.match(err, /handoff-css bindings/);
});
