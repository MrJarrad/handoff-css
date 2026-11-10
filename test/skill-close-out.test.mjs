// Amber 1 of the review of #74: the close-out step 3b gives a ramp need has to be one the commands can
// give. This runs the loop as far as it goes without Figma and holds the skill text to what is printed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(root, "bin", "handoff-css.mjs");
const exportGz = path.join(root, "fixtures", "jhd-v19-2026-10-29", "design-system-handoff.json.gz");
const main = readFileSync(path.join(root, "skills", "handoff-to-code", "SKILL.md"), "utf8");
const addStep = main.slice(main.indexOf("### 3b."), main.indexOf("### 4."));
const cli = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });

const dir = mkdtempSync(path.join(tmpdir(), "close-out-"));
const needFile = path.join(dir, "needs.json");
writeFileSync(needFile, JSON.stringify([{ id: "glow-cyan", wants: { "*": "#14d7fb" } }]));
const rulingFile = path.join(dir, "rulings.md");
writeFileSync(rulingFile, "| kind | figma | ruling | code | note |\n| --- | --- | --- | --- | --- |\n| resolve-need | glow-cyan | new | | a new ramp |\n");

// The export after the write: the proposed ramp's variables added as primitives, as a new export would hold them.
function exportWithRamp() {
  const ramp = cli("ramp", "--export", exportGz, "--anchor", "#14d7fb", "--out", dir);
  assert.equal(ramp.status, 0, ramp.stderr);
  const proposal = JSON.parse(readFileSync(path.join(dir, "ramp-proposal.json"), "utf8"));
  const doc = JSON.parse(gunzipSync(readFileSync(exportGz)));
  const col = doc.collections.find((c) => c.name === proposal.ramps[0].collection);
  const template = col.variables.find((v) => v.name.startsWith(`${proposal.ramps[0].parent}/`));
  proposal.ramps[0].variables.forEach((x, i) => {
    const v = structuredClone(template);
    const raw = `${x.hex.toUpperCase()}FF`;
    Object.assign(v, { id: `VariableID:9999:${i}`, key: `scratch${i}`, name: x.name, group: x.name.split("/").slice(0, -1), leafName: String(x.step) });
    v.codeSyntax.WEB.value = x.webName;
    v.modes[0].raw = raw;
    v.modes[0].build = { ...v.modes[0].build, raw, css: raw, literal: raw };
    col.variables.push(v);
  });
  const out = path.join(dir, "export-with-ramp.json");
  writeFileSync(out, JSON.stringify(doc));
  return out;
}

const verdict = (exp, withRuling) => {
  const out = mkdtempSync(path.join(dir, "r-"));
  const r = cli("resolve", "--export", exp, "--need", needFile, ...(withRuling ? ["--rulings", rulingFile] : []), "--out", out);
  const rep = JSON.parse(readFileSync(path.join(out, "resolve-report.json"), "utf8")).needs[0];
  return { status: r.status, verdict: rep.verdict, code: rep.ruling?.code };
};

test("a ramp need: what resolve prints in each state of the loop", () => {
  const withRamp = exportWithRamp();
  assert.deepEqual(verdict(exportGz, false), { status: 2, verdict: "NEW_RAMP", code: undefined });
  assert.deepEqual(verdict(exportGz, true), { status: 0, verdict: "RULED", code: "" });
  assert.deepEqual(verdict(withRamp, false), { status: 0, verdict: "REUSE", code: undefined });
  assert.deepEqual(verdict(withRamp, true), { status: 0, verdict: "RULED", code: "" });
});

test("3b gives the close-out the commands can give: no new row, REUSE after the write, RULED means a row stands", () => {
  assert.match(addStep, /no `new` row for a need that goes to `ramp`/i);
  assert.match(addStep, /`RULED` instead means a row is still standing/);
  assert.match(addStep, /a `skip` row carries no name, and a `new` row carries the approved name when it has one/);
  assert.doesNotMatch(addStep, /has ruled `new`/);
});
