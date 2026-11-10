// `handoff-css resolve` — the filesystem boundary around `src/resolve-need.mjs`.
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { resolveNeeds, renderResolveMarkdown } from "./resolve-need.mjs";
import { assertValidExport } from "./validate-export.mjs";
import { readExports } from "./zip.mjs";

const USAGE = `handoff-css resolve --export <json|json.gz|zip> --need <needs.json> [--rulings <md>] [--out <dir>] [--json]\n`;
export const RESOLVE_FILES = { json: "resolve-report.json", md: "resolve-report.md" };
/** Exit code when every need is settled / when a need still waits for a ruling / on a usage or input error. */
export const EXIT = { settled: 0, error: 1, open: 2 };

export async function resolveCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  const one = (flag) => {
    const at = args.indexOf(flag);
    return at === -1 || args[at + 1]?.startsWith("--") ? undefined : args[at + 1];
  };
  const exportPath = one("--export");
  const needPath = one("--need");
  if (!exportPath || !needPath) {
    stderr.write(USAGE);
    return EXIT.error;
  }
  try {
    const file = abs(exportPath);
    const docs = /\.gz$/i.test(file) ? [JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"))] : readExports(file);
    if (docs.length !== 1) throw new Error(`${exportPath}: ${docs.length} exports; resolve reads exactly one`);
    assertValidExport(docs[0]);
    let needs;
    try {
      needs = JSON.parse(readFileSync(abs(needPath), "utf8"));
    } catch (err) {
      throw new Error(`handoff-css: ${needPath}: ${err.message}`);
    }
    const rulingsPath = one("--rulings");
    const report = resolveNeeds({ doc: docs[0], needs, rulings: rulingsPath ? readFileSync(abs(rulingsPath), "utf8") : null });
    const outDir = abs(one("--out") ?? ".");
    mkdirSync(outDir, { recursive: true });
    const json = `${JSON.stringify(report, null, 2)}\n`;
    writeFileSync(path.join(outDir, RESOLVE_FILES.json), json);
    writeFileSync(path.join(outDir, RESOLVE_FILES.md), renderResolveMarkdown(report));
    if (args.includes("--json")) stdout.write(json);
    else stdout.write(`handoff-css (resolve): ${report.needs.length} needs, ${report.open} open (${Object.entries(report.counts).map(([k, v]) => `${v} ${k}`).join(", ") || "none"}); wrote ${Object.values(RESOLVE_FILES).join(", ")} to ${outDir}\n`);
    if (report.open > 0) stderr.write(`handoff-css (resolve): ${report.open} need(s) wait for a ruling; see ${RESOLVE_FILES.md}\n`);
    return report.open > 0 ? EXIT.open : EXIT.settled;
  } catch (err) {
    stderr.write(`${err.message}\n`);
    return EXIT.error;
  }
}
