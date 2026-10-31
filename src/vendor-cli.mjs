// `handoff-css vendor <export.json> [<export.md>] --into <dir>` — HT-32.
//
// A consumer keeps each vendored export set in its own version folder
// (`design/handoff/v25-2026-10-28/`) with `latest` a symlink to the current
// one. Copying a new export INTO `latest/` writes through the symlink and
// overwrites the version it points at, so the history the folders exist for
// is lost. Vendoring instead writes a new `v<N+1>-<date>` folder — the
// current set carried forward, the new export in place of its old self —
// then repoints `latest` and says what it did. Nothing existing is written.
import path from "node:path";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, writeFileSync } from "node:fs";

const VERSION_DIR = /^v(\d+)-/;

export function vendorCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const fail = (msg) => { stderr.write(`handoff-css vendor: ${msg}\n`); return 1; };
  const at = args.indexOf("--into");
  const into = at === -1 ? null : args[at + 1];
  if (!into || into.startsWith("--")) return fail("--into needs the folder that holds the version folders and `latest`");
  const files = args.filter((a, i) => !a.startsWith("--") && i !== at + 1);
  const jsonFile = files.find((f) => f.endsWith(".json"));
  const mdFile = files.find((f) => f.endsWith(".md"));
  if (!jsonFile) return fail("name the export's .json (and optionally its .md)");

  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  let doc;
  try {
    doc = JSON.parse(readFileSync(abs(jsonFile), "utf8"));
  } catch (err) {
    return fail(`cannot read ${jsonFile}: ${err.message}`);
  }
  const base = doc.artifactFilename ?? path.basename(jsonFile, ".json");
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

  const held = current && path.join(root, current, `${base}.json`);
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
  if (current && existsSync(path.join(root, current))) {
    cpSync(path.join(root, current), target, { recursive: true });
    carried.push(...readdirSync(target).filter((f) => f !== `${base}.json` && f !== `${base}.md`));
  } else {
    mkdirSync(target);
  }
  const written = [`${base}.json`];
  writeFileSync(path.join(target, `${base}.json`), readFileSync(abs(jsonFile)));
  if (mdFile) {
    writeFileSync(path.join(target, `${base}.md`), readFileSync(abs(mdFile)));
    written.push(`${base}.md`);
  }

  // Repoint atomically: a fresh link renamed over the old one, never a
  // window where `latest` is missing.
  const tmp = path.join(root, `.latest-${process.pid}`);
  symlinkSync(folder, tmp);
  renameSync(tmp, latest);

  stdout.write(`vendored ${written.join(" + ")} → ${path.join(into, folder)}/\n`);
  if (carried.length > 0) stdout.write(`  carried forward from ${current}: ${carried.join(", ")}\n`);
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
