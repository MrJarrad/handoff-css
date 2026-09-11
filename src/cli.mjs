// The CLI's front door. `dispatch(argv)` reads the FIRST argument only: a known
// subcommand routes, anything else falls through to the generator path the CLI
// has always had — `handoff-css --config … --check` keeps working byte for
// byte, because a package that breaks its own invocation while adding a
// checker has not made anything safer.
import path from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { run } from "./index.mjs";
import { validateExport } from "./validate-export.mjs";
import { validateHandoffMarkdown } from "./validate-handoff-md.mjs";

export const SUBCOMMANDS = ["validate"];

const USAGE = `handoff-css — Design Handoff export → CSS custom properties

  handoff-css [--config <mjs>] [--input <json>] [--out <css>] [--theme <css>]
              [--report <md>] [--exclusions <json>] [--check]
  handoff-css validate <file…> [--json]
`;

/**
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {Promise<number>} the process exit code
 */
export async function dispatch(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const [first, ...rest] = argv;
  if (first === "validate") return validateCommand(rest, { cwd, stdout, stderr });
  if (first === "--help" || first === "-h") {
    stdout.write(USAGE);
    return 0;
  }
  return generateCommand(argv, { cwd, stdout, stderr });
}

/** `handoff-css validate <file…> [--json]` — one line per file, exit 1 on any error. */
export function validateCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const asJson = args.includes("--json");
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length === 0) {
    stderr.write("handoff-css validate: name at least one .json export or .md handoff\n");
    return 1;
  }

  const results = [];
  for (const file of files) {
    const abs = path.isAbsolute(file) ? file : path.join(cwd, file);
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch (err) {
      results.push({ file, kind: "unreadable", ok: false, findings: [{ code: "UNREADABLE", severity: "error", line: 0, message: err.message }] });
      continue;
    }
    results.push(abs.endsWith(".md") ? validateMd(file, text) : validateJson(file, text));
  }

  if (asJson) {
    stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
  } else {
    for (const r of results) {
      const errors = r.findings.filter((f) => f.severity === "error");
      const warnings = r.findings.filter((f) => f.severity === "warning");
      const tail = r.skipped
        ? " (schema 7 — not validated)"
        : errors.length === 0
          ? warnings.length === 0 ? "" : `  ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
          : `  ${errors.length} error${errors.length === 1 ? "" : "s"}`;
      stdout.write(`${errors.length === 0 ? "✓" : "✗"} ${r.file}  ${r.kind}${tail}\n`);
      for (const f of r.findings) {
        stdout.write(`    ${f.severity === "error" ? "✗" : "⚠"} ${f.code} ${r.kind === "export" ? f.path : `line ${f.line}`} — ${f.message}\n`);
      }
    }
  }
  return results.every((r) => r.ok) ? 0 : 1;
}

function validateJson(file, text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    return { file, kind: "export", ok: false, findings: [{ code: "UNPARSEABLE", severity: "error", line: 0, path: "/", message: err.message }] };
  }
  const { ok, skipped, errors } = validateExport(doc);
  return {
    file,
    kind: "export",
    ok,
    skipped,
    schemaVersion: doc.schemaVersion ?? null,
    findings: errors.map((e) => ({ code: "SCHEMA", severity: "error", line: 0, path: e.path, message: `${e.message} (${e.keyword})` })),
  };
}

function validateMd(file, text) {
  const { ok, findings, parsed } = validateHandoffMarkdown(text);
  return { file, kind: "handoff", ok, schemaVersion: parsed.schemaVersion, findings };
}

/** The pre-0.3.0 path, unchanged: load the config, run, print the summary. */
async function generateCommand(argv, { cwd, stdout, stderr }) {
  const at = argv.indexOf("--config");
  if (at !== -1 && !argv[at + 1]) {
    stderr.write("handoff-css: --config needs a path\n");
    return 1;
  }
  const configPath = at === -1 ? "handoff.config.mjs" : argv[at + 1];
  const abs = path.isAbsolute(configPath) ? configPath : path.join(cwd, configPath);

  let config;
  try {
    config = (await import(pathToFileURL(abs).href)).default;
  } catch (err) {
    stderr.write(`handoff-css: cannot load config ${abs}\n  ${err.message}\n`);
    return 1;
  }

  const { rows, privateRows, hiddenRows, excludedRows, responsiveRows, aliasRows, warnings, opts } =
    run(argv, { cwd, config });
  const honoured = responsiveRows.filter((r) => r.honoured).length;
  const count = (s) => rows.filter((r) => r.status === s).length;
  stdout.write(
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
      // One line per warning CODE, not per occurrence: a contradictory build
      // cell (P13) is found per (variable, mode), so a single bad plugin export
      // is 100 of them and the summary has to stay a summary. Every occurrence is
      // in the report's §10, named.
      ...[...new Set(warnings.map((w) => w.code))].sort().map((code) => {
        const hits = warnings.filter((w) => w.code === code);
        const names = [...new Set(hits.map((w) => w.name))];
        return `  warning                 ${code}  ${hits.length} in ${names.length} token${names.length === 1 ? "" : "s"} (${names.slice(0, 3).join(", ")}${names.length > 3 ? ", …" : ""})`;
      }),
      `  out                     ${opts.out}`,
      `  theme                   ${opts.theme}`,
      `  report                  ${opts.report}`,
      "",
    ].join("\n"),
  );
  return process.exitCode ?? 0;
}
