#!/usr/bin/env node
// The CLI: resolve `--config` (the one async step), then hand the rest to
// `run`, which is the synchronous filesystem boundary in `src/index.mjs`.
import path from "node:path";
import { pathToFileURL } from "node:url";

import { run } from "../src/index.mjs";

const argv = process.argv.slice(2);
const at = argv.indexOf("--config");
if (at !== -1 && !argv[at + 1]) {
  process.stderr.write("handoff-css: --config needs a path\n");
  process.exit(1);
}

const cwd = process.cwd();
const configPath = at === -1 ? "handoff.config.mjs" : argv[at + 1];
const abs = path.isAbsolute(configPath) ? configPath : path.join(cwd, configPath);

let config;
try {
  config = (await import(pathToFileURL(abs).href)).default;
} catch (err) {
  process.stderr.write(`handoff-css: cannot load config ${abs}\n  ${err.message}\n`);
  process.exit(1);
}

const { rows, privateRows, hiddenRows, excludedRows, responsiveRows, aliasRows, warnings, opts } =
  run(argv, { cwd, config });
const honoured = responsiveRows.filter((r) => r.honoured).length;
const count = (s) => rows.filter((r) => r.status === s).length;
process.stdout.write(
  [
    `handoff-css (${opts.check ? "check" : "write"})`,
    `  tokens in export        ${rows.length}`,
    `  MATCH                   ${count("MATCH")}`,
    `  VALUE-DRIFT             ${count("VALUE-DRIFT")}`,
    `  NAME-ONLY-IN-EXPORT     ${count("NAME-ONLY-IN-EXPORT")}`,
    `  PRIVATE                 ${privateRows.length}  (hidden, alias-reachable — emitted)`,
    `  HIDDEN                  ${hiddenRows.length}  (hidden, unreachable — dropped)`,
    `  EXCLUDED                ${excludedRows.length}`,
    `  responsive classes      ${honoured} honoured (${config.responsive.honourClasses.join(", ") || "none"})`,
    `  aliases                 ${aliasRows.length}`,
    ...warnings.map((w) => `  warning                 ${w.code}  ${w.name}`),
    `  out                     ${opts.out}`,
    `  theme                   ${opts.theme}`,
    `  report                  ${opts.report}`,
    "",
  ].join("\n"),
);
