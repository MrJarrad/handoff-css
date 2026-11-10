// `handoff-css ramp` — the filesystem boundary around `src/ramp.mjs`.
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { proposeRamp, renderRampMarkdown } from "./ramp.mjs";
import { assertValidExport } from "./validate-export.mjs";
import { readExports } from "./zip.mjs";

const USAGE = `handoff-css ramp --export <json|json.gz|zip> --anchor <#hex>[@step]… [--name <name>] [--from-scratch]
                 [--for <semantic variable>[@step]… --on <surface variable>… [--use text|large-text|ui] [--keep-anchor]]
                 [--out <dir>] [--json]\n`;
export const RAMP_FILES = { json: "ramp-proposal.json", md: "ramp-proposal.md" };
/** Exit code when the proposal is complete / on a usage or input error / when a mapping has no passing step. */
export const EXIT = { settled: 0, error: 1, open: 2 };
const VALUE_FLAGS = ["--export", "--anchor", "--name", "--for", "--on", "--use", "--out"];

export async function rampCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  const all = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] !== undefined && !args[i + 1].startsWith("--") ? [args[i + 1]] : []));
  const bad = args.find((a, i) => a.startsWith("--") && !VALUE_FLAGS.includes(a) && !["--from-scratch", "--keep-anchor", "--json"].includes(a));
  const exportPath = all("--export")[0];
  if (!exportPath || !all("--anchor").length || bad) {
    stderr.write(USAGE);
    return EXIT.error;
  }
  try {
    const withStep = (s) => {
      const m = /^(.*?)(?:@(\d+))?$/.exec(s);
      return { text: m[1], ...(m[2] !== undefined ? { step: Number(m[2]) } : {}) };
    };
    const anchors = all("--anchor").map((s) => {
      const a = withStep(s);
      return { hex: a.text, ...(a.step !== undefined ? { step: a.step } : {}) };
    });
    const forColours = all("--for").map((s) => {
      const a = withStep(s);
      return { name: a.text, ...(a.step !== undefined ? { step: a.step } : {}) };
    });
    const use = all("--use")[0] ?? "text";
    const file = abs(exportPath);
    const docs = /\.gz$/i.test(file) ? [JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"))] : readExports(file);
    if (docs.length !== 1) throw new Error(`${exportPath}: ${docs.length} exports; ramp reads exactly one`);
    assertValidExport(docs[0]);
    const proposal = proposeRamp({
      doc: docs[0], anchors, name: all("--name")[0], fromScratch: args.includes("--from-scratch"),
      forColours, on: all("--on"), use, keepAnchor: args.includes("--keep-anchor"),
    });
    const outDir = abs(all("--out")[0] ?? ".");
    mkdirSync(outDir, { recursive: true });
    const json = `${JSON.stringify(proposal, null, 2)}\n`;
    writeFileSync(path.join(outDir, RAMP_FILES.json), json);
    writeFileSync(path.join(outDir, RAMP_FILES.md), renderRampMarkdown(proposal));
    if (args.includes("--json")) stdout.write(json);
    else {
      const r = proposal.ramps.map((x) => `${x.name} (${x.nameSource}, ${x.variables.length} steps)`).join(", ");
      stdout.write(`handoff-css (ramp): ${r}; ${proposal.mapping.length} mappings, ${proposal.open} open; wrote ${Object.values(RAMP_FILES).join(", ")} to ${outDir}; nothing written into Figma\n`);
      for (const q of proposal.questions) stdout.write(`question: ${q.ask}\n`);
    }
    if (proposal.open > 0) stderr.write(`handoff-css (ramp): ${proposal.open} mapping(s) have no passing step; see ${RAMP_FILES.md}\n`);
    return proposal.open > 0 ? EXIT.open : EXIT.settled;
  } catch (err) {
    stderr.write(`${err.message}\n`);
    return EXIT.error;
  }
}
