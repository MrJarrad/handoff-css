// `handoff-css resolve` (HT-111 A-S2): a need in, ranked candidates and a verdict out, through the real CLI.
// Two systems: the JHD v19 fixture (the s74 replay) and the synthetic non-JHD export.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

import { dispatch } from "../src/cli.mjs";
import { synthetic } from "./synthetic-export.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const jhdGz = path.join(root, "fixtures", "jhd-v19-2026-10-29", "design-system-handoff.json.gz");
const report = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(path.join(root, "schema", "resolve-report.v1.schema.json"), "utf8")));

const run = async (args, cwd) => {
  let out = "", err = "";
  const code = await dispatch(args, { cwd, stdout: { write: (s) => (out += s) }, stderr: { write: (s) => (err += s) } });
  return { code, out, err };
};
/** Write the needs (and an optional ruling table) into a fresh dir and run `resolve` there. */
async function resolve(exportPath, needs, rulings) {
  const dir = mkdtempSync(path.join(tmpdir(), "resolve-"));
  writeFileSync(path.join(dir, "needs.json"), JSON.stringify(needs));
  const args = ["resolve", "--export", exportPath, "--need", "needs.json", "--out", dir];
  if (rulings) {
    writeFileSync(path.join(dir, "rulings.md"), rulings);
    args.push("--rulings", "rulings.md");
  }
  const r = await run(args, dir);
  const read = (f) => readFileSync(path.join(dir, f), "utf8");
  let rep = null;
  try { rep = JSON.parse(read("resolve-report.json")); } catch { /* error path writes nothing */ }
  return { ...r, dir, rep, md: rep ? read("resolve-report.md") : null };
}
const table = (...rows) => `| kind | figma | ruling | code | note |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`;

// ---- JHD v19: the s74 replay ------------------------------------------------------------------
const quiet = { id: "quiet-action", name: "color/content/action/tertiary", wants: { light: "#00000078", dark: "#FFFFFF8F", bttf: "#2279AF8F" } };

test("s74 replay: secondary ranks first for a quiet action; tertiary is NEW_NAME, exit 2 until ruled", async () => {
  const r = await resolve(jhdGz, [quiet]);
  assert.equal(r.code, 2, r.err);
  assert.equal(report(r.rep), true, JSON.stringify(report.errors));
  const [need] = r.rep.needs;
  assert.equal(need.verdict, "NEW_NAME");
  assert.equal(need.open, true);
  assert.equal(need.candidates[0].name, "color/content/action/secondary");
  assert.equal(need.candidates[0].rank, 1);
  assert.deepEqual(need.fallback, { kind: "raw-value", status: "assumed-ask", values: quiet.wants });
  assert.match(need.findings[0].message, /color\/background\/action, color\/border\/action have it \(a sibling gap\)/);
  assert.match(r.err, /1 need\(s\) wait for a ruling/);
  assert.match(r.md, /## Needs your call/);
});

test("resolve never invents: the asked name is not among the candidates, only bound-to evidence", async () => {
  const r = await resolve(jhdGz, [quiet]);
  assert.ok(!r.rep.needs[0].candidates.some((c) => c.name === quiet.name));
});

test("the report is byte-identical on a rerun", async () => {
  const [a, b] = [await resolve(jhdGz, [quiet]), await resolve(jhdGz, [quiet])];
  assert.equal(JSON.stringify(a.rep), JSON.stringify(b.rep));
  assert.equal(a.md, b.md);
});

test("a name the system has, holding the wanted value, is REUSE and exits 0", async () => {
  const r = await resolve(jhdGz, [{ id: "have", name: "color/content/action/secondary", wants: { light: "#00000080" } }]);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.rep.needs[0].verdict, "REUSE");
  assert.equal(r.rep.needs[0].fallback, undefined);
});

test("a value with no name asked is found by value: exact is REUSE", async () => {
  const r = await resolve(jhdGz, [{ id: "byvalue", group: "color/content/action", wants: { light: "#000000" } }]);
  assert.equal(r.rep.needs[0].verdict, "REUSE");
  assert.equal(r.rep.needs[0].candidates[0].name, "color/content/action/primary");
});

test("a value nothing in the system holds is NEW_RAMP, still open", async () => {
  const r = await resolve(jhdGz, [{ id: "odd", name: "color/content/action/odd", wants: { light: "#E040FBFF" } }]);
  assert.equal(r.rep.needs[0].verdict, "NEW_RAMP");
  assert.equal(r.code, 2);
});

test("a name that exists with another value is a MISMATCH, not a silent reuse", async () => {
  const r = await resolve(jhdGz, [{ id: "clash", name: "color/content/action/secondary", wants: { light: "#E040FBFF" } }]);
  assert.equal(r.rep.needs[0].verdict, "MISMATCH");
  assert.equal(r.code, 2);
});

