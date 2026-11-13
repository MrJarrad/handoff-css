// The Design System Handoff export's component inventory on its own (no layer export), and keyed so that
// components sharing a name on different pages stay separate. Fixtures are synthetic exports shaped like the
// real one (schema 20: components[] of { id, name, kind, page, properties[] }).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

import { dispatch } from "../src/cli.mjs";
import { buildComponentProfile, renderComponentProfileMarkdown } from "../src/component-profile.mjs";
import { resolveComponentNeeds } from "../src/resolve-component.mjs";
import { scanComponentSource, compareComponents } from "../src/component-source.mjs";
import { flatSystem } from "./synthetic-components.mjs";

const validate = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(new URL("../schema/component-profile.v2.schema.json", import.meta.url), "utf8")));
const prop = (name, type, defaultValue, options = []) => ({ name, type, defaultValue, options });
const library = (components, documentName = "Library") => ({ schema: "design-system-handoff", schemaVersion: 20, documentName, contentHash: "h".repeat(64), components });
// Media, List and FeatureText exist on two pages each, as in the real library.
const LIB = library([
  { id: "1:1", name: "Media", kind: "set", page: "Block", properties: [prop("has-spacer-top", "BOOLEAN", true), prop("layout", "VARIANT", "default", ["default"])] },
  { id: "2:1", name: "Media", kind: "set", page: "Component", properties: [prop("layout", "VARIANT", "default", ["default", "wide"])] },
  { id: "3:1", name: "List", kind: "set", page: "Block", properties: [] },
  { id: "3:2", name: "List", kind: "set", page: "Component", properties: [] },
  { id: "4:1", name: "Cell", kind: "component", page: "Component", properties: [prop("title", "TEXT", "Title")] },
]);

test("inventory only: the profile is the inventory, one row per library component, none counted as placed", () => {
  const p = buildComponentProfile([], { inventory: [LIB] });
  assert.equal(validate(p), true, JSON.stringify(validate.errors));
  assert.deepEqual([p.coverage.seen, p.coverage.defined, p.coverage.total, p.coverage.instanceOnly], [5, 5, 5, 0]);
  assert.equal(p.coverage.basis, "inventory");
  assert.deepEqual(p.components.map((c) => [c.name, c.page, c.id]), [["Cell", "Component", "4:1"], ["List", "Block", "3:1"], ["List", "Component", "3:2"], ["Media", "Block", "1:1"], ["Media", "Component", "2:1"]]);
  const media = p.components.find((c) => c.id === "1:1");
  assert.deepEqual(media.properties.map((x) => [x.name, x.type, x.default, x.options]), [["has-spacer-top", "BOOLEAN", true, null], ["layout", "VARIANT", "default", ["default"]]]);
  assert.equal(p.components.every((c) => c.placed === 0 && c.defined), true);
  assert.deepEqual(p.source.documents, []);
});

test("inventory only: a layer export is still required when there is no inventory", () => {
  assert.throws(() => buildComponentProfile([]), /layer export/);
});

test("same-named components on different pages count separately in the total, and are named when a layer places the name", () => {
  const p = buildComponentProfile(flatSystem(), { inventory: [library([
    { id: "1:1", name: "Button", kind: "set", page: "Block", properties: [] },
    { id: "2:1", name: "Button", kind: "set", page: "Component", properties: [] },
    { id: "3:1", name: "Tooltip", kind: "set", page: "Component", properties: [] },
  ])] });
  assert.equal(p.coverage.total, 3);
  assert.deepEqual(p.coverage.notSeen.map((x) => [x.name, x.page]), [["Tooltip", "Component"]]);
  assert.deepEqual(p.coverage.ambiguousNames, [{ name: "Button", pages: ["Block", "Component"] }]);
  assert.equal(validate(p), true, JSON.stringify(validate.errors));
});

test("a name unseen by layers lists every page it is on under notSeen", () => {
  const p = buildComponentProfile(flatSystem(), { inventory: [LIB] });
  assert.deepEqual(p.coverage.notSeen.filter((x) => x.name === "Media").map((x) => x.page), ["Block", "Component"]);
  assert.equal(p.coverage.total, 5);
});

