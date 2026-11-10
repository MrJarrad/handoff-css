// `handoff-css components` (HT-111 components/blocks slice): how a system builds its components, and
// reuse-or-add for a component need. Three exports: a flat synthetic system, a tiered synthetic system
// with another naming scheme, and the real JHD layer export. Nothing in src/ may pass by knowing the house.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import Ajv2020 from "ajv/dist/2020.js";

import { dispatch } from "../src/cli.mjs";
import { buildComponentProfile, renderComponentProfileMarkdown } from "../src/component-profile.mjs";
import { resolveComponentNeeds } from "../src/resolve-component.mjs";
import { flatSystem, tieredSystem } from "./synthetic-components.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const jhd = () => JSON.parse(gunzipSync(readFileSync(path.join(root, "fixtures", "jhd-v19-2026-10-29", "overlay.json.gz"))).toString("utf8"));
const validate = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(path.join(root, "schema", "component-profile.v1.schema.json"), "utf8")));
const resolve = (profile, needs, rulings = null) => resolveComponentNeeds({ profile, needs, rulings });
const verdicts = (r) => Object.fromEntries(r.needs.map((x) => [x.id, x.verdict]));

test("flat system: PascalCase names, no categories, two recurring axes, one tier", () => {
  const p = buildComponentProfile(flatSystem());
  assert.equal(validate(p), true, JSON.stringify(validate.errors));
  assert.deepEqual([p.coverage.seen, p.coverage.defined, p.coverage.total], [3, 3, "unknown"]);
  assert.equal(p.naming.flat, true);
  assert.equal(p.naming.separator, null);
  assert.deepEqual(p.naming.leafCase, { Pascal: 3 });
  const variant = p.propertyModel.axes.find((a) => a.name === "variant");
  assert.equal(variant.components, 2);
  assert.deepEqual(variant.values, ["outline", "plain", "raised", "solid"]);
  assert.deepEqual(p.composition.tiers.map((t) => t.tier), [0]);
  assert.deepEqual(p.tokenBinding.byCollection, { semantic: 3 });
  assert.equal(p.components.find((c) => c.name === "Button").placed, 1);
});

test("tiered system: slash categories, boolean properties, three nesting tiers, primitive bindings", () => {
  const p = buildComponentProfile(tieredSystem());
  assert.equal(validate(p), true, JSON.stringify(validate.errors));
  assert.equal(p.naming.separator, "/");
  assert.equal(p.naming.flat, false);
  assert.deepEqual(p.naming.categoryPrefixes, { Atoms: 2, Molecules: 1, Organisms: 1 });
  assert.deepEqual(p.propertyModel.byType, { BOOLEAN: 5 });
  assert.deepEqual(p.composition.tiers.map((t) => [t.tier, t.components]), [
    [0, ["Atoms/Input", "Atoms/Label"]],
    [1, ["Molecules/FormField"]],
    [2, ["Organisms/Header"]],
  ]);
  assert.deepEqual(p.tokenBinding.byCollection, { primitive: 3 });
  assert.deepEqual(Object.keys(p.components.find((c) => c.name === "Molecules/FormField").nests), ["Atoms/Input", "Atoms/Label"]);
});

test("the two systems read differently, from the same code", () => {
  const [a, b] = [buildComponentProfile(flatSystem()), buildComponentProfile(tieredSystem())];
  assert.notDeepEqual(a.naming, b.naming);
  assert.notDeepEqual(a.propertyModel.byType, b.propertyModel.byType);
  assert.notEqual(a.composition.tiers.length, b.composition.tiers.length);
});

test("JHD layer export: read as a flat system with one nesting tier, and the profile validates", () => {
  const p = buildComponentProfile(jhd());
  assert.equal(validate(p), true, JSON.stringify(validate.errors));
  assert.equal(p.coverage.seen, 20);
  assert.equal(p.coverage.defined, 3);
  assert.equal(p.naming.flat, true);
  assert.equal(p.naming.private, 2);
  assert.deepEqual(p.composition.tiers.map((t) => t.tier), [0, 1]);
  assert.ok(p.propertyModel.axes.some((a) => a.name === "device"));
  assert.match(renderComponentProfileMarkdown(p), /of an unknown total/);
});

