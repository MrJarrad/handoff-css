// HT-40 — the media list. A Design Handoff export lists every image and video fill
// (`media[]`); the operator drops the real files into one folder, each named after its
// Figma layer, and `handoff-css media` pairs each file to its entry and flags any missing.
import { test } from "node:test";
import assert from "node:assert/strict";

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { matchMedia } from "../src/media.mjs";
import { dispatch } from "../src/cli.mjs";

const entry = (layerName, more = {}) => ({ nodeId: "1:" + layerName.length, layerName, nodePath: "Page › " + layerName, kind: "image", hash: "a".repeat(40), ...more });

test("a dropped file pairs with the entry whose layer it is named after, whatever its case, punctuation or extension", () => {
  for (const file of ["Hero Image.jpg", "hero-image.webp", "HERO_IMAGE.png"]) {
    const result = matchMedia({ media: [entry("Hero Image")], files: [file] });
    assert.deepEqual(result.matched.map((m) => [m.entry.layerName, m.file]), [["Hero Image", file]], file);
    assert.deepEqual(result.missing, []);
  }
});

test("an entry with no file is missing, and a file that names no layer is extra", () => {
  const result = matchMedia({ media: [entry("Hero Image"), entry("Founder Portrait")], files: ["hero image.jpg", "old-logo.svg"] });
  assert.deepEqual(result.missing.map((e) => e.layerName), ["Founder Portrait"]);
  assert.deepEqual(result.extra, ["old-logo.svg"]);
});

test("layers that share a name and an image are one image reused: one file covers them all", () => {
  const result = matchMedia({ media: [entry("Image", { nodeId: "1:1" }), entry("Image", { nodeId: "1:2" })], files: ["image.jpg"] });
  assert.deepEqual(result.matched.map((m) => [m.entry.nodeId, m.file]), [["1:1", "image.jpg"], ["1:2", "image.jpg"]]);
  assert.deepEqual(result.ambiguous, []);
});

test("layers that share a name but not an image are ambiguous, each with its path, and no file is paired to them", () => {
  const media = [
    entry("Image", { nodeId: "1:1", nodePath: "Home › Hero › Image", hash: "a".repeat(40) }),
    entry("Image", { nodeId: "1:2", nodePath: "Home › Team › Image", hash: "b".repeat(40) }),
    entry("Clip", { nodeId: "1:3", kind: "video", hash: null }),
    entry("Clip", { nodeId: "1:4", kind: "video", hash: null }),
  ];
  const result = matchMedia({ media, files: ["image.jpg", "clip.mp4"] });
  assert.deepEqual(result.ambiguous.map((group) => [group.layerName, group.entries.map((e) => e.nodePath)]), [
    ["Image", ["Home › Hero › Image", "Home › Team › Image"]],
    ["Clip", ["Page › Clip", "Page › Clip"]],
  ]);
  assert.deepEqual(result.matched, []);
  assert.deepEqual(result.missing, []);
});

/** An export and a drop folder in a temp dir; `media` runs against them and returns its exit code and output. */
async function runMedia(doc, files, extra = []) {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-media-"));
  writeFileSync(path.join(cwd, "brief.json"), JSON.stringify(doc));
  mkdirSync(path.join(cwd, "drop"));
  for (const file of files) writeFileSync(path.join(cwd, "drop", file), "");
  let out = "";
  let err = "";
  const code = await dispatch(["media", "--handoff", "brief.json", "--dir", "drop", ...extra], { cwd, stdout: { write: (s) => { out += s; } }, stderr: { write: (s) => { err += s; } } });
  return { code, out, err };
}

test("`handoff-css media` fails while an entry is missing or ambiguous, names each one, and passes once every entry has its file", async () => {
  const doc = { schemaVersion: 15, media: [entry("Hero Image"), entry("Founder Portrait", { nodePath: "Home › Team › Founder Portrait" })] };
  const short = await runMedia(doc, ["hero image.jpg", "old-logo.svg", ".DS_Store"]);
  assert.equal(short.code, 1);
  assert.match(short.out, /missing\s+Founder Portrait — Home › Team › Founder Portrait/);
  assert.match(short.out, /extra\s+old-logo\.svg/);
  assert.doesNotMatch(short.out, /DS_Store/);
  const whole = await runMedia(doc, ["hero image.jpg", "founder-portrait.png", "old-logo.svg"]);
  assert.equal(whole.code, 0);
  const json = JSON.parse((await runMedia(doc, ["hero image.jpg"], ["--json"])).out);
  assert.deepEqual(json.missing.map((e) => e.layerName), ["Founder Portrait"]);
});

test("`handoff-css media` on an export older than the media list says to re-export, and fails", async () => {
  const { code, err } = await runMedia({ schemaVersion: 14 }, ["hero.jpg"]);
  assert.equal(code, 1);
  assert.match(err, /schema v14.*re-export/);
});

// Schema v15 — v14 plus `media[]`. Read against the link-run script's own Overlay export (v14).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { validateBriefJson } from "../src/brief.mjs";

const overlay = () => JSON.parse(gunzipSync(readFileSync(fileURLToPath(new URL("../fixtures/script-2026-10-29/overlay.json.gz", import.meta.url)))).toString("utf8"));
const listed = { nodeId: "4227:16300", layerName: "Hero Image", nodePath: "Overlay › Hero Image", kind: "image", hash: "a".repeat(40), scaleMode: "CROP", imageTransform: [[0.5, 0, 0.25], [0, 0.5, 0.25]], rotation: 90, renderedSize: { width: 320, height: 200 } };

test("a v15 export with a media list validates; the list carries no alt text; v14 has no media list", () => {
  const v15 = { ...overlay(), schemaVersion: 15, media: [listed, { ...listed, kind: "video", hash: null, scaleMode: "TILE", scalingFactor: 0.5, imageTransform: undefined, rotation: undefined }] };
  assert.deepEqual(validateBriefJson(JSON.parse(JSON.stringify(v15))).errors, []);
  assert.equal(validateBriefJson({ ...v15, media: [{ ...listed, alt: "A hero" }] }).ok, false);
  assert.equal(validateBriefJson({ ...v15, schemaVersion: 14 }).ok, false);
});