// ---- rulings -----------------------------------------------------------------------------------
test("a `new` ruling settles the need: RULED, exit 0, no fallback", async () => {
  const r = await resolve(jhdGz, [quiet], table("| resolve-need | quiet-action | new | color/content/action/tertiary | designer ok |"));
  assert.equal(r.code, 0, r.err);
  assert.equal(r.rep.needs[0].verdict, "RULED");
  assert.equal(r.rep.needs[0].open, false);
  assert.equal(r.rep.needs[0].fallback, undefined);
});

test("a `use` ruling binds an existing name; a name the export lacks is RULING_STALE and stays open", async () => {
  const ok = await resolve(jhdGz, [quiet], table("| resolve-need | quiet-action | use | color/content/action/secondary | reuse |"));
  assert.equal(ok.code, 0);
  assert.equal(ok.rep.needs[0].ruling.code, "color/content/action/secondary");
  const stale = await resolve(jhdGz, [quiet], table("| resolve-need | quiet-action | use | color/content/action/gone | |"));
  assert.equal(stale.code, 2);
  assert.equal(stale.rep.needs[0].verdict, "RULING_STALE");
  assert.equal(report(stale.rep), true, JSON.stringify(report.errors));
});

test("a ruling row with no ruling yet is still waiting", async () => {
  const r = await resolve(jhdGz, [quiet], table("| resolve-need | quiet-action |  |  | |"));
  assert.equal(r.code, 2);
});

// ---- input errors: exit 1, nothing written --------------------------------------------------------
test("usage, a bad need file and a need that asks for nothing all exit 1", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "resolve-"));
  assert.equal((await run(["resolve"], dir)).code, 1);
  writeFileSync(path.join(dir, "bad.json"), "{");
  assert.equal((await run(["resolve", "--export", jhdGz, "--need", "bad.json", "--out", dir], dir)).code, 1);
  const empty = await resolve(jhdGz, [{ id: "x" }]);
  assert.equal(empty.code, 1);
  assert.match(empty.err, /resolve-need\.v1/);
  assert.equal(empty.rep, null);
  assert.equal((await resolve(jhdGz, [{ id: "a", name: "n" }, { id: "a", name: "m" }])).code, 1);
});

// ---- synthetic, non-JHD system, through the real CLI ------------------------------------------------
function syntheticFile() {
  const dir = mkdtempSync(path.join(tmpdir(), "synthetic-"));
  const file = path.join(dir, "acme.json");
  writeFileSync(file, JSON.stringify(synthetic()));
  return file;
}

test("synthetic system: the gap in Ink (no danger) is the same NEW_NAME shape, with its own mode names", async () => {
  const wants = { Day: "#002828FF", Night: "#006464FF" };
  const r = await resolve(syntheticFile(), [{ id: "ink-danger", name: "Ink/danger", wants }]);
  assert.equal(r.code, 2, r.err);
  assert.equal(report(r.rep), true, JSON.stringify(report.errors));
  const [need] = r.rep.needs;
  assert.equal(need.verdict, "NEW_NAME");
  assert.match(need.findings[0].message, /Edge, Surface have it \(a sibling gap\)/);
  assert.deepEqual(need.candidates.slice(0, 3).map((c) => c.name), ["Ink/accent", "Ink/main", "Ink/quiet"], "the group's siblings first, equal distance then by name");
  assert.deepEqual(Object.keys(need.bindTo).sort(), ["Day", "Night"]);
  assert.equal(need.bindTo.Day.name, "Hue/Teal/20", "a new name would point at the existing primitive");
});

test("synthetic system: an existing name holding the wanted values reuses, and a FLOAT want compares numerically", async () => {
  const r = await resolve(syntheticFile(), [
    { id: "have", name: "Surface/main", wants: { Day: "#002828FF" } },
    { id: "gutter", name: "Page/gutter", wants: { S: 12, L: 20 } },
    { id: "gutter-off", name: "Page/gutter", wants: { S: 12, L: 36 } },
  ]);
  assert.deepEqual(r.rep.needs.map((n) => n.verdict), ["REUSE", "REUSE", "MISMATCH"]);
  assert.equal(r.code, 2);
});

test("a family of two groups is only an observation: it shows in the candidates' evidence and does not move the verdict", async () => {
  const doc = synthetic();
  doc.collections[1].variables = doc.collections[1].variables.filter((v) => !v.name.startsWith("Edge/"));
  const dir = mkdtempSync(path.join(tmpdir(), "synthetic-"));
  const file = path.join(dir, "two.json");
  writeFileSync(file, JSON.stringify(doc));
  const r = await resolve(file, [{ id: "n", name: "Ink/danger", wants: { Day: "#002828FF", Night: "#006464FF" } }]);
  const [need] = r.rep.needs;
  assert.equal(need.verdict, "NEW_NAME");
  assert.doesNotMatch(need.findings[0].message, /sibling gap/);
  assert.ok(need.candidates.some((c) => c.evidence.some((e) => e.from === "siblingObservations")));
});
