// handoff-css — generate production-ready CSS custom properties, a Tailwind v4
// `@theme` bridge and a reconciliation report from a Design Handoff export
// (schema `design-system-handoff`).
//
// Library:  generate(handoffJson, config, { handAuthoredCss })
// CLI:      handoff-css [--config <mjs>] [--input <json>] [--out <css>]
//                       [--theme <css>] [--report <md>] [--exclusions <json>]
//                       [--check]
//
// `--check` writes nothing and exits 1 if a committed output would change.
//
// The policies this package applies (names, cascade, modes, units, aliases,
// hidden/private/excluded, the Tailwind bridge, total themes) are documented in
// docs/POLICIES.md. Every house-specific value they need — collection names,
// selector attributes, exclude paths, theme names, report narrative — comes
// from the config, never from this source tree.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { assertConfig } from "./config.mjs";
import { emitStyles } from "./emit-styles.mjs";
import { emitTokens } from "./emit-tokens.mjs";
import { themeCss, themeEntries } from "./emit-theme.mjs";
import { readHandAuthored } from "./hand-authored.mjs";
import { report } from "./report.mjs";
import { sheetFindings } from "./sheets.mjs";
import { cmp, fail } from "./resolve.mjs";
import { indexById } from "./schema.mjs";
import { assertValidExport } from "./validate-export.mjs";

export { validateConfig, configSchema } from "./config.mjs";
// P16 — the consumer conformance check, callable as a library. The package's
// `exports` map publishes `.` only, so a consumer that wants to run conform
// from its own test suite (rather than through the CLI) reaches it here.
export {
  conform, FINDINGS, renderMarkdown as renderConformMarkdown,
  renderJson as renderConformJson,
} from "./conform.mjs";
export { parseHandoffMarkdown, validateHandoffMarkdown } from "./validate-handoff-md.mjs";
export { validateExport, assertValidExport, exportSchema, VALIDATED_SCHEMA_VERSIONS } from "./validate-export.mjs";

/**
 * The public entry: pure, no filesystem.
 *
 * @param doc             the parsed handoff export
 * @param config          see schema/config.schema.json
 * @param handAuthoredCss the consumer's own stylesheet, whose GLOBAL custom
 *                        properties win the cascade and suppress emission (P2)
 */
