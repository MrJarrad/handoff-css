// HT-138: `handoff-css bindings` — which components and instances bind a variable, by which
// property, read from the layer export. Expected rows are counted from the export's own
// `tokenBindings` by hand (see the fixture README line), not recomputed with the module's walk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, copyFileSync, readdirSync, rmSync } from "node:fs";
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

// ---- review follow-ups ----------------------------------------------------------------------

const png = (n) => Buffer.from(`png-${n}`);
const zipDir = (files) => {
  const dir = mkdtempSync(path.join(tmpdir(), "ht147-"));
  writeFileSync(path.join(dir, "in.zip"), makeZip(files));
  return dir;
};
const withShot = (doc, name, extra = {}) => { const d = structuredClone(doc); d.screenshots.exported[0].name = name; Object.assign(d, extra); return Buffer.from(JSON.stringify(d)); };

test("no image in the input: --out creates no frames directory", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ht147-"));
  const out = path.join(dir, "out");
  const { code } = await run(["--export", layerPath, "--variable", "color/background/default/primary", "--out", out], dir);
  assert.equal(code, 0);
  assert.ok(existsSync(path.join(out, "bindings.md")));
  assert.equal(existsSync(path.join(out, "frames")), false);
});

test("two exports in one zip whose frames share an image name each get their own image", async () => {
  const dir = zipDir([
    ["a/one.json", withShot(layer, "MediaRow", { pageName: "A" })], ["a/MediaRow.png", png("a")],
    ["b/two.json", withShot(layer, "MediaRow", { pageName: "B" })], ["b/MediaRow.png", png("b")],
  ]);
  const out = path.join(dir, "out");
  const { code } = await run(["--export", "in.zip", "--variable", "color/background/default/primary", "--out", out], dir);
  assert.equal(code, 0);
  const md = readFileSync(path.join(out, "bindings.md"), "utf8");
  const links = [...md.matchAll(/\]\((frames\/[^)]+)\)/g)].map((m) => m[1]);
  assert.equal(links.length, 2);
  assert.equal(new Set(links).size, 2, "two different files, none overwritten");
  assert.deepEqual(links.map((l) => readFileSync(path.join(out, l), "utf8")).sort(), ["png-a", "png-b"]);
  const a = md.split("\n").find((l) => l.includes("MediaRow") && /\.png/.test(l));
  assert.match(readFileSync(path.join(out, a.match(/\((frames\/[^)]+)\)/)[1]), "utf8"), /png-a/, "the first export's row links its own folder's image");
});

test("a node id inside an unrelated file name is not a match", async () => {
  const dir = zipDir([["one.json", withShot(layer, "Other")], ["frame-5527-539712.png", png("x")]]);
  const out = path.join(dir, "out");
  const { out: stdout } = await run(["--export", "in.zip", "--variable", "color/background/default/primary", "--out", out], dir);
  assert.equal(existsSync(path.join(out, "frames")), false);
  assert.match(readFileSync(path.join(out, "bindings.md"), "utf8"), /no frame image in the input/);
  assert.match(stdout, /0 frame image/);
});

test("a node id delimited in the file name still matches, and two such files are ambiguous (none)", async () => {
  const one = zipDir([["one.json", withShot(layer, "Other")], ["frame_5527-5397.png", png("x")]]);
  await run(["--export", "in.zip", "--variable", "color/background/default/primary", "--out", path.join(one, "o")], one);
  assert.ok(existsSync(path.join(one, "o", "frames", "frame_5527-5397.png")));
  const two = zipDir([["one.json", withShot(layer, "Other")], ["x/5527-5397.png", png("x")], ["y/5527-5397.png", png("y")]]);
  await run(["--export", "in.zip", "--variable", "color/background/default/primary", "--out", path.join(two, "o")], two);
  assert.equal(existsSync(path.join(two, "o", "frames")), false);
});

test("a variable with no consumers does not point at rows above", () => {
  const ds = gz(dsPath);
  const doc = structuredClone(layer);
  const name = "color/background/default/primary";
  const strip = (n) => { delete n.tokenBindings; delete n.variableBindings; (n.children ?? []).forEach(strip); };
  doc.layerTree.forEach(strip);
  const { variables: [v] } = bindingMap([doc], { variables: [name], ds });
  assert.equal(v.consumers.length, 0);
  assert.doesNotMatch(v.library.note, /rows above/);
  assert.match(v.library.note, /places none/);
});

// ---- frame images from the brief's data URIs ------------------------------------------------

