// HT-134: `handoff-css contrast` — fg/bg pairs resolved per theme mode, opacity
// compositions included, graded against WCAG AA. The two exports are the contract,
// read at run time. The expected ratios are the three PF-1743 measurements recorded
// in the vault backlog (4.33, 2.97, 2.30), an independent source — not recomputed here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dispatch } from "../src/cli.mjs";
import { contrastReport, pairsFromBrief } from "../src/contrast.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "ht134-contrast");
const before = path.join(dir, "ds-export-16-nov.json.gz");
const after = path.join(dir, "ds-export-21-nov.json.gz");
const pairs = path.join(dir, "action-pairs.json");

async function contrast(args) {
  let out = "";
  const code = await dispatch(["contrast", ...args, "--json"], { stdout: { write: (s) => { out += s; } }, stderr: { write: () => {} } });
  return { code, report: out ? JSON.parse(out) : null };
}
const row = (report, id, mode) => report.rows.find((r) => r.id === id && r.mode === mode);

test("the 16 Nov export: the three PF-1743 fails are flagged at the recorded ratios, in Time Circuits light", async () => {
  const { code, report } = await contrast(["--export", before, "--pairs", pairs]);
  assert.equal(code, 1, "a failing pair makes the run red");
  const expected = { "action-label": 4.33, "action-focus-ring": 2.97, "switch-inactive-half": 2.30 };
  for (const [id, ratio] of Object.entries(expected)) {
    const r = row(report, id, "bttf");
    assert.equal(r.pass, false, `${id} is a fail`);
    assert.ok(Math.abs(r.ratio - ratio) <= (id === "switch-inactive-half" ? 0.005 : 0.02), `${id}: ${r.ratio} vs recorded ${ratio}`);
  }
});

test("the 21 Nov export: the remap clears all three in Time Circuits light", async () => {
  const { report } = await contrast(["--export", after, "--pairs", pairs]);
  for (const id of ["action-label", "action-focus-ring", "switch-inactive-half"]) {
    assert.equal(row(report, id, "bttf").pass, true, id);
  }
});

// --- pairs read from a layer brief ----------------------------------------------------

const fill = (token) => ({ type: "SOLID", color: "#000000FF", token });
const node = (type, name, fills, children = []) => ({ id: name, name, type, visible: true, fills, strokes: [], children });

test("a text node's token fill is graded against the nearest ancestor's token fill", () => {
  const tree = node("FRAME", "card", [fill("color/background/default/secondary")], [
    node("INSTANCE", "action", [fill("color/background/action/primary")], [
      node("TEXT", "label", [fill("color/content/action/primary")]),
    ]),
  ]);
  const { pairs } = pairsFromBrief({ layerTree: [tree] });
  assert.deepEqual(pairs.map(({ fg, bg, use }) => ({ fg, bg, use })), [
    { fg: "color/content/action/primary", bg: "color/background/action/primary", use: "text" },
  ]);
});

test("a non-text leaf is graded at the non-text floor; a surface (frame, instance) is not a foreground", () => {
  const tree = node("INSTANCE", "action", [fill("color/background/action/primary")], [
    node("VECTOR", "icon", [fill("color/content/action/primary")]),
    node("FRAME", "inner", [fill("color/background/action/secondary")]),
  ]);
  const { pairs } = pairsFromBrief({ layerTree: [tree] });
  assert.deepEqual(pairs.map((p) => p.use), ["ui"]);
});

test("with no fill behind it a node sits on the page colour; an unbound fill is reported, never guessed", () => {
  const unbound = { type: "SOLID", color: "#FF0000FF" };
  const tree = node("FRAME", "root", [], [
    node("TEXT", "on-page", [fill("color/content/default/primary")]),
    node("FRAME", "raw", [unbound], [node("TEXT", "on-raw", [fill("color/content/default/primary")])]),
    node("TEXT", "raw-text", [unbound]),
  ]);
  const { pairs, skipped } = pairsFromBrief({ layerTree: [tree] }, { page: "color/background/default/primary" });
  assert.deepEqual(pairs.map((p) => p.bg), ["color/background/default/primary"]);
  assert.deepEqual(skipped.map((s) => [s.node, s.reason]), [["on-raw", "backdrop-unbound"], ["raw-text", "fill-unbound"]]);
});

