// HT-24 — the export arrives as the .zip the Design System Handoff plugin and
// design-handoff-script save. `validate`, the generator's `--input` and
// `vendor` read it as they read the files inside it: the expected result of
// each is the same command run on the unzipped files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync, gunzipSync } from "node:zlib";

import { dispatch } from "../src/cli.mjs";
import { readZip } from "../src/zip.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const gz = (dir, name) => gunzipSync(readFileSync(path.join(fixtures, dir, `${name}.gz`)));
const sink = () => { const out = { text: "", write(s) { out.text += s; return true; } }; return out; };

/** A zip as the plugin writes one: each entry stored, or deflated when asked. */
function zip(entries, { deflate = false } = {}) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const body = deflate ? deflateRawSync(data) : data;
    const n = Buffer.from(name);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(deflate ? 8 : 0, 8);
    head.writeUInt32LE(crc32(data), 14); head.writeUInt32LE(body.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(head, n, body); centrals.push(central, n);
    offset += 30 + n.length + body.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

test("readZip returns each entry's bytes, stored or deflated", () => {
  const files = [["a.json", Buffer.from('{"x":1}')], ["b.md", Buffer.from("# b\n")]];
  for (const deflate of [false, true]) {
    assert.deepEqual(readZip(zip(files, { deflate })).map((e) => [e.name, e.data.toString()]), files.map(([n, d]) => [n, d.toString()]));
  }
});

test("a file that is not a zip is refused by name", () => {
  assert.throws(() => readZip(Buffer.from("not a zip at all, just text padding it out"), "x.zip"), /x\.zip: not a zip file/);
});

test("validate reads a brief .zip as it reads the brief's .json and .md", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-css-zip-"));
  const files = { "overlay.json": gz("script-2026-10-29", "overlay.json"), "overlay.md": gz("script-2026-10-29", "overlay.md"),
    "design-system-handoff.json": gz("script-2026-10-29", "design-system-handoff.json") };
  for (const [n, d] of Object.entries(files)) writeFileSync(path.join(dir, n), d);
  writeFileSync(path.join(dir, "brief.zip"), zip([["overlay.json", files["overlay.json"]], ["overlay.md", files["overlay.md"]], ["shot.png", Buffer.from([137, 80, 78, 71])]]));
  writeFileSync(path.join(dir, "ds.zip"), zip([["design-system-handoff.json", files["design-system-handoff.json"]]], { deflate: true }));

  const plain = sink(), zipped = sink();
  const a = await dispatch(["validate", "overlay.json", "overlay.md", "design-system-handoff.json", "--json"], { cwd: dir, stdout: plain, stderr: sink() });
  const b = await dispatch(["validate", "brief.zip", "ds.zip", "--json"], { cwd: dir, stdout: zipped, stderr: sink() });
  assert.equal(b, a);
  const strip = (text) => JSON.parse(text).results.map(({ file, ...r }) => r);
  assert.deepEqual(strip(zipped.text), strip(plain.text));
  assert.match(zipped.text, /brief\.zip › overlay\.json/);
});

test("the generator's --input takes the Design System Handoff .zip", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-css-zip-gen-"));
  const json = gz("jhd-v19-2026-10-29", "design-system-handoff.json");
  writeFileSync(path.join(dir, "ds.json"), json);
  writeFileSync(path.join(dir, "ds.zip"), zip([["ds.md", Buffer.from("- Schema: `design-system-handoff` v19\n")], ["ds.json", json]]));
  writeFileSync(path.join(dir, "styles.css"), "");
  const presetUrl = new URL("../presets/jhd.config.mjs", import.meta.url).href;
  writeFileSync(path.join(dir, "handoff.config.mjs"), `import preset from ${JSON.stringify(presetUrl)};\nexport default { ...preset, paths: { ...preset.paths, input: "ds.json", handAuthored: "styles.css", out: "a/tokens.css", theme: "a/theme.css", styles: "a/styles.css", report: "a/report.md", exclusions: "a/exclusions.json" } };\n`);
  assert.equal(await dispatch(["--config", "handoff.config.mjs"], { cwd: dir, stdout: sink(), stderr: sink() }), 0);
  assert.equal(await dispatch(["--config", "handoff.config.mjs", "--input", "ds.zip", "--out", "b/tokens.css", "--theme", "b/theme.css", "--styles", "b/styles.css", "--report", "b/report.md", "--exclusions", "b/exclusions.json"], { cwd: dir, stdout: sink(), stderr: sink() }), 0);
  for (const f of readdirSync(path.join(dir, "a"))) assert.equal(readFileSync(path.join(dir, "b", f), "utf8"), readFileSync(path.join(dir, "a", f), "utf8"), f);
});

