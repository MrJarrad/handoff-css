// `handoff-css match` — the filesystem boundary around `src/match.mjs`.
import path from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

import { matchBrownfield, renderMarkdown } from "./match.mjs";
import { matchRawValues, renderRawValues } from "./raw-values.mjs";

const USAGE = `handoff-css match [--handoff <md>] [--export <brief .json>] --src <path…> [--rulings <md>] [--json]\n`;

/** The link-run file's list of values not bound to a variable, beside the brief and made for it. */
function unboundValues(briefPath) {
  const brief = JSON.parse(readFileSync(briefPath, "utf8"));
  const beside = briefPath.replace(/\.json$/, ".link-run.json");
  const notes = beside !== briefPath && existsSync(beside) ? JSON.parse(readFileSync(beside, "utf8")) : null;
  if (!notes || !Array.isArray(notes.unboundValues)) {
    throw new Error(`${briefPath} has no unboundValues list beside it (${path.basename(beside)}): make the brief again with design-handoff-script (design-handoff "<link>" --live <live read> --out <folder>), which writes it`);
  }
  if (notes.brief?.contentHash !== brief.contentHash) throw new Error(`${path.basename(beside)} was made for another brief (contentHash ${notes.brief?.contentHash}, the brief's is ${brief.contentHash})`);
  return notes.unboundValues;
}
const SOURCE = /\.(css|tsx|jsx|ts|js|mjs)$/;

/** `--name a b c` → ["a","b","c"] (values up to the next flag). */
export function flagValues(args, flag) {
  const at = args.indexOf(flag);
  if (at === -1) return [];
  const values = [];
  for (let i = at + 1; i < args.length && !args[i].startsWith("--"); i += 1) values.push(args[i]);
  return values;
}

/** Every source file under each path, node_modules and dot-folders skipped; paths relative to cwd. */
export function sources(roots, cwd) {
  const out = [];
  const walk = (abs) => {
    if (statSync(abs).isDirectory()) {
      for (const name of readdirSync(abs)) if (name !== "node_modules" && !name.startsWith(".")) walk(path.join(abs, name));
    } else if (SOURCE.test(abs)) {
      out.push({ path: path.relative(cwd, abs), text: readFileSync(abs, "utf8") });
    }
  };
  for (const r of roots) walk(path.isAbsolute(r) ? r : path.join(cwd, r));
  return out;
}

export function matchCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const handoffPath = flagValues(args, "--handoff")[0];
  const exportPath = flagValues(args, "--export")[0];
  const roots = flagValues(args, "--src");
  if ((!handoffPath && !exportPath) || roots.length === 0) {
    stderr.write(USAGE);
    return 1;
  }
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  let result = null;
  let raw = null;
  try {
    const rulingsPath = flagValues(args, "--rulings")[0];
    const rulings = rulingsPath ? readFileSync(abs(rulingsPath), "utf8") : null;
    const files = sources(roots, cwd);
    if (handoffPath) result = matchBrownfield({ handoff: readFileSync(abs(handoffPath), "utf8"), files, rulings });
    if (exportPath) raw = matchRawValues({ rows: unboundValues(abs(exportPath)), files, rulings });
  } catch (err) {
    stderr.write(`handoff-css match: ${err.message}\n`);
    return 1;
  }
  if (args.includes("--json")) stdout.write(`${JSON.stringify({ ...(result ?? {}), ...(raw ? { raw } : {}) }, null, 2)}\n`);
  else stdout.write([result && renderMarkdown(result), raw && renderRawValues(raw)].filter(Boolean).join("\n"));
  // A Figma-variable proposal is not adopted until a human rules it: open items fail the run.
  // A raw value never does: unruled, it is built exact with a deviation row, so it is listed, not a stop.
  return !result || result.items.every((i) => i.status === "ruled") ? 0 : 1;
}
