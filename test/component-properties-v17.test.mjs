// HT-75 / HT-76 — schema v17: every property the Figma properties panel shows, nested exposed
// instances included, is a typed row in `componentProperties[]`; the checker refuses a malformed row,
// a row with no place in the layer tree, and a component property with no row (a missing row is red).
// Fixture: a real brief of the Media block (set 611:11820), made 8 Nov 2026 (fixtures/jhd-v17-brief-2026-11-08).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { BRIEF_SCHEMA_VERSIONS, validateBriefJson } from "../src/brief.mjs";

const dir = new URL("../fixtures/jhd-v17-brief-2026-11-08/", import.meta.url);
const load = () => JSON.parse(gunzipSync(readFileSync(fileURLToPath(new URL("design-handoff-media-block.json.gz", dir)))).toString("utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const find = (tree, id) => { let hit = null; (function walk(n) { if (n.id === id) hit = n; (n.children ?? []).forEach(walk); })(tree[0]); return hit; };

test("v17 is a schema this checker validates in full, and the real Media brief passes it with no warning", () => {
  assert.ok(BRIEF_SCHEMA_VERSIONS.includes(17));
  const doc = load();
  assert.equal(doc.schemaVersion, 17);
  assert.equal(doc.componentProperties.length, 13);
  const { ok, errors, warnings } = validateBriefJson(doc);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(ok, true);
});

test("a row without its property, type or node is refused, and so is a build class outside Props by default", () => {
  for (const drop of ["property", "type", "nodeId", "ownerPath", "buildClass", "cms", "source"]) {
    const doc = load();
    delete doc.componentProperties[0][drop];
    const { ok, errors } = validateBriefJson(doc);
    assert.equal(ok, false, `a row without ${drop} must fail`);
    assert.ok(errors.some((e) => e.path.startsWith("/componentProperties/0")), `${drop}: ${JSON.stringify(errors)}`);
  }
  const doc = load();
  doc.componentProperties[2].buildClass.proposed = "nice-to-have";
  const { ok, errors } = validateBriefJson(doc);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === "/componentProperties/2/buildClass/proposed"), JSON.stringify(errors));
});

test("an instance's property row must say its type and whether it is overridden; exposure is a boolean and a list of ids", () => {
  const doc = load();
  const media = find(doc.layerTree, "656:3057");
  assert.equal(media.component.exposed, true);
  delete media.component.props["has-overlay"].type;
  media.component.exposed = "yes";
  const { ok, errors } = validateBriefJson(doc);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path.includes("/has-overlay")), JSON.stringify(errors));
  assert.ok(errors.some((e) => e.path.endsWith("/component/exposed")), JSON.stringify(errors));
});

test("a component property with no row is red: PROPERTY_ROW_MISSING names the owner and the property", () => {
  const doc = load();
  const gone = doc.componentProperties.splice(doc.componentProperties.findIndex((r) => r.property === "has-audio"), 1)[0];
  const { ok, errors } = validateBriefJson(doc);
  assert.equal(ok, false);
  const hit = errors.find((e) => e.code === "PROPERTY_ROW_MISSING");
  assert.ok(hit, JSON.stringify(errors));
  assert.match(hit.message, /has-audio/);
  assert.match(hit.message, new RegExp(gone.nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("a set's own property with no row is red too", () => {
  const doc = load();
  doc.componentProperties = doc.componentProperties.filter((r) => !(r.source === "own" && r.property === "layout"));
  const { errors } = validateBriefJson(doc);
  assert.ok(errors.some((e) => e.code === "PROPERTY_ROW_MISSING" && /layout/.test(e.message)), JSON.stringify(errors));
});

test("a row pointing at a node that is not in the layer tree, or at a property that node does not have, is PROPERTY_ROW_DANGLING", () => {
  const doc = load();
  doc.componentProperties.push({ ...clone(doc.componentProperties[0]), key: "9:9:x", nodeId: "9:9", property: "x" });
  assert.ok(validateBriefJson(doc).errors.some((e) => e.code === "PROPERTY_ROW_DANGLING" && /9:9/.test(e.message)));
  const other = load();
  other.componentProperties[5].property = "not-a-property";
  assert.ok(validateBriefJson(other).errors.some((e) => e.code === "PROPERTY_ROW_DANGLING" && /not-a-property/.test(e.message)));
});

test("an exposed instance that has props but whose rows are gone is red, an unexposed one needs none", () => {
  const doc = load();
  doc.componentProperties = doc.componentProperties.filter((r) => r.nodeId !== "611:12589");
  const { errors } = validateBriefJson(doc);
  const missing = errors.filter((e) => e.code === "PROPERTY_ROW_MISSING");
  assert.equal(missing.length, 2, JSON.stringify(missing));
  assert.ok(missing.every((e) => /SpacerTop/.test(e.message)));
  // ActionButtonIcon inside .ControlMedia is not exposed: no row, no error.
  assert.equal(find(load().layerTree, "I656:3057;5217:35484;1195:12347").component.exposed, false);
});

test("a brief below v17 is judged as it always was: no property rows required", () => {
  const doc = load();
  delete doc.componentProperties;
  doc.schemaVersion = 16;
  const { errors } = validateBriefJson(doc);
  assert.ok(!errors.some((e) => e.code === "PROPERTY_ROW_MISSING"));
});

// The brief's markdown table and the JSON rows are one list: `validate` reads them against each other.
import { validateBriefPair } from "../src/brief.mjs";
const loadMd = () => gunzipSync(readFileSync(fileURLToPath(new URL("design-handoff-media-block.md.gz", dir)))).toString("utf8");
const pair = (doc, md) => validateBriefPair(doc, md).findings.filter((f) => /^PAIR_PROPERTY/.test(f.code));

test("the real Media brief's markdown table and its componentProperties[] agree, row by row", () => {
  assert.deepEqual(pair(load(), loadMd()), []);
});

test("a markdown table cell that differs from its JSON row is PAIR_PROPERTY_ROW_MISMATCH, naming the row and the column", () => {
  const md = loadMd().replace(/(\| has-audio \| BOOLEAN \| )true( \|)/, "$1false$2");
  assert.notEqual(md, loadMd());
  const found = pair(load(), md);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, "PAIR_PROPERTY_ROW_MISMATCH");
  assert.equal(found[0].severity, "error");
  assert.match(found[0].message, /has-audio/);
  assert.match(found[0].message, /Value/);
});

test("a row dropped from the markdown table, or a row the JSON does not have, is a mismatch too", () => {
  const dropped = loadMd().split("\n").filter((line) => !/^\| Media › Media › \.ControlMedia \| #\S+ \| has-video \|/.test(line)).join("\n");
  assert.ok(pair(load(), dropped).some((f) => f.code === "PAIR_PROPERTY_ROW_MISMATCH" && /has-video/.test(f.message)));
  const doc = load();
  doc.componentProperties.pop();
  assert.ok(pair(doc, loadMd()).some((f) => f.code === "PAIR_PROPERTY_ROW_MISMATCH"));
});

test("JSON rows with no Component Properties section in the markdown is PAIR_PROPERTY_TABLE_MISSING; no rows and no section is fine", () => {
  const md = loadMd().replace(/### Component Properties[\s\S]*?(?=\n### )/, "");
  assert.ok(!md.includes("### Component Properties"));
  assert.ok(pair(load(), md).some((f) => f.code === "PAIR_PROPERTY_TABLE_MISSING"));
  const doc = load();
  delete doc.componentProperties;
  assert.deepEqual(pair(doc, md), []);
});