test("vendor takes the .zip and writes the export's .json and .md", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-css-zip-vendor-"));
  const json = gz("jhd-v19-2026-10-29", "design-system-handoff.json");
  const md = Buffer.from("- Schema: `design-system-handoff` v19\n");
  writeFileSync(path.join(dir, "ds.zip"), zip([["x.md", md], ["x.json", json]]));
  const stdout = sink();
  assert.equal(await dispatch(["vendor", "ds.zip", "--into", "handoff"], { cwd: dir, stdout, stderr: sink() }), 0);
  const base = JSON.parse(json).artifactFilename;
  const latest = path.join(dir, "handoff", "latest");
  assert.deepEqual(readdirSync(latest).sort(), [`${base}.json`, `${base}.md`]);
  assert.equal(readFileSync(path.join(latest, `${base}.json`), "utf8"), json.toString());
  assert.equal(readFileSync(path.join(latest, `${base}.md`), "utf8"), md.toString());
});

// #44 review r1 ambers.
import { readExports } from "../src/zip.mjs";

test("a zip saved by macOS Finder reads: __MACOSX/ and ._ entries are skipped", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-css-zip-finder-"));
  const json = gz("jhd-v19-2026-10-29", "design-system-handoff.json");
  const appleDouble = Buffer.from([0, 5, 22, 7, 0, 2, 0, 0, 77, 97, 99, 32, 79, 83, 32, 88]);
  writeFileSync(path.join(dir, "ds.zip"), zip([["ds.json", json], ["__MACOSX/._ds.json", appleDouble], ["._ds.md", appleDouble]]));
  const docs = readExports(path.join(dir, "ds.zip"));
  assert.equal(docs.length, 1);
  assert.equal(docs[0].schema, "design-system-handoff");
});

test("an entry that is not JSON is named in the error", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-css-zip-bad-"));
  writeFileSync(path.join(dir, "ds.zip"), zip([["broken.json", Buffer.from("{ not json")]]));
  assert.throws(() => readExports(path.join(dir, "ds.zip")), /ds\.zip › broken\.json/);
});

test("vendor takes the Design System Handoff export from a zip that also holds a brief", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-css-zip-vendor-pick-"));
  const json = gz("jhd-v19-2026-10-29", "design-system-handoff.json");
  const brief = gz("script-2026-10-29", "overlay.json");
  writeFileSync(path.join(dir, "mixed.zip"), zip([["brief.json", brief], ["ds.json", json]]));
  assert.equal(await dispatch(["vendor", "mixed.zip", "--into", "handoff"], { cwd: dir, stdout: sink(), stderr: sink() }), 0);
  const base = JSON.parse(json).artifactFilename;
  assert.deepEqual(readdirSync(path.join(dir, "handoff", "latest")), [`${base}.json`]);
  assert.equal(readFileSync(path.join(dir, "handoff", "latest", `${base}.json`), "utf8"), json.toString());
});

test("vendor refuses a zip holding two Design System Handoff exports, naming both", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-css-zip-vendor-two-"));
  const json = gz("jhd-v19-2026-10-29", "design-system-handoff.json");
  writeFileSync(path.join(dir, "two.zip"), zip([["a.json", json], ["b.json", json]]));
  const stderr = sink();
  assert.equal(await dispatch(["vendor", "two.zip", "--into", "handoff"], { cwd: dir, stdout: sink(), stderr }), 1);
  assert.match(stderr.text, /two\.zip › a\.json.*two\.zip › b\.json/s);
});