export function generate(doc, config, { handAuthoredCss = "" } = {}) {
  const cfg = assertConfig(config);
  // P14 — the export is checked against the published schema BEFORE a line of
  // CSS exists. A schema-7 export skips the check (legacy, see
  // `validate-export.mjs`); anything the config declares but the schema does
  // not know stops here rather than half-generating.
  assertValidExport(doc);
  const { declared: handDeclared, scoped: handScoped, classes: handClasses,
          utilities: handUtilities } = readHandAuthored(handAuthoredCss);
  const { css, rows, privateRows, hiddenRows, excludedRows, responsiveRows, aliasRows, warnings,
          untrustedRows, fontWeightRows } = emitTokens(doc, handDeclared, cfg);

  const byId = indexById(doc);
  // P21 — the style classes, and the findings the classes themselves raise.
  // An export older than schema 12 carries no `cssClass`, so `styles.css` is
  // null and nothing about an 8-11 consumer's output changes.
  const styles = emitStyles(doc, byId, handClasses, handUtilities, cfg);
  warnings.push(...styles.warnings);
  // Schema 12's own `:root` sheets, cross-checked and never emitted.
  const sheetRows = sheetFindings(doc, byId, cfg);
  const themeRows = themeEntries(doc, byId, cfg);
  const theme = themeCss(doc, themeRows, cfg);

  const md = report(doc, rows, new Set(handDeclared.keys()), handScoped, themeRows, handDeclared,
                    cfg, privateRows, hiddenRows, excludedRows, responsiveRows, aliasRows, warnings,
                    untrustedRows, styles.rows, fontWeightRows, sheetRows);

  // Single source of truth for a downstream conformance checker (P7): it must
  // not keep its own copy of the exclude list or re-derive either list.
  //
  // `names`   — EXCLUDED. Not derivable from the export: the exclude list is a
  //             consumer-side policy with no signal in the export.
  // `private` — hidden but alias-reachable, so PRESENT in the CSS under its own
  //             name while NOT being a public token. Without this list a checker
  //             reading `hiddenFromPublishing` off the export would report every
  //             one as EXTRA (they are in the CSS) — and a checker reading the
  //             CSS alone would report them as public MATCHes. They are neither.
  //
  // Plain HIDDEN names are absent on purpose: a checker can read
  // `hiddenFromPublishing` / `effectivelyHiddenFromPublishing` straight off the
  // same export it already consumes.
  const exclusionsJson = `${JSON.stringify(
    {
      generatedAt: doc.generatedAt,
      designSystemStateHash: doc.fingerprint.designSystemStateHash,
      policy: `P7 — see ${cfg.report.policyRef}. \`names\` = EXCLUDED (never emitted); \`private\` = hidden but alias-reachable (emitted, not public).`,
      excludePaths: cfg.exclude.paths,
      names: [...excludedRows].map((r) => r.name).sort(cmp),
      private: [...privateRows].map((r) => r.name).sort(cmp),
    },
    null,
    2,
  )}\n`;

  return {
    tokensCss: css,
    stylesCss: styles.css,
    styleRows: styles.rows,
    fontWeightRows,
    sheetRows,
    themeCss: theme,
    report: md,
    exclusionsJson,
    rows,
    themeRows,
    privateRows,
    hiddenRows,
    excludedRows,
    responsiveRows,
    aliasRows,
    // P13 — every self-contradicting build cell found in the export, whether or
    // not this run emitted the variable it belongs to.
    untrustedRows,
    // P11/P12 — what the generator would not guess at: a `viewport.groups`
    // member it could not classify, a `fluid-clamp` with no expression, a
    // `fixed` whose modes disagree. Reported, never silently resolved.
    warnings,
  };
}

function parseArgs(argv, defaults) {
  const opts = { ...defaults, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--check") opts.check = true;
    else if (a === "--config") i += 1; // resolved by the CLI before `run`
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      if (!(key in defaults)) fail(`unknown flag ${a}`);
      opts[key] = argv[++i] ?? fail(`${a} needs a value`);
    } else fail(`unexpected argument ${a}`);
  }
  return opts;
}

/**
 * The filesystem boundary: read the export and the hand-authored stylesheet,
 * call `generate`, then write (or `--check`) the four artifacts. `config.paths`
 * is relative to `cwd`; CLI flags override it.
 */
export function run(argv = [], { cwd = process.cwd(), config } = {}) {
  const opts = parseArgs(argv, assertConfig(config).paths);
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));

  const doc = JSON.parse(readFileSync(abs(opts.input), "utf8"));
  const handAuthoredCss = readFileSync(abs(opts.handAuthored), "utf8");
  const out = generate(doc, config, { handAuthoredCss });

  const write = (p, contents) => {
    const target = abs(p);
    if (opts.check) {
      let current = null;
      try {
        current = readFileSync(target, "utf8");
      } catch {
        /* missing */
      }
      if (current !== contents) {
        process.stderr.write(`handoff-css: ${p} is out of date — run the generator\n`);
        process.exitCode = 1;
      }
      return;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };

  write(opts.out, out.tokensCss);
  // P21 — only when the export published classes. Writing an empty stylesheet
  // for a schema 8-11 export would add a file the export never justified.
  if (opts.styles && out.stylesCss != null) write(opts.styles, out.stylesCss);
  write(opts.theme, out.themeCss);
  write(opts.report, out.report);
  write(opts.exclusions, out.exclusionsJson);

  // `css`/`theme`/`md` are kept alongside the new names so an existing
  // consumer's tests keep reading the fields they always read.
  return { ...out, css: out.tokensCss, theme: out.themeCss, md: out.report, opts };
}
