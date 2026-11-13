// `handoff-css ramp --from-palette`: a brand palette on the command line, no export, nothing written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { dispatch } from "../src/cli.mjs";
import { paletteToSystem } from "../src/color-engine/index.mjs";

const sink = () => ({ text: "", write(s) { this.text += s; } });
const run = async (args) => {
  const cwd = mkdtempSync(path.join(tmpdir(), "palette-"));
  const stdout = sink();
  const stderr = sink();
  const code = await dispatch(["ramp", ...args], { cwd, stdout, stderr });
  return { code, out: stdout.text, err: stderr.text, files: readdirSync(cwd) };
};
const PALETTE = ["--from-palette", "ink=#1d1c1d", "--from-palette", "plum=#4a154b", "--from-palette", "red=#e01e5a"];

test("prints the system as JSON, equal to the library's answer, and writes no file", async () => {
  const { code, out, files } = await run([...PALETTE, "--json"]);
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out), JSON.parse(JSON.stringify(paletteToSystem([{ name: "ink", hex: "#1d1c1d" }, { name: "plum", hex: "#4a154b" }, { name: "red", hex: "#e01e5a" }]))));
  assert.deepEqual(files, []);
});

test("the three settings reach the engine", async () => {
  const off = JSON.parse((await run([...PALETTE, "--no-add-feedback", "--json"])).out);
  assert.ok(off.feedback.some((f) => f.gap));
  const wide = JSON.parse((await run([...PALETTE, "--feedback-tolerance", "180", "--json"])).out);
  assert.ok(wide.feedback.every((f) => f.covers));
  const pinned = JSON.parse((await run([...PALETTE, "--pin-end", "--json"])).out);
  assert.equal(pinned.notes.length, 0);
});

test("plain output names every ramp, where each brand colour landed, and each end-step note", async () => {
  const { code, out } = await run(PALETTE);
  assert.equal(code, 0);
  assert.match(out, /plum .*#4a154b.* step 900/);
  assert.match(out, /anchor at the end step/);
});

test("a bad entry or --export mixed in is a usage error", async () => {
  assert.equal((await run(["--from-palette", "nohex"])).code, 1);
  assert.equal((await run(["--from-palette", "a=#fff", "--feedback-tolerance", "x"])).code, 1);
  const mixed = await run([...PALETTE, "--export", "x.json"]);
  assert.equal(mixed.code, 1);
  assert.match(mixed.err, /--from-palette builds without an export/);
});
