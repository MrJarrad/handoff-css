// The 30 Oct 2026 first real process test — three defects it hit, each
// reproduced against the committed real exports (HT-29, HT-31, HT-32).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { dispatch } from "../src/cli.mjs";
import { validateHandoffMarkdown } from "../src/validate-handoff-md.mjs";

const FIXTURES = new URL("../fixtures/", import.meta.url).pathname;
const SCRIPT = path.join(FIXTURES, "script-2026-10-29");
const V17C = path.join(FIXTURES, "jhd-v17c-2026-09-16");

const sink = () => ({ text: "", write(s) { this.text += s; } });
const gz = (name) => gunzipSync(readFileSync(path.join(SCRIPT, `${name}.gz`))).toString("utf8");

/** The script fixtures, unzipped to a scratch dir so the CLI can read them by path. */
const scratch = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "handoff-css-pt-"));
  for (const f of ["overlay.md", "overlay.json", "navigation.md", "navigation.json", "design-system-handoff.json"]) {
    writeFileSync(path.join(dir, f), gz(f));
  }
  return dir;
};

const validate = async (files, cwd) => {
  const stdout = sink();
  const code = await dispatch(["validate", ...files, "--json"], { cwd, stdout, stderr: sink() });
  return { code, results: JSON.parse(stdout.text).results };
};

// HT-29 — a Design System Handoff export's own `.md` is not a design-handoff
// brief; running the brief grammar over it reported 10 false errors.
test("HT-29: a design-system-handoff .md is recognised, not validated as a brief", async () => {
  const { code, results } = await validate([path.join(V17C, "design-system-handoff.md")], V17C);
  assert.equal(code, 0, JSON.stringify(results));
  const [r] = results;
  assert.equal(r.kind, "design-system-handoff (md)");
  assert.equal(r.skipped, true);
  assert.deepEqual(r.findings.filter((f) => f.severity === "error"), []);
});

test("HT-29: beside its JSON, the DS .md is still recognised and the JSON still validates", async () => {
  const { code, results } = await validate([path.join(V17C, "design-system-handoff.md"), path.join(V17C, "export.json")], V17C);
  assert.equal(code, 0, JSON.stringify(results));
  assert.deepEqual(results.map((r) => r.kind), ["design-system-handoff (md)", "export"]);
});

test("HT-29: a DS .md named first never takes the brief .md's place in a pair", async () => {
  const dir = scratch();
  const ds = path.join(dir, "jhd-design-system-handoff.md");
  writeFileSync(ds, readFileSync(path.join(V17C, "design-system-handoff.md")));
  const { code, results } = await validate([ds, "overlay.md", "overlay.json", "design-system-handoff.json"], dir);
  assert.equal(code, 0, JSON.stringify(results.map((r) => [r.file, r.findings])));
  assert.equal(results.find((r) => r.kind === "handoff (paired, light)")?.file, "overlay.md");
});

// HT-31 — the same brief .md gave 4 NODE_LINK_MISSING alone and passed paired.
// Every flagged row has its link: a multi-line copy string puts it at the end
// of the string's last line, which the lone grammar never read.
test("HT-31: a node row whose copy spans lines finds its [→] link on the last line", () => {
  const { ok, findings } = validateHandoffMarkdown(gz("overlay.md"));
  assert.deepEqual(findings.filter((f) => f.code === "NODE_LINK_MISSING"), []);
  assert.equal(ok, true);
});

test("HT-31: brief .md alone and brief .md + .json report the same POLICY_VERSION_MISMATCH", async () => {
  const dir = scratch();
  const alone = await validate(["overlay.md", "design-system-handoff.json"], dir);
  const paired = await validate(["overlay.md", "overlay.json", "design-system-handoff.json"], dir);
  assert.equal(alone.code, 0, JSON.stringify(alone.results));
  assert.equal(paired.code, 0);
  const policy = (rs) => rs.flatMap((r) => r.findings).filter((f) => f.code === "POLICY_VERSION_MISMATCH").map((f) => f.message);
  assert.equal(policy(alone.results).length, 1);
  assert.deepEqual(policy(paired.results), policy(alone.results));
});

// HT-32 — vendoring a new export by copying it into `design/handoff/latest`
// wrote through the symlink into the version folder it pointed at (v25).
const vendored = () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "handoff-css-vendor-"));
  const root = path.join(cwd, "design", "handoff");
  const v25 = path.join(root, "v25-2026-10-28");
  mkdirSync(v25, { recursive: true });
  const old = JSON.parse(readFileSync(path.join(V17C, "export.json"), "utf8"));
  writeFileSync(path.join(v25, `${old.artifactFilename}.json`), JSON.stringify(old));
  writeFileSync(path.join(v25, "library-design-system-handoff.json"), "{\"library\":true}");
  symlinkSync("v25-2026-10-28", path.join(root, "latest"));
  const incoming = path.join(cwd, "incoming.json");
  writeFileSync(incoming, gz("design-system-handoff.json"));
  return { cwd, root, v25, old, incoming, next: JSON.parse(gz("design-system-handoff.json")) };
};

test("HT-32: `vendor` writes a new version folder, repoints latest, and leaves v25 untouched", async () => {
  const { cwd, root, v25, old, incoming, next } = vendored();
  assert.equal(next.artifactFilename, old.artifactFilename, "same file, a newer export");
  const before = readFileSync(path.join(v25, `${old.artifactFilename}.json`), "utf8");
  const stdout = sink();
  const code = await dispatch(["vendor", incoming, "--into", "design/handoff"], { cwd, stdout, stderr: sink() });
  assert.equal(code, 0, stdout.text);

  const folder = `v26-${next.generatedAt.slice(0, 10)}`;
  assert.equal(readFileSync(path.join(v25, `${old.artifactFilename}.json`), "utf8"), before, "v25 unchanged");
  assert.ok(lstatSync(path.join(root, "latest")).isSymbolicLink());
  assert.equal(readlinkSync(path.join(root, "latest")), folder);
  assert.equal(JSON.parse(readFileSync(path.join(root, "latest", `${next.artifactFilename}.json`), "utf8")).contentHash, next.contentHash);
  assert.ok(existsSync(path.join(root, folder, "library-design-system-handoff.json")), "the rest of the set carries forward");
  assert.match(stdout.text, new RegExp(`${folder}`));
  assert.match(stdout.text, /latest → v26-/);
  assert.match(stdout.text, /v25-2026-10-28 kept/);
});

test("HT-32: `vendor` of the export latest already holds writes nothing and says so", async () => {
  const { cwd, root, v25, old } = vendored();
  const same = path.join(cwd, "same.json");
  writeFileSync(same, JSON.stringify(old));
  const stdout = sink();
  const code = await dispatch(["vendor", same, "--into", "design/handoff"], { cwd, stdout, stderr: sink() });
  assert.equal(code, 0);
  assert.equal(readlinkSync(path.join(root, "latest")), path.basename(v25));
  assert.match(stdout.text, /already/);
});

test("HT-32: `vendor` refuses a latest that is a real folder rather than overwrite it", async () => {
  const { cwd, root, incoming } = vendored();
  const real = path.join(cwd, "design", "real");
  mkdirSync(path.join(real, "latest"), { recursive: true });
  const stderr = sink();
  const code = await dispatch(["vendor", incoming, "--into", "design/real"], { cwd, stdout: sink(), stderr });
  assert.equal(code, 1);
  assert.match(stderr.text, /not a symlink/);
  assert.ok(existsSync(root));
});
