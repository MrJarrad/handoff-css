// The provenance header every generated stylesheet opens with. One statement
// of where the bytes came from, shared by `tokens.generated.css` and
// `styles.generated.css` so the two can never disagree about the export they
// were produced from.
import path from "node:path";

export const handAuthoredName = (cfg) => path.basename(cfg.paths.handAuthored);

/**
 * @param doc   the parsed export
 * @param cfg   the consumer config
 * @param tail  file-specific closing lines, after the regenerate command
 */
export const generatedHeader = (doc, cfg, tail = []) =>
  [
    "/* GENERATED FILE — DO NOT EDIT BY HAND.",
    "",
    `   Source:   ${doc.documentName ?? doc.artifact ?? "design-system handoff export"}`,
    `   Schema:   ${doc.schema} v${doc.schemaVersion}`,
    `   Exported: ${doc.generatedAt}`,
    `   State:    ${doc.fingerprint.designSystemStateHash}`,
    "",
    `   Regenerate with:  ${cfg.header.regenerateCommand}`,
    ...tail,
    "*/",
    "",
    "",
  ].join("\n");