const briefDir = path.join(fx, "bindings-brief-images");
const PNG1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==", "base64");
const copyBrief = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bindmd-"));
  for (const f of ["design-handoff-mediarow.json.gz", "design-handoff-mediarow.md"]) copyFileSync(path.join(briefDir, f), path.join(dir, f));
  return dir;
};
const ARGS = ["--variable", "color/background/default/primary"];

test("a .json.gz with its sibling .md: the data URI image is written to frames/ and linked from the row", async () => {
  const dir = copyBrief();
  const out = path.join(dir, "out");
  const { code, out: stdout } = await run(["--export", "design-handoff-mediarow.json.gz", ...ARGS, "--out", out], dir);
  assert.equal(code, 0);
  assert.deepEqual(readFileSync(path.join(out, "frames", "MediaRow.png")), PNG1);
  assert.match(readFileSync(path.join(out, "bindings.md"), "utf8"), /\]\(frames\/MediaRow\.png\)/);
  assert.match(stdout, /1 frame image/);
  assert.deepEqual(readdirSync(path.join(out, "frames")), ["MediaRow.png"], "the image no frame names is not written");
});

test("a .json beside its .md reads the same way", async () => {
  const dir = copyBrief();
  writeFileSync(path.join(dir, "design-handoff-mediarow.json"), gunzipSync(readFileSync(path.join(dir, "design-handoff-mediarow.json.gz"))));
  const out = path.join(dir, "out");
  await run(["--export", "design-handoff-mediarow.json", ...ARGS, "--out", out], dir);
  assert.ok(existsSync(path.join(out, "frames", "MediaRow.png")));
});

test("a zip holding the .json and the .md (the plugin's zip) gives the frame image", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bindmd-"));
  writeFileSync(path.join(dir, "in.zip"), makeZip([
    ["design-handoff-mediarow.json", gunzipSync(readFileSync(path.join(briefDir, "design-handoff-mediarow.json.gz")))],
    ["design-handoff-mediarow.md", readFileSync(path.join(briefDir, "design-handoff-mediarow.md"))],
  ]));
  const out = path.join(dir, "out");
  await run(["--export", "in.zip", ...ARGS, "--out", out], dir);
  assert.deepEqual(readFileSync(path.join(out, "frames", "MediaRow.png")), PNG1);
});

test("an image entry in the zip still wins when the zip also has a brief", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bindmd-"));
  writeFileSync(path.join(dir, "in.zip"), makeZip([
    ["design-handoff-mediarow.json", gunzipSync(readFileSync(path.join(briefDir, "design-handoff-mediarow.json.gz")))],
    ["design-handoff-mediarow.md", readFileSync(path.join(briefDir, "design-handoff-mediarow.md"))],
    ["screenshots/MediaRow.png", png("entry")],
  ]));
  const out = path.join(dir, "out");
  await run(["--export", "in.zip", ...ARGS, "--out", out], dir);
  assert.equal(readFileSync(path.join(out, "frames", "MediaRow.png"), "utf8"), "png-entry");
});

test("no sibling .md: the gap is said and no frames directory is made", async () => {
  const dir = copyBrief();
  rmSync(path.join(dir, "design-handoff-mediarow.md"));
  const out = path.join(dir, "out");
  await run(["--export", "design-handoff-mediarow.json.gz", ...ARGS, "--out", out], dir);
  assert.match(readFileSync(path.join(out, "bindings.md"), "utf8"), /no frame image in the input/);
  assert.ok(!existsSync(path.join(out, "frames")));
});

test("a placeholder or empty data URI is no image", async () => {
  const dir = copyBrief();
  writeFileSync(path.join(dir, "design-handoff-mediarow.md"), "![MediaRow](data:image/png;base64,STRIPPED)\n\n![MediaRow](data:image/png;base64,)\n");
  const out = path.join(dir, "out");
  await run(["--export", "design-handoff-mediarow.json.gz", ...ARGS, "--out", out], dir);
  assert.match(readFileSync(path.join(out, "bindings.md"), "utf8"), /no frame image in the input/);
  assert.ok(!existsSync(path.join(out, "frames")));
});

