// `handoff-css match` — the filesystem boundary around `src/match.mjs`.
import path from "node:path";
import { readdirSync, readFileSync, statSync } from "node:fs";

import { matchBrownfield, renderMarkdown } from "./match.mjs";

const USAGE = `handoff-css match --handoff <md> --src <path…> [--rulings <md>] [--json]\n`;
const SOURCE = /\.(css|tsx|jsx|ts|js|mjs)$/;

/** `--name a b c` → ["a","b","c"] (values up to the next flag). */
function flagValues(args, flag) {
  const at = args.indexOf(flag);
  if (at === -1) return [];
  const values = [];
  for (let i = at + 1; i < args.length && !args[i].startsWith("--"); i += 1) values.push(args[i]);
  return values;
}

/** Every source file under each path, node_modules and dot-folders skipped; paths relative to cwd. */
function sources(roots, cwd) {
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
  const roots = flagValues(args, "--src");
  if (!handoffPath || roots.length === 0) {
    stderr.write(USAGE);
    return 1;
  }
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  let result;
  try {
    const rulingsPath = flagValues(args, "--rulings")[0];
    result = matchBrownfield({
      handoff: readFileSync(abs(handoffPath), "utf8"),
      files: sources(roots, cwd),
      rulings: rulingsPath ? readFileSync(abs(rulingsPath), "utf8") : null,
    });
  } catch (err) {
    stderr.write(`handoff-css match: ${err.message}\n`);
    return 1;
  }
  stdout.write(args.includes("--json") ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  // A proposal is not adopted until a human rules it: open items fail the run.
  return result.items.every((i) => i.status === "ruled") ? 0 : 1;
}
