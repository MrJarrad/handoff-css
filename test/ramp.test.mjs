// `handoff-css ramp` (HT-112 B-S2): a whole primitive ramp in the system's own steps and naming, and the
// step each named semantic colour uses in each mode. Two exports: the real v19 fixture, and a synthetic
// system that shares no names, separators, step numbers or mode names with it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, existsSync, readdirSync as ls, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import Ajv2020 from "ajv/dist/2020.js";

import { dispatch } from "../src/cli.mjs";
import { proposeRamp, renderRampMarkdown } from "../src/ramp.mjs";
import { grade } from "../src/color-engine/index.mjs";
import { synthetic, variable, cell } from "./synthetic-export.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureGz = path.join(root, "fixtures", "jhd-v19-2026-10-29", "design-system-handoff.json.gz");
const jhd = () => JSON.parse(gunzipSync(readFileSync(fixtureGz)).toString("utf8"));
const validate = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(path.join(root, "schema", "ramp-proposal.v1.schema.json"), "utf8")));
const ANCHORS = [{ hex: "#14d7fb", step: 300 }, { hex: "#2b67b9", step: 700 }];
const FIFTY = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const run = async (args) => {
  const out = [];
  const err = [];
  const dir = mkdtempSync(path.join(tmpdir(), "ramp-"));
  const code = await dispatch(["ramp", "--export", fixtureGz, "--out", dir, ...args], {
    cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(""), err: err.join(""), dir };
};

test("v19: the proposed ramp is on the system's own 50–950 scale and holds both anchors exactly", () => {
  const p = proposeRamp({ doc: jhd(), anchors: ANCHORS, name: "cyan" });
  assert.equal(p.basis.kind, "fitted");
  assert.deepEqual(p.basis.steps, FIFTY);
  const [r] = p.ramps;
  assert.deepEqual(r.variables.map((v) => v.step), FIFTY);
  assert.equal(r.variables.find((v) => v.step === 300).hex, "#14d7fb");
  assert.equal(r.variables.find((v) => v.step === 700).hex, "#2b67b9");
  assert.deepEqual(r.variables.filter((v) => v.anchor).map((v) => v.step), [300, 700]);
  assert.equal(p.writes, "nothing");
  assert.ok(validate(p), JSON.stringify(validate.errors));
});

test("v19: names follow the system's own (collection, parent group, web name), nothing assumed", () => {
  const [r] = proposeRamp({ doc: jhd(), anchors: ANCHORS, name: "cyan" }).ramps;
  assert.equal(r.collection, "color-primitives");
  assert.equal(r.variables[0].name, "color/palette/cyan/50");
  assert.equal(r.variables[0].webName, "--color-palette-cyan-50");
});

test("synthetic: its own scale, parent group and separators, not the house's", () => {
  const p = proposeRamp({ doc: synthetic(), anchors: [{ hex: "#2b67b9" }], name: "Sky" });
  assert.deepEqual(p.basis.steps, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
  const [r] = p.ramps;
  assert.equal(r.collection, "Foundations");
  assert.deepEqual(r.variables.map((v) => v.name), [10, 20, 30, 40, 50, 60, 70, 80, 90].map((s) => `Hue/Sky/${s}`));
  assert.equal(r.variables[0].webName, "--hue-sky-10");
});

test("--from-scratch (and a system with no colour ramps) takes the engine's defaults, 100–900", () => {
  const p = proposeRamp({ doc: jhd(), anchors: [{ hex: "#2b67b9" }], fromScratch: true, name: "blue" });
  assert.equal(p.basis.kind, "defaults");
  assert.deepEqual(p.ramps[0].variables.map((v) => v.step), [100, 200, 300, 400, 500, 600, 700, 800, 900]);
  const none = synthetic();
  none.collections[0].variables = none.collections[0].variables.filter((v) => !v.name.startsWith("Hue/"));
  const q = proposeRamp({ doc: none, anchors: [{ hex: "#2b67b9" }], name: "blue" });
  assert.equal(q.basis.kind, "defaults");
  assert.match(q.basis.reason, /no colour ramps/);
});

test("the name is the caller's or a generated one; neither is forced", () => {
  const given = proposeRamp({ doc: jhd(), anchors: ANCHORS, name: "glow" });
  assert.equal(given.ramps[0].nameSource, "given");
  assert.equal(given.ramps[0].name, "glow");
  assert.deepEqual(given.questions, []);
  const gen = proposeRamp({ doc: jhd(), anchors: ANCHORS });
  assert.equal(gen.ramps[0].nameSource, "generated");
  assert.match(gen.ramps[0].name, /^[a-z0-9-]+$/);
  assert.equal(gen.questions.length, 1);
  assert.match(gen.questions[0].ask, /give your own/);
  assert.equal(gen.ramps[0].variables[0].name, `color/palette/${gen.ramps[0].name}/50`);
});

test("a name the system already uses for a ramp is refused; a generated name steps around it", () => {
  assert.throws(() => proposeRamp({ doc: jhd(), anchors: ANCHORS, name: "cognac" }), /already a ramp/);
  const taken = proposeRamp({ doc: jhd(), anchors: [{ hex: "#a33001" }] }).ramps[0].name;
  assert.notEqual(taken, "cognac"); // #a33001 is the system's cognac-800; the name is not offered again
});

test("anchors that do not make one ramp become one ramp each, and --name cannot cover them", () => {
  const far = [{ hex: "#d81b60" }, { hex: "#00897b" }];
  const p = proposeRamp({ doc: jhd(), anchors: far });
  assert.equal(p.merge.merge, false);
  assert.equal(p.ramps.length, 2);
  assert.throws(() => proposeRamp({ doc: jhd(), anchors: far, name: "x" }), /run once per anchor/);
  assert.throws(() => proposeRamp({ doc: jhd(), anchors: far, forColours: [{ name: "color/content/default/brand" }], on: ["color/background/default/primary"] }), /one ramp/);
});

const MAP = { forColours: [{ name: "color/content/default/brand" }], on: ["color/background/default/primary"] };

test("v19: a row per mode of the semantic collection, each passing 4.5 on its own surface, with a reason", () => {
  const doc = jhd();
  const p = proposeRamp({ doc, anchors: ANCHORS, name: "cyan", ...MAP });
  const modes = doc.collections.find((c) => c.name === "color").modes.map((m) => m.name);
  assert.deepEqual(p.mapping.map((m) => m.mode), modes);
  for (const m of p.mapping) {
    assert.equal(m.pass, true);
    assert.ok(m.ratio >= 4.5, `${m.mode} ${m.ratio}`);
    assert.ok(m.reason.length > 10);
    assert.equal(grade(m.hex, m.surfaces[0].hex).ratio, m.ratio);
    assert.equal(p.ramps[0].variables.find((v) => v.step === m.step).hex, m.hex);
  }
  assert.equal(p.open, 0);
  assert.ok(validate(p), JSON.stringify(validate.errors));
});

test("a step is eased back only when it overshoots, never an anchor, and the ramp says so", () => {
  const p = proposeRamp({ doc: jhd(), anchors: ANCHORS, name: "cyan", ...MAP });
  const eased = p.ramps[0].variables.filter((v) => v.nudged);
  for (const v of eased) {
    assert.equal(v.anchor, undefined);
    assert.ok(p.mapping.some((m) => m.step === v.step && /eased back/.test(m.reason)));
  }
  for (const m of p.mapping.filter((x) => anchorsOf(p).includes(x.step))) assert.equal(m.hex, anchorHex(p, m.step));
});
const anchorsOf = (p) => p.ramps[0].variables.filter((v) => v.anchor).map((v) => v.step);
const anchorHex = (p, s) => p.ramps[0].variables.find((v) => v.step === s).hex;

test("--keep-anchor holds an anchor step across modes when it passes there; without it the step is mirrored", () => {
  const doc = synthetic();
  const sem = doc.collections.find((c) => c.name === "Semantic");
  sem.variables.push(variable("Page/bg", "COLOR", [{ ...cell("d1", "#FFFFFFFF"), modeName: "Day" }, { ...cell("n1", "#000000FF"), modeName: "Night" }]));
  const a = { doc, anchors: [{ hex: "#767676", step: 50 }], name: "slate", forColours: [{ name: "Ink/main", step: 50 }], on: ["Page/bg"] };
  const plain = proposeRamp(a).mapping.find((m) => m.mode === "Night");
  assert.match(plain.reason, /mirrored/);
  const kept = proposeRamp({ ...a, keepAnchor: true }).mapping.find((m) => m.mode === "Night");
  assert.equal(kept.step, 50);
  assert.equal(kept.hex, "#767676");
  assert.match(kept.reason, /kept across modes/);
});

test("synthetic: the mode set and the base mode are the collection's own; a darker mode is mirrored", () => {
  const doc = synthetic();
  const p = proposeRamp({ doc, anchors: [{ hex: "#2b67b9" }], name: "Sky", forColours: [{ name: "Ink/main", step: 30 }], on: ["Surface/main"], use: "ui" });
  assert.deepEqual(p.mapping.map((m) => [m.collection, m.mode]), [["Semantic", "Day"], ["Semantic", "Night"]]);
  assert.ok(p.mapping.every((m) => m.use === "ui"));
});

test("mapping input errors: --for without --on, a step the ramp lacks, a surface from another collection, a missing variable", () => {
  const base = { doc: jhd(), anchors: ANCHORS, name: "cyan" };
  assert.throws(() => proposeRamp({ ...base, forColours: [{ name: "color/content/default/brand" }] }), /--for needs --on/);
  assert.throws(() => proposeRamp({ ...base, ...MAP, forColours: [{ name: "color/content/default/brand", step: 123 }] }), /not a step of the ramp/);
  assert.throws(() => proposeRamp({ ...base, forColours: MAP.forColours, on: ["color/palette/cognac/800"] }), /not .* with|in color-primitives/);
  assert.throws(() => proposeRamp({ ...base, forColours: [{ name: "color/content/nope" }], on: MAP.on }), /no variable named/);
});

test("a colour no step can carry on every surface is an open mapping, not a guess", () => {
  const doc = synthetic();
  const sem = doc.collections.find((c) => c.name === "Semantic");
  sem.variables.push(variable("Panel/dark", "COLOR", [{ ...cell("d1", "#101010FF"), modeName: "Day" }, { ...cell("n1", "#101010FF"), modeName: "Night" }]));
  sem.variables.push(variable("Panel/pale", "COLOR", [{ ...cell("d1", "#F0F0F0FF"), modeName: "Day" }, { ...cell("n1", "#F0F0F0FF"), modeName: "Night" }]));
  const p = proposeRamp({ doc, anchors: [{ hex: "#2b67b9" }], name: "Sky", forColours: [{ name: "Ink/main" }], on: ["Panel/dark", "Panel/pale"] });
  assert.ok(p.mapping.every((m) => m.step === null && m.pass === false && /no step of the ramp/.test(m.reason)));
  assert.equal(p.open, 2);
  assert.ok(validate(p), JSON.stringify(validate.errors));
});

test("the proposal is deterministic: the same input gives the same bytes", () => {
  const a = JSON.stringify(proposeRamp({ doc: jhd(), anchors: ANCHORS, ...MAP }));
  const b = JSON.stringify(proposeRamp({ doc: jhd(), anchors: ANCHORS, ...MAP }));
  assert.equal(a, b);
});

test("markdown: the ramp, the name question, the mapping, and that nothing was written into Figma", () => {
  const md = renderRampMarkdown(proposeRamp({ doc: jhd(), anchors: ANCHORS, ...MAP }));
  assert.match(md, /Nothing has been written into Figma/);
  assert.match(md, /\*\*Question:\*\*/);
  assert.match(md, /## Semantic colours, by mode/);
  assert.match(md, /color\/palette\/.+\/300/);
});

test("CLI: usage errors exit 1; a settled run exits 0 and writes exactly the two files", async () => {
  const bad = await dispatch(["ramp", "--export", fixtureGz], { cwd: root, stdout: { write() {} }, stderr: { write() {} } });
  assert.equal(bad, 1);
  const r = await run(["--anchor", "#14d7fb@300", "--anchor", "#2b67b9@700", "--name", "cyan", "--for", "color/content/default/brand", "--on", "color/background/default/primary"]);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(readdirSync(r.dir).sort(), ["ramp-proposal.json", "ramp-proposal.md"]);
  const p = JSON.parse(readFileSync(path.join(r.dir, "ramp-proposal.json"), "utf8"));
  assert.ok(validate(p));
  assert.equal(p.ramps[0].variables.find((v) => v.step === 300).hex, "#14d7fb");
  assert.match(r.out, /nothing written into Figma/);
  const j = await run(["--anchor", "#14d7fb@300", "--anchor", "#2b67b9@700", "--name", "cyan", "--json"]);
  assert.equal(JSON.parse(j.out).ramps[0].name, "cyan");
});

test("CLI: a generated name prints the question; an unknown flag, a bad hex and --for without --on exit 1", async () => {
  const g = await run(["--anchor", "#14d7fb@300", "--anchor", "#2b67b9@700"]);
  assert.equal(g.code, 0);
  assert.match(g.out, /question: Keep the generated ramp name/);
  assert.equal((await run(["--anchor", "#14d7fb", "--wat"])).code, 1);
  const bad = await run(["--anchor", "teal"]);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /not a colour/);
  assert.equal((await run(["--anchor", "#2b67b9", "--for", "color/content/default/brand"])).code, 1);
});

test("nothing in the shipped files or tests names the product the ramp method came from", () => {
  const word = new RegExp(["or", "bit"].join(""), "i");
  const files = [];
  const walk = (d) => {
    for (const f of ls(d)) {
      if (["node_modules", ".git", "fixtures"].includes(f)) continue;
      const p = path.join(d, f);
      statSync(p).isDirectory() ? walk(p) : /\.(mjs|md|json)$/.test(f) && files.push(p);
    }
  };
  walk(root);
  assert.ok(files.length > 20);
  assert.deepEqual(files.filter((f) => word.test(readFileSync(f, "utf8"))), []);
});

test("the proposal reads no house names: src/ramp*.mjs and the helpers contain none", () => {
  for (const f of ["src/ramp.mjs", "src/ramp-cli.mjs", "src/color-engine/map.mjs", "src/color-engine/wcag.mjs"]) {
    const src = readFileSync(path.join(root, f), "utf8");
    assert.doesNotMatch(src, /["'`](light|dark|core|palette|color-primitives|bttf)["'`]/i, f);
  }
  assert.ok(existsSync(path.join(root, "schema", "ramp-proposal.v1.schema.json")));
});

test("CLI: a mapping no step can satisfy exits 2 and says which", async () => {
  const doc = synthetic();
  const sem = doc.collections.find((c) => c.name === "Semantic");
  sem.variables.push(variable("Panel/dark", "COLOR", [{ ...cell("d1", "#101010FF"), modeName: "Day" }, { ...cell("n1", "#101010FF"), modeName: "Night" }]));
  sem.variables.push(variable("Panel/pale", "COLOR", [{ ...cell("d1", "#F0F0F0FF"), modeName: "Day" }, { ...cell("n1", "#F0F0F0FF"), modeName: "Night" }]));
  const dir = mkdtempSync(path.join(tmpdir(), "ramp-open-"));
  writeFileSync(path.join(dir, "export.json"), JSON.stringify(doc));
  const err = [];
  const code = await dispatch(["ramp", "--export", "export.json", "--anchor", "#2b67b9", "--name", "Sky", "--for", "Ink/main", "--on", "Panel/dark", "--on", "Panel/pale", "--out", "out"], {
    cwd: dir, stdout: { write() {} }, stderr: { write: (s) => err.push(s) },
  });
  assert.equal(code, 2);
  assert.match(err.join(""), /2 mapping\(s\) have no passing step/);
});

// --- r1 ambers -------------------------------------------------------------------------------------------

test("CLI (amber 1): a value flag with no value, an empty value or a stray positional exits 1 and writes nothing", async () => {
  const A = ["--anchor", "#14d7fb"];
  const cases = {
    "--name then a flag": [...A, "--name", "--from-scratch"],
    "--name last": [...A, "--name"],
    "--name empty": [...A, "--name", ""],
    "--anchor without value": [...A, "--anchor"],
    "--anchor empty": [...A, "--anchor", ""],
    "--out without value": [...A, "--out", "--json"],
    "--use without value": [...A, "--use"],
    "stray positional": [...A, "stray"],
  };
  for (const [what, args] of Object.entries(cases)) {
    const r = await run(args);
    assert.equal(r.code, 1, `${what}: exit ${r.code}`);
    assert.deepEqual(readdirSync(r.dir), [], `${what}: wrote files`);
    assert.match(r.err, /ramp:/, what);
  }
});

test("CLI (amber 1): the strict parse leaves a good run alone, flags in any order", async () => {
  const r = await run(["--name", "cyan", "--from-scratch", "--anchor", "#14d7fb", "--json"]);
  assert.equal(r.code, 0, r.err);
  assert.equal(JSON.parse(r.out).ramps[0].name, "cyan");
});