test("the image is matched by screenshot name; a name with slashes and equals signs gets a safe file name", async () => {
  const dir = copyBrief();
  const doc = gz(path.join(dir, "design-handoff-mediarow.json.gz"));
  doc.screenshots.exported[0].name = "Row / device=md+";
  writeFileSync(path.join(dir, "x.json"), JSON.stringify(doc));
  writeFileSync(path.join(dir, "x.md"), `![Row / device=md+](data:image/png;base64,${PNG1.toString("base64")})\n`);
  const out = path.join(dir, "out");
  await run(["--export", "x.json", ...ARGS, "--out", out], dir);
  assert.deepEqual(readdirSync(path.join(out, "frames")), ["Row-device-md.png"]);
  assert.match(readFileSync(path.join(out, "bindings.md"), "utf8"), /\]\(frames\/Row-device-md\.png\)/);
});

test("without --out the row says the image is in the brief", async () => {
  const dir = copyBrief();
  const { out } = await run(["--export", "design-handoff-mediarow.json.gz", ...ARGS], dir);
  assert.match(out, /image in the brief/);
  assert.match(out, /pass --out/);
});

// ---- review round 1 ---------------------------------------------------------------------------

const scaled = (scale, md) => {
  const dir = copyBrief();
  const doc = gz(path.join(dir, "design-handoff-mediarow.json.gz"));
  doc.screenshots.exported[0].scale = scale;
  writeFileSync(path.join(dir, "x.json"), JSON.stringify(doc));
  writeFileSync(path.join(dir, "x.md"), md);
  return dir;
};
const dataUri = `data:image/png;base64,${PNG1.toString("base64")}`;
for (const scale of [0.5, 0.25, 0.125]) {
  test(`a frame exported at ${scale}x is found under the alt text the plugin writes for it`, async () => {
    const dir = scaled(scale, `![MediaRow (exported at ${scale}x — too large at 1x)](${dataUri})\n`);
    const out = path.join(dir, "out");
    await run(["--export", "x.json", ...ARGS, "--out", out], dir);
    assert.deepEqual(readFileSync(path.join(out, "frames", "MediaRow.png")), PNG1);
  });
}

test("a downscaled frame whose payload is a placeholder is no image", async () => {
  const dir = scaled(0.5, "![MediaRow (exported at 0.5x — too large at 1x)](data:image/png;base64,STRIPPED)\n");
  const out = path.join(dir, "out");
  await run(["--export", "x.json", ...ARGS, "--out", out], dir);
  assert.match(readFileSync(path.join(out, "bindings.md"), "utf8"), /no frame image in the input/);
  assert.ok(!existsSync(path.join(out, "frames")));
});

test("a downscaled frame is not found under the bare name, nor a scale-1 frame under a suffixed one", async () => {
  const a = scaled(0.5, `![MediaRow](${dataUri})\n`);
  await run(["--export", "x.json", ...ARGS, "--out", path.join(a, "out")], a);
  assert.ok(!existsSync(path.join(a, "out", "frames")));
  const b = scaled(1, `![MediaRow (exported at 0.5x — too large at 1x)](${dataUri})\n`);
  await run(["--export", "x.json", ...ARGS, "--out", path.join(b, "out")], b);
  assert.ok(!existsSync(path.join(b, "out", "frames")));
});

test("a 300-character screenshot name still writes the report and the image", async () => {
  const name = "Long ".repeat(60);
  const dir = scaled(1, `![${name}](${dataUri})\n`);
  const doc = JSON.parse(readFileSync(path.join(dir, "x.json"), "utf8"));
  doc.screenshots.exported[0].name = name;
  writeFileSync(path.join(dir, "x.json"), JSON.stringify(doc));
  const out = path.join(dir, "out");
  const { code } = await run(["--export", "x.json", ...ARGS, "--out", out], dir);
  assert.equal(code, 0);
  const [f] = readdirSync(path.join(out, "frames"));
  assert.match(f, /\.png$/);
  assert.ok(f.length <= 200);
});

test("file names that differ only by case do not overwrite each other", async () => {
  const dir = copyBrief();
  const doc = gz(path.join(dir, "design-handoff-mediarow.json.gz"));
  writeFileSync(path.join(dir, "a.json"), JSON.stringify(doc));
  writeFileSync(path.join(dir, "a.md"), `![MediaRow](${dataUri})\n`);
  const doc2 = structuredClone(doc); doc2.screenshots.exported[0].name = "mediarow"; doc2.documentName = "Other file";
  writeFileSync(path.join(dir, "b.json"), JSON.stringify(doc2));
  writeFileSync(path.join(dir, "b.md"), `![mediarow](${dataUri})\n`);
  const out = path.join(dir, "out");
  await run(["--export", "a.json", "--export", "b.json", ...ARGS, "--out", out], dir);
  assert.equal(readdirSync(path.join(out, "frames")).length, 2);
});
