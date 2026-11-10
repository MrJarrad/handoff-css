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
import { synthetic, variable, cell } from "./synthetic-export.mjs";

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

// ---- a `new` row closes at REUSE only for the right variable -----------------------------------------
test("a `new` row naming a different existing variable stays RULED and says so", async () => {
  const need = [{ id: "danger-ink", name: "Ink/danger" }];
  const other = await resolve(syntheticFile(), need, table("| resolve-need | danger-ink | new | Ink/main | designer approved |"));
  const [n] = other.rep.needs;
  assert.equal(n.verdict, "RULED");
  assert.equal(n.open, false);
  assert.equal(other.code, 0, other.err);
  assert.match(n.findings[0].message, /Ink\/main.*Ink\/danger/);
  assert.equal(n.ruling.code, "Ink/main");
  assert.equal(report(other.rep), true, JSON.stringify(report.errors));
  assert.match(other.md, /Ink\/main/);
});

test("a `new` row naming a variable of another kind stays RULED and says so", async () => {
  const need = [{ id: "tint", wants: { Day: "#002828FF" } }];
  const wrong = await resolve(syntheticFile(), need, table("| resolve-need | tint | new | Space/sm | designer approved |"));
  const [n] = wrong.rep.needs;
  assert.equal(n.verdict, "RULED");
  assert.equal(wrong.code, 0, wrong.err);
  assert.match(n.findings[0].message, /Space\/sm.*(colour|COLOR)/i);
  assert.equal(report(wrong.rep), true, JSON.stringify(report.errors));
  const right = await resolve(syntheticFile(), need, table("| resolve-need | tint | new | Surface/main | designer approved |"));
  assert.equal(right.rep.needs[0].verdict, "REUSE");
});

// ---- "every mode" for `*` ---------------------------------------------------------------------------
/** The synthetic export written to a fresh file, after `edit(doc)`. */
function editedFile(edit) {
  const doc = synthetic();
  edit(doc);
  const file = path.join(mkdtempSync(path.join(tmpdir(), "synthetic-")), "edited.json");
  writeFileSync(file, JSON.stringify(doc));
  return file;
}
const dropHues = (doc) => { doc.collections[0].variables = doc.collections[0].variables.filter((v) => !v.name.startsWith("Hue/")); };

test("`*` wants the value in every mode of a candidate: a name that holds it in one mode only is no bind target", async () => {
  // Day holds #002828 in Surface/main, Night does not. With the hue primitives gone nothing holds it, or sits near it, in both.
  const file = editedFile(dropHues);
  const named = await resolve(file, [{ id: "n", name: "Ink/danger", wants: { "*": "#002828FF" } }]);
  assert.equal(named.rep.needs[0].verdict, "NEW_RAMP");
  assert.equal(named.rep.needs[0].bindTo, undefined);
  // The value-only path measures every mode too, so it agrees.
  const byValue = await resolve(file, [{ id: "v", group: "Surface", wants: { "*": "#002828FF" } }]);
  assert.equal(byValue.rep.needs[0].verdict, "NEW_RAMP");
  // A per-mode ask is still met by the one mode.
  const perMode = await resolve(file, [{ id: "p", name: "Ink/danger", wants: { Day: "#002828FF" } }]);
  assert.equal(perMode.rep.needs[0].verdict, "NEW_NAME");
  assert.ok(perMode.rep.needs[0].bindTo.Day.name);
});

test("`*` binds to a name that holds the value in every mode", async () => {
  const r = await resolve(syntheticFile(), [{ id: "n", name: "Ink/danger", wants: { "*": "#002828FF" } }]);
  assert.equal(r.rep.needs[0].verdict, "NEW_NAME");
  assert.equal(r.rep.needs[0].bindTo["*"].name, "Hue/Teal/20");
});

// ---- tolerances: SAME 0.5, NEAR 5, tested either side --------------------------------------------------
// One FLOAT of 1000 so the distance is a clean percentage: |a-b| / max(|a|,|b|,1) x 100, rounded to 2 places.
const big = (extra) => editedFile((doc) => { doc.collections[0].variables.push(variable("Size/huge", "FLOAT", [{ ...cell("f1", 1000), modeName: "base" }])); extra?.(doc); });
const byValue = async (file, n) => (await resolve(file, [{ id: "w", wants: { "*": n } }])).rep.needs[0];

test("SAME is 0.5: a value 0.5% off is the same value (REUSE), 0.6% off is only a sibling", async () => {
  const file = big();
  const at = await byValue(file, 1005); // 5/1005 = 0.4975 -> 0.5
  assert.equal(at.candidates[0].name, "Size/huge");
  assert.equal(at.candidates[0].distance, 0.5);
  assert.equal(at.verdict, "REUSE");
  const over = await byValue(file, 1006); // 0.5964 -> 0.6
  assert.equal(over.candidates[0].distance, 0.6);
  assert.equal(over.verdict, "SIBLING");
});

