// `handoff-css conform` — the filesystem boundary around `src/conform.mjs`.
import path from "node:path";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";

import { assertSourceBuilt } from "./config.mjs";
import { conform, renderJson, renderMarkdown } from "./conform.mjs";
import { parseHandoffMarkdown } from "./validate-handoff-md.mjs";

const USAGE = `handoff-css conform --export <json> --handoff <md> --tokens <css> --css <file…> [--bindings <json> [--drift-only]] [--config <mjs>] [--allow-name <--name>…] [--json]\n`;

/** `--name a b c` → ["a","b","c"] (values up to the next flag). */
function flagValues(args, flag) {
  const at = args.indexOf(flag);
  if (at === -1) return [];
  const values = [];
  for (let i = at + 1; i < args.length && !args[i].startsWith("--"); i += 1) values.push(args[i]);
  return values;
}

/**
 * `--allow-name <name>`, repeatable. Its own reader because the value is ALWAYS
 * `--`-prefixed — a custom-property name — so `flagValues`' "up to the next
 * flag" rule would read every occurrence as empty.
 */
function allowNames(args) {
  const names = [];
  args.forEach((a, i) => {
    if (a === "--allow-name" && args[i + 1] != null) names.push(args[i + 1]);
  });
  return names;
}

export async function conformCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  const one = (flag) => flagValues(args, flag)[0];

  const exportPath = one("--export");
  const handoffPath = one("--handoff");
  const tokensPath = one("--tokens");
  const cssPaths = flagValues(args, "--css");
  const configPath = one("--config");
  const bindingsPath = one("--bindings");
  // `--bindings` alone is a drift check: the export and the CSS are all it needs, so
  // the brief and the generated tokens (the alias graph) become optional.
  const driftOnly = Boolean(bindingsPath) && !handoffPath;
  if (!exportPath || (!driftOnly && (!handoffPath || !tokensPath)) || cssPaths.length === 0) {
    stderr.write(USAGE);
    return 1;
  }

  // `conform.allowNames` from the same config the generator reads, so a
  // consumer states the allowance once instead of on every invocation. The
  // flag adds to it rather than replacing it: both are the same statement.
  let allowed = allowNames(args);
  if (configPath) {
    try {
      const config = (await import(pathToFileURL(abs(configPath)).href)).default;
      assertSourceBuilt(config);
      allowed = [...(config?.conform?.allowNames ?? []), ...allowed];
    } catch (err) {
      stderr.write(err.message.includes("SOURCE_READER_NOT_BUILT") ? `${err.message}\n` : `handoff-css conform: cannot load config ${abs(configPath)}\n  ${err.message}\n`);
      return 1;
    }
  }

  let result;
  try {
    const raw = readFileSync(abs(exportPath));
    result = conform({
      doc: JSON.parse((/\.gz$/i.test(exportPath) ? gunzipSync(raw) : raw).toString("utf8")),
      handoff: handoffPath ? { ...parseHandoffMarkdown(readFileSync(abs(handoffPath), "utf8")), file: handoffPath } : undefined,
      tokensCss: tokensPath ? readFileSync(abs(tokensPath), "utf8") : "",
      onlyCodes: args.includes("--drift-only") ? ["COMPONENT_TOKEN_DRIFT", "COMPONENT_TOKEN_MODIFIED", "CODE_ONLY_TOKEN"] : null,
      bindings: bindingsPath ? JSON.parse(readFileSync(abs(bindingsPath), "utf8")) : null,
      files: cssPaths.map((p) => ({ path: p, text: readFileSync(abs(p), "utf8") })),
      allowNames: allowed,
    });
  } catch (err) {
    stderr.write(`handoff-css conform: ${err.message}\n`);
    return 1;
  }

  stdout.write(args.includes("--json") ? renderJson(result) : renderMarkdown(result));
  return result.summary.red > 0 ? 1 : 0;
}