test("nothing in the component source knows a component, property or collection name from the house export", () => {
  const house = buildComponentProfile(jhd());
  const names = [...house.components.map((c) => c.name.replace(/^\./, "")), ...house.propertyModel.axes.map((a) => a.name), ...Object.keys(house.tokenBinding.byCollection)].filter((s) => s.length >= 5);
  for (const f of ["component-profile.mjs", "resolve-component.mjs", "components-cli.mjs"]) {
    const src = readFileSync(path.join(root, "src", f), "utf8");
    for (const name of names) assert.equal(src.includes(`"${name}"`) || src.includes(`'${name}'`), false, `${f} names ${name}`);
  }
});

test("a layer export without a layer tree is refused", () => {
  assert.throws(() => buildComponentProfile({ schema: "design-system-handoff" }), /not a Design Handoff layer export/);
});

// ---- resolve: flat system ---------------------------------------------------------------------
test("flat system: reuse first, set a property before forking, ask before adding", () => {
  const p = buildComponentProfile(flatSystem());
  const r = resolve(p, [
    { id: "n1", name: "Card" },
    { id: "n2", name: "Button", wants: { props: { variant: "outline", size: "lg" } } },
    { id: "n3", name: "Button", wants: { props: { size: "xl" } } },
    { id: "n4", name: "ActionButton" },
    { id: "n5", name: "Toolbar", wants: { children: ["Button", "Tag"] } },
    { id: "n6", name: "Tooltip" },
    { id: "n7", name: "Tooltip", wants: { children: ["Popover"] } },
    { id: "n8", name: "Button", wants: { props: { variant: "solid", size: "md" } } },
  ]);
  assert.deepEqual(verdicts(r), { n1: "REUSE", n2: "REUSE_WITH_PROP", n3: "PROP_GAP", n4: "SIBLING", n5: "COMPOSE", n6: "NEW_COMPONENT", n7: "NEW_COMPONENT", n8: "REUSE" });
  assert.deepEqual(r.needs[1].set, { variant: "outline", size: "lg" });
  assert.deepEqual(r.needs[4].parts, ["Button", "Tag"]);
  assert.equal(r.needs[3].candidates[0].name, "Button");
  assert.equal(r.needs[5].pattern.naming.flat, true);
  assert.deepEqual(r.needs[6].missingParts, ["Popover"]);
  assert.equal(r.open, 5);
  for (const x of r.needs.filter((y) => y.open)) assert.deepEqual(x.fallback, { kind: "local-component", status: "assumed-ask" });
  for (const x of r.needs.filter((y) => !y.open)) assert.equal(x.fallback, undefined);
});

// ---- resolve: tiered system -------------------------------------------------------------------
test("tiered system: the same ladder, a different pattern handed to a new-component question", () => {
  const p = buildComponentProfile(tieredSystem());
  const r = resolve(p, [
    { id: "t1", name: "Atoms/Input", wants: { props: { hasIcon: true } } },
    { id: "t2", name: "atoms/input" },
    { id: "t3", name: "Molecules/SearchField" },
    { id: "t4", name: "Pages/Home" },
    { id: "t5", name: "Panel", wants: { children: ["Atoms/Label", "Molecules/FormField"] } },
    { id: "t6", name: "Atoms/Input", wants: { props: { hasIcon: "maybe" } } },
  ]);
  assert.deepEqual(verdicts(r), { t1: "REUSE_WITH_PROP", t2: "SIBLING", t3: "SIBLING", t4: "NEW_COMPONENT", t5: "COMPOSE", t6: "PROP_GAP" });
  assert.equal(r.needs[3].pattern.naming.separator, "/");
  assert.equal(r.needs[3].pattern.naming.askedPrefixKnown, false);
  assert.deepEqual(r.needs[3].pattern.recurringProperties, []);
  assert.equal(r.needs[2].candidates[0].name, "Molecules/FormField");
});

test("a property the system's components share is handed to a new component as the pattern", () => {
  const r = resolve(buildComponentProfile(flatSystem()), [{ id: "p", name: "Tooltip" }]);
  assert.deepEqual(r.needs[0].pattern.recurringProperties.map((x) => x.name), ["variant"]);
});

