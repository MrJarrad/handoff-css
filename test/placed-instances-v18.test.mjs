// HT-80 — schema v18: every setting of every instance placed in a layout is a typed row in `placedInstances[]`,
// compared with what the component ships at the same place; the markdown lists only the changes. `validate`
// refuses a setting with no row (red), a row with no setting behind it, and a markdown section that differs
// from the JSON. Fixtures: two real briefs, the Media block placed alone and a MediaRow placed in a layout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { BRIEF_SCHEMA_VERSIONS, validateBriefJson, validateBriefPair } from "../src/brief.mjs";

const dir = new URL("../fixtures/jhd-v18-placed-2026-11-08/", import.meta.url);
const read = (name) => gunzipSync(readFileSync(fileURLToPath(new URL(name, dir)))).toString("utf8");
const loadRow = () => JSON.parse(read("design-handoff-mediarow.json.gz"));
const loadBlock = () => JSON.parse(read("design-handoff-media-block.json.gz"));
const rowMd = () => read("design-handoff-mediarow.md.gz");
const blockMd = () => read("design-handoff-media-block.md.gz");
const pair = (doc, md) => validateBriefPair(doc, md).findings.filter((f) => /^PAIR_PLACED/.test(f.code));

test("v18 is a schema this checker validates in full, and both real briefs pass it with no warning", () => {
  assert.ok(BRIEF_SCHEMA_VERSIONS.includes(18));
  for (const doc of [loadRow(), loadBlock()]) {
    assert.equal(doc.schemaVersion, 18);
    const { ok, errors, warnings } = validateBriefJson(doc);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    assert.equal(ok, true);
  }
  assert.equal(loadRow().placedInstances.length, 90);
  assert.equal(loadBlock().placedInstances.length, 21);
});

test("a placement row needs its keys, and a source and block fields of the right kind", () => {
  for (const drop of ["instancePath", "nodeId", "placementId", "property", "type", "blockKnown", "swappedHere", "changedHere", "source"]) {
    const doc = loadRow();
    delete doc.placedInstances[0][drop];
    const { ok, errors } = validateBriefJson(doc);
    assert.equal(ok, false, `a row without ${drop} must fail`);
    assert.ok(errors.some((e) => e.path.startsWith("/placedInstances/0")), `${drop}: ${JSON.stringify(errors)}`);
  }
  const doc = loadRow();
  doc.placedInstances[3].source = "somewhere";
  assert.ok(validateBriefJson(doc).errors.some((e) => e.path === "/placedInstances/3/source"));
  const bad = loadRow();
  delete bad.placements[0].changed;
  assert.ok(validateBriefJson(bad).errors.some((e) => e.path.startsWith("/placements/0")));
});

