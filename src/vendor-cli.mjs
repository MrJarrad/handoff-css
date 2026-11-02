// `handoff-css vendor <export.json> [<export.md>] | <export.zip> --into <dir>` — HT-32, zip HT-24.
//
// A consumer keeps each vendored export set in its own version folder
// (`design/handoff/v25-2026-10-28/`) with `latest` a symlink to the current
// one. Copying a new export INTO `latest/` writes through the symlink and
// overwrites the version it points at, so the history the folders exist for
// is lost. Vendoring instead writes a new `v<N+1>-<date>` folder — the
// current set carried forward, the new export in place of its old self —
// then repoints `latest` and says what it did. Nothing existing is written.
import path from "node:path";
import { exportsInZip, zipTextFiles } from "./zip.mjs";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";

const VERSION_DIR = /^v(\d+)-/;

export function vendorCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const fail = (msg) => { stderr.write(`handoff-css vendor: ${msg}\n`); return 1; };
  const at = args.indexOf("--into");
  const into = at === -1 ? null : args[at + 1];
  if (!into || into.startsWith("--")) return fail("--into needs the folder that holds the version folders and `latest`");
  const files = args.filter((a, i) => !a.startsWith("--") && i !== at + 1);
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  // HT-24 — the plugin's .zip holds the export's .json and .md; read both from it.
  const zipFile = files.find((f) => /\.zip$/i.test(f));
  let inZip = [], candidates = [];
  if (zipFile) {
    try {
      inZip = zipTextFiles(abs(zipFile), zipFile);
      candidates = exportsInZip(abs(zipFile), zipFile);
    } catch (err) {
      return fail(`cannot read ${zipFile}: ${err.message}`);
    }
    // #44 r1: the export is the entry whose schema says so, never the first .json in the zip.
    if (candidates.length === 0) return fail(`${zipFile} holds no Design System Handoff export (.json, schema design-system-handoff)`);
    if (candidates.length > 1) return fail(`${zipFile} holds ${candidates.length} Design System Handoff exports (${candidates.map((c) => c.file).join(", ")}) — vendor one at a time`);
  }
  const zipJson = candidates[0];
  // Its .md is the one beside it by name, else the zip's only .md.
  const mds = inZip.filter((f) => f.name.endsWith(".md"));
  const zipMd = zipJson && (mds.find((f) => f.name === zipJson.name.replace(/\.json$/i, ".md")) ?? (mds.length === 1 ? mds[0] : undefined));
  const jsonFile = zipJson?.file ?? files.find((f) => f.endsWith(".json"));
  const mdFile = zipMd?.file ?? files.find((f) => f.endsWith(".md"));
  if (!jsonFile) return fail(zipFile ? `${zipFile} holds no .json export` : "name the export's .json (and optionally its .md), or its .zip");
  const bytes = (file) => (file === zipJson?.file ? Buffer.from(zipJson.text) : file === zipMd?.file ? Buffer.from(zipMd.text) : readFileSync(abs(file)));

  let doc;
  try {
    doc = JSON.parse(bytes(jsonFile).toString("utf8"));
  } catch (err) {
    return fail(`cannot read ${jsonFile}: ${err.message}`);
  }
  const base = doc.artifactFilename ?? path.basename(zipJson?.name ?? jsonFile, ".json");
  const root = abs(into);
  const latest = path.join(root, "latest");

  let current = null;
  if (existsSync(latest) || isLink(latest)) {
    if (!isLink(latest)) {
      return fail(`${path.join(into, "latest")} is not a symlink — it is a real folder, and vendoring into it would ` +
        "overwrite the export it holds. Move it to a version folder (v<N>-<date>) and link `latest` to that.");
    }
    current = readlinkSync(latest);
  }
  // A link may be relative or absolute; resolve, never join (HT-35).
  const currentDir = current && path.resolve(root, current);

  const held = currentDir && path.join(currentDir, `${base}.json`);
  if (held && existsSync(held) && doc.contentHash != null && readJson(held)?.contentHash === doc.contentHash) {
    stdout.write(`latest (${current}) already holds ${base}.json at content ${doc.contentHash.slice(0, 12)}… — nothing written\n`);
    return 0;
  }

  mkdirSync(root, { recursive: true });
  const highest = Math.max(0, ...readdirSync(root).map((d) => Number(VERSION_DIR.exec(d)?.[1] ?? 0)));
  const date = /^\d{4}-\d{2}-\d{2}/.exec(doc.generatedAt ?? "")?.[0] ?? new Date().toISOString().slice(0, 10);
  const folder = `v${highest + 1}-${date}`;
  const target = path.join(root, folder);
  if (existsSync(target)) return fail(`${path.join(into, folder)} already exists`);

  const carried = [];
  let dropped = null;
  if (currentDir && existsSync(currentDir)) {
    cpSync(currentDir, target, { recursive: true });
    carried.push(...readdirSync(target).filter((f) => f !== `${base}.json` && f !== `${base}.md`));
    // The old .md describes the old export: never carry it beside a new JSON (HT-36).
    if (!mdFile && existsSync(path.join(target, `${base}.md`))) {
      rmSync(path.join(target, `${base}.md`));
      dropped = `${base}.md`;
    }
  } else {
    mkdirSync(target);
  }
  const written = [`${base}.json`];
  writeFileSync(path.join(target, `${base}.json`), bytes(jsonFile));
  if (mdFile) {
    writeFileSync(path.join(target, `${base}.md`), bytes(mdFile));
    written.push(`${base}.md`);
  }

  // Repoint atomically: a fresh link renamed over the old one, never a
  // window where `latest` is missing.
  const tmp = path.join(root, `.latest-${process.pid}`);
  symlinkSync(folder, tmp);
  renameSync(tmp, latest);

  stdout.write(`vendored ${written.join(" + ")} → ${path.join(into, folder)}/\n`);
  if (carried.length > 0) stdout.write(`  carried forward from ${current}: ${carried.join(", ")}\n`);
  if (dropped) stdout.write(`  ${dropped} not carried forward from ${current} — it described the previous export; pass the new .md to include one\n`);
  stdout.write(`  latest → ${folder}${current ? ` (was ${current})` : ""}\n`);
  if (current) stdout.write(`  ${current} kept, unchanged\n`);
  return 0;
}

function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