test("the same pair on many nodes is one pair that names each node", () => {
  const text = (name) => node("TEXT", name, [fill("color/content/action/primary")]);
  const tree = node("INSTANCE", "action", [fill("color/background/action/primary")], [text("a"), text("b")]);
  const { pairs } = pairsFromBrief({ layerTree: [tree] });
  assert.equal(pairs.length, 1);
  assert.deepEqual(pairs[0].nodes, ["a", "b"]);
});

test("contrast --brief reads the pairs off a real layer brief and says what it could not grade", async () => {
  const script = path.join(dir, "..", "script-2026-10-29");
  const { report } = await contrast(["--export", path.join(script, "design-system-handoff.json.gz"), "--brief", path.join(script, "navigation.json.gz")]);
  assert.ok(report.rows.length > 0, "the navigation brief yields graded rows");
  assert.ok(report.rows.every((r) => r.source === "brief" && Number.isFinite(r.ratio)));
  for (const key of ["unresolved", "skipped", "notGraded"]) assert.ok(key in report, key);
});

// A one-mode export of two opaque colours: the page colour and a foreground.
const tiny = (fgHex) => {
  const v = (id, name, raw) => ({ id, name, modes: [{ modeId: "m", modeName: "light", raw }] });
  return {
    collections: [{
      id: "c", name: "color", defaultModeId: "m", modeMapping: [{ modeId: "m", modeName: "light", isTheme: true }],
      variables: [v("v1", "page", "#FFFFFFFF"), v("v2", "ink", `${fgHex}FF`)],
    }],
  };
};

test("the verdict is taken on the unrounded ratio: 2.9953 is a fail although it prints as 3.00", () => {
  const edge = contrastReport(tiny("#959595"), { pairs: [{ id: "edge", fg: "ink", bg: "page", use: "ui" }], page: "page" }).rows[0];
  assert.equal(edge.ratio, 3);
  assert.equal(edge.pass, false);
  const clear = contrastReport(tiny("#949494"), { pairs: [{ id: "edge", fg: "ink", bg: "page", use: "ui" }], page: "page" }).rows[0];
  assert.equal(clear.pass, true);
});

// --- HT-135: a ring effect style is graded against BOTH neighbours ---------------------------
// The outside (page) and inside (component fill) numbers for the Action ring are the PF-1743
// measurements in the vault backlog: 3.26 vs page; 2.97 (light) and 1.93 (dark) vs the fill.
const ring = (report, mode) => report.rings.find((r) => r.id === "action-ring" && r.mode === mode);

test("the 16 Nov export: the Action ring passes the page and fails its own fill, per mode", async () => {
  const { code, report } = await contrast(["--export", before, "--pairs", pairs]);
  assert.equal(code, 1);
  assert.deepEqual(report.rings.map((r) => r.mode), ["light", "dark", "bttf", "bttf-dark"]);
  const bttf = ring(report, "bttf");
  assert.equal(bttf.style, "border/border-focused");
  assert.equal(bttf.ring, "color/border/focused/dark");
  assert.equal(bttf.floor, 3);
  assert.equal(bttf.outside.ratio, 3.26);
  assert.equal(bttf.outside.pass, true);
  assert.equal(bttf.inside.ratio, 2.97);
  assert.equal(bttf.inside.pass, false);
  assert.equal(bttf.pass, false);
  assert.equal(ring(report, "bttf-dark").inside.ratio, 1.93);
  assert.equal(ring(report, "bttf-dark").outside.ratio, 4.42);
});

