// `handoff-css components` — the filesystem boundary around the component profile and component resolve.
//   components --export <layer export>… [--ds-export <Design System Handoff export>…] [--out <dir>] [--check]   profile only
//   components --export <layer export>… --need <needs.json> [--rulings <md>] [--json]  profile + resolve
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { flagValues, sources } from "./match-cli.mjs";
import { scanComponentSource, compareComponents, renderComponentCompareMarkdown } from "./component-source.mjs";

import { buildComponentProfile, renderComponentProfileMarkdown } from "./component-profile.mjs";
import { resolveComponentNeeds, renderResolveComponentMarkdown } from "./resolve-component.mjs";

const USAGE = `handoff-css components [--export <layer export .json|.json.gz>…] [--ds-export <Design System Handoff export>…] [--src <code paths…>] [--out <dir>] [--check]   (--export or --ds-export, or both)\n  handoff-css components --export <layer export>… --need <needs.json> [--rulings <md>] [--out <dir>] [--json]\n`;
export const COMPONENT_FILES = { json: "component-profile.json", md: "component-profile.md" };
export const COMPONENT_COMPARE_FILES = { json: "component-code-compare.json", md: "component-code-compare.md" };
export const COMPONENT_RESOLVE_FILES = { json: "component-resolve-report.json", md: "component-resolve-report.md" };
export const EXIT = { settled: 0, error: 1, open: 2 };

export async function componentsCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  const one = (flag) => {
    const at = args.indexOf(flag);
    return at === -1 || args[at + 1]?.startsWith("--") ? undefined : args[at + 1];
  };
  const exportPaths = args.flatMap((a, i) => (a === "--export" && args[i + 1] && !args[i + 1].startsWith("--") ? [args[i + 1]] : []));
  const dsPaths = args.flatMap((a, i) => (a === "--ds-export" && args[i + 1] && !args[i + 1].startsWith("--") ? [args[i + 1]] : []));
  if (exportPaths.length === 0 && dsPaths.length === 0) {
    stderr.write(USAGE);
    return EXIT.error;
  }
  try {
    const readJson = (p) => {
      const file = abs(p);
      const text = /\.gz$/i.test(file) ? gunzipSync(readFileSync(file)).toString("utf8") : readFileSync(file, "utf8");
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new Error(`handoff-css: ${p}: ${err.message}`);
      }
    };
    const docs = exportPaths.map(readJson);
    const inventory = dsPaths.map(readJson);
    const profile = buildComponentProfile(docs, { inventory });
    for (const w of profile.warnings) stderr.write(`handoff-css (components): warning: ${w}\n`);
    const outDir = abs(one("--out") ?? ".");
    const needPath = one("--need");

    if (!needPath) {
      const outputs = {
        [COMPONENT_FILES.json]: `${JSON.stringify(profile, null, 2)}\n`,
        [COMPONENT_FILES.md]: `${renderComponentProfileMarkdown(profile)}`,
      };
      const srcPaths = flagValues(args, "--src");
      let compare = null;
      if (srcPaths.length) {
        compare = compareComponents(profile, scanComponentSource(sources(srcPaths, cwd)));
        outputs[COMPONENT_COMPARE_FILES.json] = `${JSON.stringify(compare, null, 2)}\n`;
        outputs[COMPONENT_COMPARE_FILES.md] = renderComponentCompareMarkdown(compare);
      }
      if (args.includes("--check")) {
        const drift = Object.entries(outputs).filter(([name, text]) => {
          const f = path.join(outDir, name);
          return !existsSync(f) || readFileSync(f, "utf8") !== text;
        });
        if (drift.length) {
          stderr.write(`handoff-css (components check): out of date: ${drift.map(([n]) => n).join(", ")}\n`);
          return EXIT.error;
        }
        stdout.write("handoff-css (components check): up to date\n");
        return EXIT.settled;
      }
      mkdirSync(outDir, { recursive: true });
      for (const [name, text] of Object.entries(outputs)) writeFileSync(path.join(outDir, name), text);
      stdout.write(`handoff-css (components): ${profile.coverage.basis === "inventory" ? `${profile.coverage.total} components defined in the library (no layer export given)` : profile.coverage.total === "unknown" ? `${profile.coverage.seen} components seen of an unknown total` : `${profile.coverage.seenInInventory} of ${profile.coverage.total} defined in the library are placed (${profile.coverage.outsideInventory} more from outside it)`}; wrote ${Object.keys(outputs).join(", ")} to ${outDir}\n`);
      if (compare) stdout.write(`handoff-css (components): against code, ${compare.counts.components.matched} matched, ${compare.counts.props.propGaps} prop gaps, ${compare.counts.components.codeOnly} code-only\n`);
      return EXIT.settled;
    }

    let needs;
    try {
      needs = JSON.parse(readFileSync(abs(needPath), "utf8"));
    } catch (err) {
      throw new Error(`handoff-css: ${needPath}: ${err.message}`);
    }
    const rulingsPath = one("--rulings");
    const report = resolveComponentNeeds({ profile, needs, inventory, rulings: rulingsPath ? readFileSync(abs(rulingsPath), "utf8") : null });
    mkdirSync(outDir, { recursive: true });
    const json = `${JSON.stringify(report, null, 2)}\n`;
    writeFileSync(path.join(outDir, COMPONENT_RESOLVE_FILES.json), json);
    writeFileSync(path.join(outDir, COMPONENT_RESOLVE_FILES.md), renderResolveComponentMarkdown(report));
    if (args.includes("--json")) stdout.write(json);
    else stdout.write(`handoff-css (components): ${report.needs.length} needs, ${report.open} open (${Object.entries(report.counts).map(([k, v]) => `${v} ${k}`).join(", ") || "none"}); wrote ${Object.values(COMPONENT_RESOLVE_FILES).join(", ")} to ${outDir}\n`);
    if (report.open > 0) stderr.write(`handoff-css (components): ${report.open} need(s) wait for a ruling; see ${COMPONENT_RESOLVE_FILES.md}\n`);
    return report.open > 0 ? EXIT.open : EXIT.settled;
  } catch (err) {
    stderr.write(`${err.message}\n`);
    return EXIT.error;
  }
}
