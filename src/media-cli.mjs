// `handoff-css media` — the filesystem boundary around `src/media.mjs`. Read-only:
// it lists the drop folder and never copies, renames or deletes a file.
import path from "node:path";
import { readdirSync, readFileSync, statSync } from "node:fs";

import { matchMedia } from "./media.mjs";

const USAGE = `handoff-css media --handoff <design-handoff.json> --dir <folder> [--json]\n`;
const FIRST_VERSION = 15;

const flag = (args, name) => { const at = args.indexOf(name); return at === -1 ? undefined : args[at + 1]; };

function render({ matched, missing, ambiguous, extra }) {
  const lines = [`Media: ${matched.length} matched · ${missing.length} missing · ${ambiguous.length} ambiguous · ${extra.length} extra file${extra.length === 1 ? "" : "s"}`];
  for (const { entry, file } of matched) lines.push(`matched    ${entry.layerName} ← ${file}`);
  for (const entry of missing) lines.push(`missing    ${entry.layerName} — ${entry.nodePath} (${entry.kind})`);
  for (const group of ambiguous) lines.push(`ambiguous  ${group.layerName} — rename one of these layers in Figma: ${group.entries.map((e) => e.nodePath).join("; ")}`);
  for (const file of extra) lines.push(`extra      ${file} — names no layer in this export`);
  return lines.join("\n") + "\n";
}

export function mediaCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const handoffPath = flag(args, "--handoff");
  const dir = flag(args, "--dir");
  if (!handoffPath || !dir) {
    stderr.write(USAGE);
    return 1;
  }
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  let doc;
  let files;
  try {
    doc = JSON.parse(readFileSync(abs(handoffPath), "utf8"));
    files = readdirSync(abs(dir)).filter((name) => !name.startsWith(".") && statSync(path.join(abs(dir), name)).isFile());
  } catch (err) {
    stderr.write(`handoff-css media: ${err.message}\n`);
    return 1;
  }
  if (!(doc.schemaVersion >= FIRST_VERSION)) {
    stderr.write(`handoff-css media: this export is schema v${doc.schemaVersion}, which has no media list (v${FIRST_VERSION}+) — re-export it with the Design Handoff script\n`);
    return 1;
  }
  const result = matchMedia({ media: doc.media ?? [], files });
  stdout.write(args.includes("--json") ? `${JSON.stringify(result, null, 2)}\n` : render(result));
  return result.missing.length === 0 && result.ambiguous.length === 0 ? 0 : 1;
}
