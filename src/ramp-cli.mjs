// `handoff-css ramp` — the filesystem boundary around `src/ramp.mjs`.
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { proposeRamp, renderRampMarkdown } from "./ramp.mjs";
import { assertValidExport } from "./validate-export.mjs";
import { readExports } from "./zip.mjs";
import { paletteToSystem } from "./color-engine/index.mjs";

const USAGE = `handoff-css ramp --export <json|json.gz|zip> --anchor <#hex>[@step]… [--name <name>] [--from-scratch]
                 [--for <semantic variable>[@step]… --on <surface variable>… [--use text|large-text|ui] [--keep-anchor]]
                 [--out <dir>] [--json]
handoff-css ramp --from-palette <name>=<#hex>… [--feedback-tolerance <degrees>] [--no-add-feedback] [--pin-end] [--json]\n`;
export const RAMP_FILES = { json: "ramp-proposal.json", md: "ramp-proposal.md" };
/** Exit code when the proposal is complete / on a usage or input error / when a mapping has no passing step. */
export const EXIT = { settled: 0, error: 1, open: 2 };

export async function rampCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  const given = { "--export": [], "--anchor": [], "--name": [], "--for": [], "--on": [], "--use": [], "--out": [], "--from-palette": [], "--feedback-tolerance": [] };
  const flags = new Set();
  let complaint = null;
  for (let i = 0; i < args.length && !complaint; i++) {
    const a = args[i];
    if (a in given) {
      const v = args[i + 1];
      if (v === undefined || v === "" || v.startsWith("--")) complaint = `${a} needs a value`;
      else (given[a].push(v), i++);
    } else if (["--from-scratch", "--keep-anchor", "--json", "--no-add-feedback", "--pin-end"].includes(a)) flags.add(a);
    else complaint = a.startsWith("--") ? `unknown flag ${a}` : `unexpected argument ${JSON.stringify(a)}`;
  }
  const all = (flag) => given[flag];
  const exportPath = all("--export")[0];
  if (!complaint && all("--from-palette").length) return paletteCommand({ palette: all("--from-palette"), tolerance: all("--feedback-tolerance")[0], exportPath, flags, stdout, stderr });
  if (complaint || !exportPath || !all("--anchor").length) {
    stderr.write(`${complaint ? `ramp: ${complaint}\n` : ""}${USAGE}`);
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
      doc: docs[0], anchors, name: all("--name")[0], fromScratch: flags.has("--from-scratch"),
      forColours, on: all("--on"), use, keepAnchor: flags.has("--keep-anchor"),
    });
    const outDir = abs(all("--out")[0] ?? ".");
    mkdirSync(outDir, { recursive: true });
    const json = `${JSON.stringify(proposal, null, 2)}\n`;
    writeFileSync(path.join(outDir, RAMP_FILES.json), json);
    writeFileSync(path.join(outDir, RAMP_FILES.md), renderRampMarkdown(proposal));
    if (flags.has("--json")) stdout.write(json);
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

/** `--from-palette`: a brand palette in, the from-scratch system out. Pure; no export read, no file written. */
function paletteCommand({ palette, tolerance, exportPath, flags, stdout, stderr }) {
  try {
    if (exportPath) throw new Error("ramp: --from-palette builds without an export; drop --export");
    const colours = palette.map((s) => {
      const m = /^([^=\s]+)=(#[0-9a-f]{3,6})$/i.exec(s);
      if (!m) throw new Error(`ramp: --from-palette wants <name>=<#hex>, got ${JSON.stringify(s)}`);
      return { name: m[1], hex: m[2] };
    });
    const feedbackTolerance = tolerance === undefined ? undefined : Number(tolerance);
    if (feedbackTolerance !== undefined && !(feedbackTolerance >= 0)) throw new Error(`ramp: --feedback-tolerance wants degrees, got ${JSON.stringify(tolerance)}`);
    const sys = paletteToSystem(colours, { ...(feedbackTolerance !== undefined ? { feedbackTolerance } : {}), addFeedback: !flags.has("--no-add-feedback"), pinEndStep: flags.has("--pin-end") });
    if (flags.has("--json")) return (stdout.write(`${JSON.stringify(sys, null, 2)}\n`), EXIT.settled);
    const hexOf = (r, s) => r.steps.find((x) => x.step === s).hex;
    for (const r of sys.ramps) {
      const where = r.placement.map((p) => `${p.hex} step ${p.step}`).join(", ");
      stdout.write(`${r.name} (${r.source}): ${where}; ${hexOf(r, r.steps[0].step)} … ${hexOf(r, r.steps.at(-1).step)}\n`);
    }
    for (const f of sys.feedback) stdout.write(`feedback ${f.role}: ${f.covers ? `covered by ${f.covers}` : f.added ? "ramp added" : "not covered (report only)"}\n`);
    for (const n of sys.notes) stdout.write(`note: ${n.ramp} — anchor at the end step ${n.step}; --pin-end moves it one step in\n`);
    return EXIT.settled;
  } catch (err) {
    stderr.write(`${err.message}\n${USAGE}`);
    return EXIT.error;
  }
}