test("the 21 Nov export: the remap clears the ring in Time Circuits, default light and dark still fail the fill", async () => {
  const { report } = await contrast(["--export", after, "--pairs", pairs]);
  assert.equal(ring(report, "bttf").inside.ratio, 4.33);
  assert.equal(ring(report, "bttf").pass, true);
  assert.equal(ring(report, "bttf-dark").inside.ratio, 3.87);
  assert.equal(ring(report, "bttf-dark").pass, true);
  assert.equal(ring(report, "light").inside.ratio, 2.55);
  assert.equal(ring(report, "light").pass, false);
  assert.equal(ring(report, "dark").inside.ratio, 2.23);
});

test("the markdown lists the ring against both neighbours with its verdict", async () => {
  let out = "";
  await dispatch(["contrast", "--export", before, "--pairs", pairs], { stdout: { write: (s) => { out += s; } }, stderr: { write: () => {} } });
  assert.match(out, /## Ring and focus styles: both neighbours/);
  assert.match(out, /\| action-ring \| border\/border-focused \| bttf \|[^\n]*\| 3\.26 \|[^\n]*\| 2\.97 \| 3 \| FAIL \|/);
});

test("a ring with no fill named is graded outside only and says so", () => {
  const ds = tiny("#949494");
  ds.styles = { EFFECT: [{ name: "ring", properties: { effects: [{ type: "DROP_SHADOW", visible: true, radius: 0, spread: 2, offset: { x: 0, y: 0 }, boundVariables: { color: { id: "v2" } } }] } }] };
  const r = contrastReport(ds, { pairs: [], page: "page", rings: [{ id: "r", style: "ring" }] }).rings[0];
  assert.equal(r.outside.pass, true);
  assert.equal(r.inside, null);
  assert.equal(r.pass, true);
});

test("an effect style that is not a ring, or is absent, is refused by name", () => {
  const ds = tiny("#949494");
  ds.styles = { EFFECT: [{ name: "blur", properties: { effects: [{ type: "LAYER_BLUR", visible: true, radius: 4 }] } }] };
  assert.throws(() => contrastReport(ds, { pairs: [], page: "page", rings: [{ id: "b", style: "blur" }] }), /blur.*not a ring/);
  assert.throws(() => contrastReport(ds, { pairs: [], page: "page", rings: [{ id: "b", style: "nope" }] }), /no effect style "nope"/);
});

test("the existing pair rows are unchanged by the rings list", async () => {
  const { report } = await contrast(["--export", before, "--pairs", pairs]);
  assert.equal(report.rows.length, 12);
  assert.equal(row(report, "action-focus-ring", "bttf").ratio, 2.97);
});

// HT-136: ladder sanity check — lighter/light/dark/darker sets per theme mode.
const ladderOf = async (file) => (await contrast(["--export", file, "--pairs", pairs])).report.ladder;
const summary = (ladder) => ladder.map((w) => `${w.kind}${w.shape ? `:${w.shape}` : ""} ${w.set} ${w.mode}`).sort();

const expectedLadder = [
  ...["light", "bttf"].map((m) => `step-collision color/content/negative ${m}`),
  ...["dark", "bttf-dark"].flatMap((m) => [
    `step-collision color/content/disabled ${m}`, `out-of-order:shuffled color/content/disabled ${m}`,
    `out-of-order:reversed color/border/disabled ${m}`, `out-of-order:reversed color/background/disabled ${m}`,
  ]),
].sort();

for (const [label, file] of [["16 Nov", before], ["21 Nov", after]]) {
  test(`the ${label} export: the ladder warnings are the recorded ones, and nothing else`, async () => {
    assert.deepEqual(summary(await ladderOf(file)), expectedLadder);
  });
}

test("ladder: a step collision names the shared colour and both steps", async () => {
  const w = (await ladderOf(after)).find((x) => x.kind === "step-collision" && x.set === "color/content/negative" && x.mode === "light");
  assert.deepEqual(w.steps, ["light", "dark"]);
  assert.match(w.detail, /punch\/600/);
});

test("ladder: warnings never change the exit code", async () => {
  const { code, report } = await contrast(["--export", after, "--pairs", pairs]);
  assert.ok(report.ladder.length > 0);
  assert.equal(code, report.fails.length || report.ringFails.length ? 1 : 0);
});

test("ladder: the markdown report carries a Ladder warnings section and the translucent-material note", async () => {
  let out = "";
  await dispatch(["contrast", "--export", after, "--pairs", pairs], { stdout: { write: (s) => { out += s; } }, stderr: { write: () => {} } });
  assert.match(out, /## Ladder warnings/);
  assert.match(out, /Translucent materials over a dark page commonly read reversed/);
});

function synthetic(values) {
  const modes = ["light", "dark"].map((modeName, i) => ({ modeId: `m${i}`, modeName, isTheme: true }));
  const variable = (name, hexes) => ({ id: name, name, modes: modes.map((m, i) => ({ modeId: m.modeId, modeName: m.modeName, raw: hexes[i] })) });
  const vars = [variable("color/background/default/primary", ["#ffffff", "#000000"])];
  for (const [step, hexes] of Object.entries(values)) vars.push(variable(`color/content/negative/${step}`, hexes));
  return { collections: [{ name: "color", defaultModeId: "m0", modeMapping: modes, variables: vars }] };
}
const same = (hex) => [hex, hex];

test("ladder: an ordered set with distinct steps is silent", () => {
  const ds = synthetic({ lighter: same("#eeeeee"), light: same("#cccccc"), dark: same("#999999"), darker: same("#444444") });
  assert.deepEqual(contrastReport(ds, { pairs: [] }).ladder, []);
});

test("ladder: a shuffled set warns once per mode, with the offending steps", () => {
  const ds = synthetic({ lighter: same("#eeeeee"), light: same("#999999"), dark: same("#cccccc"), darker: same("#444444") });
  const ladder = contrastReport(ds, { pairs: [] }).ladder;
  assert.deepEqual(ladder.map((w) => [w.kind, w.shape, w.mode]), [["out-of-order", "shuffled", "light"], ["out-of-order", "shuffled", "dark"]]);
});

test("ladder: a fully ascending set is reversed, not shuffled", () => {
  const ds = synthetic({ lighter: same("#444444"), light: same("#999999"), dark: same("#cccccc"), darker: same("#eeeeee") });
  assert.equal(contrastReport(ds, { pairs: [] }).ladder[0].shape, "reversed");
});

test("ladder: sets of the same role but different states sharing a colour warn", () => {
  const ds = synthetic({ lighter: same("#eeeeee"), light: same("#cccccc"), dark: same("#999999"), darker: same("#444444") });
  const v = ds.collections[0].variables;
  v.push(...["lighter", "light", "dark", "darker"].map((s, i) => ({ ...v[i + 1], id: `p${s}`, name: `color/content/positive/${s}`, modes: v[i + 1].modes })));
  const ladder = contrastReport(ds, { pairs: [] }).ladder.filter((w) => w.kind === "state-sharing");
  assert.equal(ladder.length, 8, "four steps x two modes");
  assert.match(ladder[0].detail, /content\/negative.*content\/positive|content\/positive.*content\/negative/);
});

test("ladder: a set whose alias chain does not resolve is reported unreadable, never a crash", () => {
  const ds = synthetic({ lighter: same("#eeeeee"), light: same("#cccccc") });
  ds.collections[0].variables[1].modes.forEach((m) => { m.raw = { type: "VARIABLE_ALIAS", id: "missing" }; });
  const ladder = contrastReport(ds, { pairs: [] }).ladder;
  assert.ok(ladder.length > 0 && ladder.every((w) => w.kind === "unreadable"));
});
