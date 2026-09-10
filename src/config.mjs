// Config validation.
//
// `schema/config.schema.json` is the single declarative statement of what a
// config may contain — it is also what a consumer reads to write one. Rather
// than restate it in code (two sources of truth, which is the exact failure
// mode this package exists to remove from token pipelines), this validates
// against the file, using the JSON Schema subset the file actually uses:
// `type`, `enum`, `required`, `properties`, `additionalProperties`, `items`,
// `minItems`, `maxItems`.
//
// A dependency-free walk is the whole implementation. If the schema ever grows
// `$ref`, `oneOf`, `pattern` or conditional keywords, reach for a real
// validator (ajv) rather than extending this.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fail } from "./resolve.mjs";

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "schema",
  "config.schema.json",
);

/** The config schema, as JSON. Exported so a consumer can render its own docs. */
export const configSchema = () => JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

const typeOf = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isFinite(value)) return "number";
  return typeof value; // "string" | "boolean" | "object"
};

const KNOWN = new Set([
  "$schema", "$id", "title", "description",
  "type", "enum", "required", "properties", "additionalProperties",
  "items", "minItems", "maxItems",
]);

function check(node, value, at, errors) {
  for (const keyword of Object.keys(node)) {
    if (!KNOWN.has(keyword)) errors.push(`${at}: schema keyword \`${keyword}\` is not supported by this validator`);
  }

  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${node.enum.map((e) => JSON.stringify(e)).join(", ")}`);
    return;
  }

  if (node.type) {
    const allowed = Array.isArray(node.type) ? node.type : [node.type];
    if (!allowed.includes(typeOf(value))) {
      errors.push(`${at}: expected ${allowed.join(" | ")}, got ${typeOf(value)}`);
      return;
    }
  }

  if (typeOf(value) === "array") {
    if (node.minItems != null && value.length < node.minItems) {
      errors.push(`${at}: needs at least ${node.minItems} item(s), got ${value.length}`);
    }
    if (node.maxItems != null && value.length > node.maxItems) {
      errors.push(`${at}: allows at most ${node.maxItems} item(s), got ${value.length}`);
    }
    if (node.items) value.forEach((item, i) => check(node.items, item, `${at}[${i}]`, errors));
    return;
  }

  if (typeOf(value) !== "object") return;

  for (const key of node.required ?? []) {
    if (!(key in value)) errors.push(`${at}: missing required key \`${key}\``);
  }
  for (const [key, child] of Object.entries(value)) {
    const childSchema = node.properties?.[key];
    if (childSchema) {
      check(childSchema, child, `${at}.${key}`, errors);
    } else if (node.additionalProperties === false) {
      errors.push(`${at}: unknown key \`${key}\``);
    } else if (node.additionalProperties && typeof node.additionalProperties === "object") {
      check(node.additionalProperties, child, `${at}.${key}`, errors);
    }
  }
}

/** Every schema violation in the config, as human-readable strings. */
export function validateConfig(config, schema = configSchema()) {
  const errors = [];
  check(schema, config, "config", errors);
  return errors;
}

/**
 * Validate and return the config. There are no defaults on purpose: a silently
 * defaulted house policy is how a token pipeline starts emitting values nobody
 * chose.
 */
export function assertConfig(config) {
  const errors = validateConfig(config);
  if (errors.length) fail(`invalid config —\n  ${errors.join("\n  ")}`);
  return config;
}
