// `handoff-css contrast` — the filesystem boundary around `src/contrast.mjs`.
import path from "node:path";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { contrastReport, pairsFromBrief, renderMarkdown, DEFAULT_PAGE } from "./contrast.mjs";
import { assertValidExport } from "./validate-export.mjs";
import { readExports } from "./zip.mjs";

const USAGE = `handoff-css contrast --export <json|json.gz|zip> [--pairs <pairs.json>] [--brief <layer brief .json|.json.gz>] [--page <variable>] [--json]\n`;

export async function contrastCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  const one = (flag) => {
    const at = args.indexOf(flag);
    return at === -1 || args[at + 1]?.startsWith("--") ? undefined : args[at + 1];
  };
  const exportPath = one("--export");
  const pairsPath = one("--pairs");
  const briefPath = one("--brief");
  if (!exportPath || (!pairsPath && !briefPath)) {
    stderr.write(USAGE);
    return 1;
  }
  try {
    const file = abs(exportPath);
    const docs = /\.gz$/i.test(file) ? [JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"))] : readExports(file);
    if (docs.length !== 1) throw new Error(`${exportPath}: ${docs.length} exports; contrast reads exactly one`);
    assertValidExport(docs[0]);
    const page = one("--page") ?? DEFAULT_PAGE;
    const read = (f) => (/\.gz$/i.test(f) ? gunzipSync(readFileSync(abs(f))).toString("utf8") : readFileSync(abs(f), "utf8"));
    const explicit = pairsPath ? JSON.parse(read(pairsPath)).pairs : [];
    const derived = briefPath ? pairsFromBrief(JSON.parse(read(briefPath)), { page }) : { pairs: [], skipped: [], notGraded: 0 };
    const report = contrastReport(docs[0], { pairs: [...explicit, ...derived.pairs], page, skipped: derived.skipped, notGraded: derived.notGraded });
    stdout.write(args.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report, { exportName: path.basename(exportPath) }));
    return report.fails.length ? 1 : 0;
  } catch (err) {
    stderr.write(`${err.message}\n`);
    return 1;
  }
}