test("a setting of a placed instance with no row is red: PLACED_ROW_MISSING names the placement path and the setting", () => {
  const doc = loadRow();
  const at = doc.placedInstances.findIndex((r) => r.instancePath === "MediaRow › Cell › Media" && r.property === "ratio");
  const gone = doc.placedInstances.splice(at, 1)[0];
  const { ok, errors } = validateBriefJson(doc);
  assert.equal(ok, false);
  const hit = errors.find((e) => e.code === "PLACED_ROW_MISSING");
  assert.ok(hit, JSON.stringify(errors));
  assert.match(hit.message, /ratio/);
  assert.match(hit.message, new RegExp(gone.nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("a row with no instance or no setting behind it, or a definition's instance, is PLACED_ROW_DANGLING", () => {
  const doc = loadRow();
  doc.placedInstances.push({ ...JSON.parse(JSON.stringify(doc.placedInstances[0])), key: "9:9:x", nodeId: "9:9", property: "x" });
  assert.ok(validateBriefJson(doc).errors.some((e) => e.code === "PLACED_ROW_DANGLING" && /9:9/.test(e.message)));
  const other = loadRow();
  other.placedInstances[5].property = "not-a-setting";
  const errs = validateBriefJson(other).errors;
  assert.ok(errs.some((e) => e.code === "PLACED_ROW_DANGLING" && /not-a-setting/.test(e.message)));
  assert.ok(errs.some((e) => e.code === "PLACED_ROW_MISSING"), "and the setting it replaced has no row");
});

test("instances inside a component definition are not placements: no rows are expected for them", () => {
  const doc = loadRow();
  doc.layerTree = [{ id: "1:1", name: "Def", type: "COMPONENT_SET", children: [{ id: "1:2", name: "v", type: "COMPONENT", children: [doc.layerTree[0]] }] }];
  doc.placedInstances = []; doc.placements = [];
  assert.ok(!validateBriefJson(doc).errors.some((e) => e.code === "PLACED_ROW_MISSING"));
});

test("the real briefs' markdown and JSON agree: the changed settings, and the unchanged-placement line", () => {
  assert.deepEqual(pair(loadRow(), rowMd()), []);
  assert.deepEqual(pair(loadBlock(), blockMd()), []);
  assert.match(blockMd(), /- Media: 1 placement uses the component's settings unchanged\./);
});

test("a markdown table cell that differs from its JSON row, or a row missing from either side, is PAIR_PLACED_ROW_MISMATCH", () => {
  const md = rowMd().replace(/(\| MediaRow \| #5527:5397 \| isDescription \| BOOLEAN \| )false( \| true \| own \|)/, "$1true$2");
  assert.notEqual(md, rowMd());
  const found = pair(loadRow(), md);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, "PAIR_PLACED_ROW_MISMATCH");
  assert.match(found[0].message, /isDescription/);
  assert.match(found[0].message, /Value here/);
  const dropped = rowMd().split("\n").filter((l) => !l.includes("| isSpacerTop |")).join("\n");
  assert.ok(pair(loadRow(), dropped).some((f) => f.code === "PAIR_PLACED_ROW_MISMATCH" && /isSpacerTop/.test(f.message)));
  const doc = loadRow();
  doc.placedInstances.find((r) => r.property === "title").changedHere = true;
  assert.ok(pair(doc, rowMd()).some((f) => f.code === "PAIR_PLACED_ROW_MISMATCH"));
});

test("JSON placements with no Placed Instances section, or an unchanged line the JSON does not support, is PAIR_PLACED_TABLE_MISMATCH", () => {
  const without = blockMd().replace(/### Placed Instances[\s\S]*?(?=\n### )/, "");
  assert.ok(!without.includes("### Placed Instances"));
  assert.ok(pair(loadBlock(), without).some((f) => f.code === "PAIR_PLACED_TABLE_MISMATCH"));
  const lie = blockMd().replace("1 placement uses the component's settings unchanged.", "2 placements use the component's settings unchanged.");
  assert.ok(pair(loadBlock(), lie).some((f) => f.code === "PAIR_PLACED_TABLE_MISMATCH"));
  const noPlacements = loadBlock();
  delete noPlacements.placedInstances; delete noPlacements.placements;
  assert.deepEqual(pair(noPlacements, without), []);
});

test("a v17 brief is judged as it always was: no placed rows required", () => {
  const doc = loadBlock();
  doc.schemaVersion = 17; delete doc.placedInstances; delete doc.placements; doc.componentProperties = [];
  assert.ok(!validateBriefJson(doc).errors.some((e) => /^PLACED/.test(e.code ?? "")));
});

// "Bulletproof": the checker re-derives what the exporter decided, so a JSON edited by hand cannot disagree with itself.
test("changedHere must follow from the values: a known, unswapped row changed exactly when value differs from blockValue", () => {
  const lie = loadRow();
  const same = lie.placedInstances.find((r) => r.blockKnown && !r.swappedHere && !r.changedHere && r.property === "ratio");
  same.changedHere = true;
  const found = validateBriefJson(lie).errors.filter((e) => e.code === "PLACED_FLAG_MISMATCH");
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.match(found[0].message, /ratio/);
  assert.match(found[0].message, /changedHere/);
  const hidden = loadRow();
  const changed = hidden.placedInstances.find((r) => r.changedHere && r.property === "isDescription");
  changed.changedHere = false;
  assert.ok(validateBriefJson(hidden).errors.some((e) => e.code === "PLACED_FLAG_MISMATCH" && /isDescription/.test(e.message)));
  const value = loadRow();
  const row = value.placedInstances.find((r) => r.blockKnown && !r.swappedHere && r.property === "title");
  row.value = "Another title";
  assert.ok(validateBriefJson(value).errors.some((e) => e.code === "PLACED_FLAG_MISMATCH" && /title/.test(e.message)), "a value edited without its flag");
});

test("a swapped row is changed with no block value; an unknown block is never changed", () => {
  const swapped = loadRow();
  const a = swapped.placedInstances.find((r) => r.blockKnown && !r.swappedHere && r.property === "ratio");
  a.swappedHere = true; a.blockValue = null; a.changedHere = false;
  assert.ok(validateBriefJson(swapped).errors.some((e) => e.code === "PLACED_FLAG_MISMATCH" && /swappedHere/.test(e.message)));
  const unknown = loadRow();
  const b = unknown.placedInstances.find((r) => r.property === "ratio");
  b.blockKnown = false; b.blockValue = null; b.changedHere = true;
  assert.ok(validateBriefJson(unknown).errors.some((e) => e.code === "PLACED_FLAG_MISMATCH" && /blockKnown/.test(e.message)));
});

test("placements[] counts must equal the rows: changed, unknown, and which placements exist", () => {
  const counts = loadRow();
  counts.placements[0].changed = 0;
  const e1 = validateBriefJson(counts).errors.filter((e) => e.code === "PLACED_COUNT_MISMATCH");
  assert.equal(e1.length, 1, JSON.stringify(e1));
  assert.match(e1[0].message, /changed/);
  const unknown = loadRow();
  unknown.placements[0].unknown = 2;
  assert.ok(validateBriefJson(unknown).errors.some((e) => e.code === "PLACED_COUNT_MISMATCH" && /unknown/.test(e.message)));
  const gone = loadRow();
  gone.placements = [];
  assert.ok(validateBriefJson(gone).errors.some((e) => e.code === "PLACED_COUNT_MISMATCH" && /placement/.test(e.message)));
  const extra = loadRow();
  extra.placements.push({ nodeId: "9:9", name: "Ghost", component: "Ghost", changed: 0, unknown: 0 });
  assert.ok(validateBriefJson(extra).errors.some((e) => e.code === "PLACED_COUNT_MISMATCH" && /9:9/.test(e.message)));
});

test("the real briefs pass the re-derivation", () => {
  assert.deepEqual(validateBriefJson(loadRow()).errors.filter((e) => /^PLACED/.test(e.code)), []);
  assert.deepEqual(validateBriefJson(loadBlock()).errors.filter((e) => /^PLACED/.test(e.code)), []);
});

test("the markdown section must say that every setting not listed uses the component's own", () => {
  const md = blockMd();
  assert.deepEqual(pair(loadBlock(), md), []);
  const stripped = md.replace(/Where a component is placed in this layout[^\n]*\n/, "Placed instances.\n");
  assert.notEqual(stripped, md);
  const found = pair(loadBlock(), stripped);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, "PAIR_PLACED_SENTENCE_MISSING");
  assert.ok(pair(loadRow(), rowMd().replace("every setting not listed here uses the component's own", "everything else is as designed")).some((f) => f.code === "PAIR_PLACED_SENTENCE_MISSING"));
});