// ---- rulings -------------------------------------------------------------------------------------
const table = (...rows) => ["| kind | figma | ruling | code | note |", "| --- | --- | --- | --- | --- |", ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

test("rulings settle an open need; a use ruling for a component the export lost is stale; a new row reads REUSE once it exists", () => {
  const p = buildComponentProfile(flatSystem());
  const needs = [{ id: "r1", name: "ActionButton" }, { id: "r2", name: "Tooltip" }, { id: "r3", name: "Card" }, { id: "r4", name: "Tag" }];
  const r = resolve(p, needs, table(["resolve-component", "r1", "use", "Button", ""], ["resolve-component", "r2", "use", "Gone", ""], ["resolve-component", "r3", "skip", "", ""], ["resolve-component", "r4", "new", "Tag", ""]));
  assert.deepEqual(verdicts(r), { r1: "RULED", r2: "RULING_STALE", r3: "RULED", r4: "REUSE" });
  assert.deepEqual(r.needs.map((x) => x.open), [false, true, false, false]);
  const approved = resolve(p, [{ id: "r5", name: "Tooltip" }], table(["resolve-component", "r5", "new", "Tooltip", "approved"]));
  assert.equal(approved.needs[0].verdict, "RULED");
  assert.equal(approved.open, 0);
});

test("a need file that does not match the schema, or repeats an id, is refused", () => {
  const p = buildComponentProfile(flatSystem());
  assert.throws(() => resolve(p, [{ id: "x" }]), /resolve-component-need/);
  assert.throws(() => resolve(p, [{ id: "x", name: "A" }, { id: "x", name: "B" }]), /duplicate need id/);
});

// ---- the command -----------------------------------------------------------------------------------
const run = async (args, cwd) => {
  let out = "";
  let err = "";
  const code = await dispatch(args, { cwd, stdout: { write: (s) => (out += s) }, stderr: { write: (s) => (err += s) } });
  return { code, out, err };
};

test("components command: writes the profile, checks drift, resolves needs, exits 2 while a need is open", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "components-"));
  const [a, b] = ["flat.json", "tiered.json"];
  writeFileSync(path.join(dir, a), JSON.stringify(flatSystem()));
  writeFileSync(path.join(dir, b), JSON.stringify(tieredSystem()));

  let r = await run(["components", "--export", a, "--export", b, "--out", "out"], dir);
  assert.equal(r.code, 0, r.err);
  const profile = JSON.parse(readFileSync(path.join(dir, "out", "component-profile.json"), "utf8"));
  assert.equal(profile.coverage.seen, 7);
  assert.equal(profile.source.documents.length, 2);

  assert.equal((await run(["components", "--export", a, "--export", b, "--out", "out", "--check"], dir)).code, 0);
  writeFileSync(path.join(dir, "out", "component-profile.md"), "stale");
  r = await run(["components", "--export", a, "--export", b, "--out", "out", "--check"], dir);
  assert.equal(r.code, 1);
  assert.match(r.err, /out of date/);

  writeFileSync(path.join(dir, "needs.json"), JSON.stringify([{ id: "c1", name: "Card" }, { id: "c2", name: "Tooltip" }]));
  r = await run(["components", "--export", a, "--need", "needs.json", "--out", "res"], dir);
  assert.equal(r.code, 2);
  assert.match(r.err, /1 need\(s\) wait for a ruling/);
  assert.equal(existsSync(path.join(dir, "res", "component-resolve-report.md")), true);
  assert.match(readFileSync(path.join(dir, "res", "component-resolve-report.md"), "utf8"), /resolve-component \| c2/);

  writeFileSync(path.join(dir, "rulings.md"), table(["resolve-component", "c2", "new", "Tooltip", "approved"]));
  assert.equal((await run(["components", "--export", a, "--need", "needs.json", "--rulings", "rulings.md", "--out", "res"], dir)).code, 0);

  assert.equal((await run(["components"], dir)).code, 1);
  assert.equal((await run(["components", "--export", "nope.json"], dir)).code, 1);
});