test("NEAR is 5: 4.94 off is still a sibling, 5.03 off is NEW_RAMP", async () => {
  const file = big();
  const at = await byValue(file, 1052); // 52/1052 = 4.94
  assert.equal(at.candidates[0].distance, 4.94);
  assert.equal(at.verdict, "SIBLING");
  const over = await byValue(file, 1053); // 53/1053 = 5.03
  assert.equal(over.verdict, "NEW_RAMP");
});

test("SIBLING: the nearest name within tolerance is offered once, open, with the fallback", async () => {
  const need = await byValue(big(), 1030);
  assert.equal(need.verdict, "SIBLING");
  assert.equal(need.open, true);
  assert.equal(need.candidates[0].name, "Size/huge");
  assert.equal(need.findings[0].code, "SIBLING");
  assert.match(need.findings[0].message, /Size\/huge is the nearest \(distance 2\.91\)/);
  assert.deepEqual(need.fallback, { kind: "raw-value", status: "assumed-ask", values: { "*": 1030 } });
});

test("REUSE with a name asked uses the same 0.5 line: 0.5 off reuses, 0.6 off is a MISMATCH", async () => {
  const file = big();
  const verdict = async (n) => (await resolve(file, [{ id: "w", name: "Size/huge", wants: { "*": n } }])).rep.needs[0].verdict;
  assert.equal(await verdict(1005), "REUSE");
  assert.equal(await verdict(1006), "MISMATCH");
});

test("colour tolerance: the same two lines hold in OKLab delta E x 100", async () => {
  // Grey steps of one 8-bit unit differ by about 0.38 delta E x 100 near mid-grey; four units by about 1.5.
  const grey = (h) => `#${h}${h}${h}FF`;
  const file = editedFile((doc) => doc.collections[0].variables.push(variable("Grey/mid", "COLOR", [{ ...cell("f1", grey("80"), grey("80")), modeName: "base" }])));
  const d = async (h) => (await resolve(file, [{ id: "c", wants: { "*": grey(h) } }])).rep.needs[0];
  const one = await d("81");
  assert.ok(one.candidates[0].distance <= 0.5 && one.candidates[0].distance > 0, String(one.candidates[0].distance));
  assert.equal(one.verdict, "REUSE");
  const far = await d("8C");
  assert.ok(far.candidates[0].distance > 0.5 && far.candidates[0].distance <= 5, String(far.candidates[0].distance));
  assert.equal(far.verdict, "SIBLING");
  assert.equal((await d("C0")).verdict, "NEW_RAMP");
});

// ---- a name-only need closes: ask, record the name, write it, export again, REUSE ----------------------
test("a name-only need: NEW_NAME, then RULED once the designer's name is recorded, then REUSE once the export has it", async () => {
  const name = "Ink/danger";
  const need = [{ id: "danger-ink", name }];
  const row = table(`| resolve-need | danger-ink | new | ${name} | designer approved |`);
  const before = await resolve(syntheticFile(), need);
  assert.equal(before.code, 2, before.err);
  assert.equal(before.rep.needs[0].verdict, "NEW_NAME");

  // The designer's yes is recorded with the name; the file does not have it yet, so the build keeps the raw value.
  const approved = await resolve(syntheticFile(), need, row);
  assert.equal(approved.code, 0, approved.err);
  assert.equal(approved.rep.needs[0].verdict, "RULED");

  // A ramp adds primitives and a mapping for names the export has; it never makes this name.
  const dir = mkdtempSync(path.join(tmpdir(), "ramp-"));
  const ramped = await run(["ramp", "--export", syntheticFile(), "--anchor", "#14d7fb", "--name", "Sky", "--for", "Ink/main", "--on", "Surface/main", "--out", dir], dir);
  assert.notEqual(ramped.code, 1, ramped.err);
  const stillRuled = await resolve(syntheticFile(), need, row);
  assert.equal(stillRuled.rep.needs[0].verdict, "RULED");

  // The designer writes the name; a new export has it. The need is now REUSE, with the ruling kept, and closed.
  const written = editedFile((doc) => {
    const ink = doc.collections[1].variables.find((v) => v.name === "Ink/main");
    doc.collections[1].variables.push({ ...structuredClone(ink), id: "added-danger", name });
  });
  const after = await resolve(written, need, row);
  assert.equal(after.code, 0, after.err);
  assert.equal(after.rep.needs[0].verdict, "REUSE");
  assert.equal(after.rep.needs[0].open, false);
  assert.equal(after.rep.needs[0].ruling.code, name);
  assert.equal(after.rep.needs[0].fallback, undefined);
  assert.equal(report(after.rep), true, JSON.stringify(report.errors));

  // An empty code stays RULED: nothing to look for in the export.
  const bare = await resolve(written, need, table("| resolve-need | danger-ink | new |  | designer approved |"));
  assert.equal(bare.rep.needs[0].verdict, "RULED");
});
