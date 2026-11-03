// 0.16.0 — the link run's own notes as a file beside the brief. The link-run script
// (figma-plugins `handoff/design-handoff-script`) used to append them to the brief, in the JSON as
// `linkRun`; the brief is now exactly the plugin's and they sit in `<brief>.link-run.json`. The file
// names its brief by the brief's `contentHash`, so a note made for another brief is refused.
import { createRequire } from "node:module";

import Ajv2020 from "ajv/dist/2020.js";

const require = createRequire(import.meta.url);

/** The published schema for the link-run file, also reachable as `handoff-css/schema/link-run`. */
export const linkRunSchema = require("../schema/design-handoff-link-run.v1.schema.json");

let compiled;
const validator = () => (compiled ??= new Ajv2020({ allErrors: true, strict: false }).compile(linkRunSchema));

/** @returns {{ok: boolean, findings: {code: string, severity: "error", line: number, path: string, message: string}[]}} */
export function validateLinkRunJson(doc) {
  const validate = validator();
  const ok = validate(doc);
  return {
    ok,
    findings: ok ? [] : validate.errors.map((e) => ({
      code: "SCHEMA", severity: "error", line: 0, path: e.instancePath || "/",
      message: `${e.params?.additionalProperty ? `${e.message}: \`${e.params.additionalProperty}\`` : e.message} (${e.keyword})`,
    })),
  };
}
