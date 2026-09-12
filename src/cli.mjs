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
import { validateBriefJson, validateBriefPair } from "./brief.mjs";

export const SUBCOMMANDS = ["validate", "conform"];

const USAGE = `handoff-css — Design Handoff export → CSS custom properties

  handoff-css [--config <mjs>] [--input <json>] [--out <css>] [--theme <css>]
              [--report <md>] [--exclusions <json>] [--check]
  handoff-css validate <file…> [--json]
  handoff-css conform --export <json> --handoff <md> --tokens <css> --css <file…>
              [--config <mjs>] [--allow-name <name>…] [--json]
`;

/**
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {Promise<number>} the process exit code
 */
export async function dispatch(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const [first, ...rest] = argv;
  if (first === "validate") return validateCommand(rest, { cwd, stdout, stderr });
  if (first === "conform") {
    const { conformCommand } = await import("./conform-cli.mjs");
    return conformCommand(rest, { cwd, stdout, stderr });
  }
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

  const read = [];
  for (const file of files) {
    const abs = path.isAbsolute(file) ? file : path.join(cwd, file);
    try {
      read.push({ file, abs, text: readFileSync(abs, "utf8") });
    } catch (err) {
      read.push({ file, abs, text: null, error: err });
    }
  }

  // P17/0.4.1 — a `.json` naming schema `design-handoff` (not
  // `design-system-handoff`) is the brief's OWN JSON companion, not a tokens
  // export. Given alongside its `.md`, the pair is the machine contract and
  // validates together (schema + identity reconciliation); the markdown's
  // full line grammar is not re-run for a paired brief.
  const briefJson = read.find((r) => r.abs.endsWith(".json") && r.text != null && safeParse(r.text)?.schema === "design-handoff");
  const briefMd = read.find((r) => r.abs.endsWith(".md"));

  const results = [];
  if (briefJson && briefMd && briefMd.text != null) {
    results.push(validateJson(briefJson.file, briefJson.text, { brief: true }));
    results.push(validateBriefMd(briefMd.file, briefMd.text, safeParse(briefJson.text)));
    for (const r of read) {
      if (r === briefJson || r === briefMd) continue;
      results.push(r.text == null
        ? { file: r.file, kind: "unreadable", ok: false, findings: [{ code: "UNREADABLE", severity: "error", line: 0, message: r.error.message }] }
        : r.abs.endsWith(".md") ? validateMd(r.file, r.text) : validateJson(r.file, r.text));
    }
  } else {
    for (const r of read) {
      results.push(r.text == null
        ? { file: r.file, kind: "unreadable", ok: false, findings: [{ code: "UNREADABLE", severity: "error", line: 0, message: r.error.message }] }
        : r.abs.endsWith(".md") ? validateMd(r.file, r.text) : validateJson(r.file, r.text));
    }
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

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateJson(file, text, { brief = false } = {}) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    return { file, kind: brief ? "brief" : "export", ok: false, findings: [{ code: "UNPARSEABLE", severity: "error", line: 0, path: "/", message: err.message }] };
  }
  if (brief || doc?.schema === "design-handoff") {
    const { ok, errors } = validateBriefJson(doc);
    return {
      file,
      kind: "brief",
      ok,
      schemaVersion: doc.schemaVersion ?? null,
      findings: errors.map((e) => ({ code: "SCHEMA", severity: "error", line: 0, path: e.path, message: `${e.message} (${e.keyword})` })),
    };
  }
  const { ok, skipped, errors, warnings, clampFindings } = validateExport(doc);
  return {
    file,
    kind: "export",
    // P11 — a `FLUID_CLAMP_MISMATCH` is red (the export's own numbers
    // disagree with each other) even on an otherwise schema-valid document,
    // so `validate`/`--check` refuse it exactly as a schema error would.
    ok: ok && clampFindings.length === 0,
    skipped,
    schemaVersion: doc.schemaVersion ?? null,
    findings: [
      ...errors.map((e) => ({ code: "SCHEMA", severity: "error", line: 0, path: e.path, message: `${e.message} (${e.keyword})` })),
      ...clampFindings.map((f) => ({ code: f.code, severity: "error", line: 0, path: `/${f.variable}`, message: f.detail })),
      ...warnings.map((w) => ({ code: w.code, severity: "warning", line: 0, path: w.variable ? `/${w.variable}` : "/", message: w.detail ?? "" })),
    ],
  };
}

function validateMd(file, text) {
  const { ok, findings, parsed } = validateHandoffMarkdown(text);
  return { file, kind: "handoff", ok, schemaVersion: parsed.schemaVersion, findings };
}

/**
 * P17/0.4.1 — the light structural pass a markdown brief gets once its JSON
 * companion is given alongside it: front matter, legend, and identity
 * reconciled against the JSON. Not the full v6/v9 line grammar — that stays
 * with `validateMd` for a lone `.md`.
 */
function validateBriefMd(file, text, briefDoc) {
  const { ok, findings } = validateBriefPair(briefDoc, text);
  return {
    file,
    kind: "handoff (paired, light)",
    ok,
    schemaVersion: briefDoc?.schemaVersion ?? null,
    findings: findings.map((f) => ({ ...f, line: 0 })),
  };
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