test("the same library exported twice counts a component once", () => {
  assert.equal(buildComponentProfile([], { inventory: [LIB, LIB] }).coverage.total, 5);
});

test("inventory only: the markdown says there is no layer export and nothing is counted as placed", () => {
  const md = renderComponentProfileMarkdown(buildComponentProfile([], { inventory: [LIB] }));
  assert.match(md, /5 components defined in the library/);
  assert.match(md, /no layer export/i);
  assert.match(md, /Media/);
});

test("resolve over an inventory-only profile ranks same-named components apart, each with its page", () => {
  const profile = buildComponentProfile([], { inventory: [LIB] });
  const r = resolveComponentNeeds({ profile, needs: [{ id: "m", name: "Media" }], inventory: [LIB] });
  assert.deepEqual(r.needs[0].candidates.filter((c) => c.name === "Media").map((c) => c.page).sort(), ["Block", "Component"]);
});

const CODE = `
export function Media({ layout = "default", hasSpacerTop }: { layout?: "default" | "wide"; hasSpacerTop?: boolean }) { return <div /> }
export function Cell() { return <div /> }
export function Extra() { return <div /> }
`;

test("compare over an inventory-only profile: each library component is a row, same-named ones both match, rows carry their page", () => {
  const r = compareComponents(buildComponentProfile([], { inventory: [LIB] }), scanComponentSource([{ path: "c.tsx", text: CODE }]));
  assert.deepEqual(r.counts.components, { design: 5, matched: 3, designOnly: 2, codeOnly: 1 });
  assert.deepEqual(r.matched.filter((m) => m.name === "Media").map((m) => m.page), ["Block", "Component"]);
  assert.deepEqual(r.designOnly.map((x) => [x.name, x.page]), [["List", "Block"], ["List", "Component"]]);
  const block = r.matched.find((m) => m.name === "Media" && m.page === "Block");
  // The Block page's Media has one layout value, the code takes two: a value gap only on that page's row.
  assert.deepEqual(block.props.map((x) => [x.name, x.status]), [["has-spacer-top", "matched"], ["layout", "value-gap"]]);
  assert.deepEqual(block.props[1].onlyInCode, ["wide"]);
  const comp = r.matched.find((m) => m.name === "Media" && m.page === "Component");
  assert.deepEqual(comp.props.map((x) => [x.name, x.status]), [["layout", "matched"]]);
});

function run(args, cwd) {
  let out = "", err = "";
  return dispatch(["components", ...args], { cwd, stdout: { write: (s) => (out += s) }, stderr: { write: (s) => (err += s) } }).then((code) => ({ code, out, err }));
}

test("components --ds-export alone writes the profile; with --src it also writes the compare", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hcss-inv-"));
  mkdirSync(path.join(dir, "src"));
  writeFileSync(path.join(dir, "src", "c.tsx"), CODE);
  writeFileSync(path.join(dir, "ds.json"), JSON.stringify(LIB));
  const a = await run(["--ds-export", "ds.json", "--out", "out"], dir);
  assert.equal(a.code, 0, a.err);
  assert.match(a.out, /5 components defined in the library/);
  assert.equal(JSON.parse(readFileSync(path.join(dir, "out", "component-profile.json"), "utf8")).coverage.total, 5);
  const b = await run(["--ds-export", "ds.json", "--src", "src", "--out", "out2"], dir);
  assert.equal(b.code, 0, b.err);
  assert.equal(JSON.parse(readFileSync(path.join(dir, "out2", "component-code-compare.json"), "utf8")).counts.components.matched, 3);
  assert.equal((await run(["--out", "out3"], dir)).code, 1);
});

test("with a layer export too, the profile is unchanged by the inventory's pages (layers still observed by name)", () => {
  const p = buildComponentProfile(flatSystem(), { inventory: [LIB] });
  assert.equal(p.coverage.basis, undefined);
  assert.equal(p.coverage.seen, 3);
});
