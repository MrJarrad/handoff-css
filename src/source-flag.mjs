// `--config <mjs>` on a command that only needs the config's `source`: load it, validate it against
// the schema, gate the source (a source with no reader stops here), and return `sourceOf(config)`.
// No flag, no source: the writers then use their own default.
import path from "node:path";
import { pathToFileURL } from "node:url";

import { assertConfig, sourceOf } from "./config.mjs";

/** @returns {Promise<object|null>} `sourceOf(config)`, or null when no `--config` was given */
export async function sourceFromFlag(configPath, cwd) {
  if (!configPath) return null;
  const file = path.isAbsolute(configPath) ? configPath : path.join(cwd, configPath);
  let config;
  try {
    config = (await import(pathToFileURL(file).href)).default;
  } catch (err) {
    throw new Error(`handoff-css: cannot load config ${file}\n  ${err.message}`);
  }
  assertConfig(config);
  return sourceOf(config);
}
