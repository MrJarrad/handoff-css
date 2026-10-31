// HT-40 — the media list. A Design Handoff export (schema v15) lists every image and video fill
// (`media[]`): layer, path, crop and scale, size on screen, image hash. No file bytes, no alt text.
import { test } from "node:test";
import assert from "node:assert/strict";

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
