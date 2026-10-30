// 0.11.0 — the export SET. A Design Handoff brief made by the link-run script
// (figma-plugins `handoff/design-handoff-script`) is built from one Design
// System Handoff export per source file: its own file's (named by the brief's
// `companion`) and each library's (named in `linkRun.designSystemExports`).
// The set is valid only as one design-system state, so every member the brief
// names must be given, and be the run the brief names — never a newer or older
// export of the same file.
//
// A spec's text never travels in the export (Figma gives an exporter none), so
// it is read from the SPEC INDEX: a markdown table of `file key | spec node id
// | spec | path`, the path a link relative to the index. A spec with no entry
// is reported, never skipped.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Link-run finding codes that mean this file's Design System Handoff export is behind the file. */
const BEHIND = new Set(["DS_EXPORT_NOT_LATEST", "STYLE_DIFFERS_FROM_DS_EXPORT", "DS_EXPORT_HAS_NO_ANNOTATIONS", "ANNOTATION_NEWER_THAN_DS_EXPORT"]);

/**
 * @param {object} brief    the parsed brief JSON (schema `design-handoff`)
 * @param {{file: string, doc: object}[]} exports  every Design System Handoff export given
 * @param {{specIndex?: string|null}} [options]  absolute path of the spec index, when given
 * @returns {{ ok: boolean, specs: {id: string, name: string, path: string}[], findings: {code: string, severity: "error"|"warning", path: string, message: string}[] }}
 */
export function validateSet(brief, exports, { specIndex = null, briefFile = "<brief .json>" } = {}) {
  const findings = [];
  const add = (code, severity, path, message) => findings.push({ code, severity, path, message });
  const byName = (name) => exports.find((e) => e.doc.artifactFilename === name);
  // HT-25 — a stale pair is fixed, not refused: the brief made from an older
  // run is regenerated against the export given (figma-plugins
  // design-handoff-script); an export older than the brief's is replaced by
  // the run the brief names. A plugin-made brief records no file key, so its
  // regenerate also needs the file's link.
  const regenerate = `regenerate the brief: \`design-handoff --regenerate ${briefFile} ${exports.map((e) => `--ds ${e.file}`).join(" ")}${brief.linkRun ? "" : ' "<figma link to the file>"'}\``;
  const fix = (given, made, name) => given.doc.generatedAt > made
    ? regenerate
    : `give the ${made} run of \`${name}\``;

  const companion = brief.companion ?? {};
  const own = byName(companion.artifactFilename);
  if (own) {
    for (const [label, given] of [["contentHash", own.doc.contentHash], ["designSystemStateHash", own.doc.fingerprint?.designSystemStateHash]]) {
      if (given !== companion[label]) {
        add("STALE_PAIR", "error", "/companion/" + label,
          `${own.file} has ${label} \`${given}\`; the brief was made from \`${companion[label]}\` (the ${companion.generatedAt} run) — ${fix(own, companion.generatedAt, companion.artifactFilename)}`);
      }
    }
  }

  const joined = brief.linkRun?.designSystemExports ?? [];
  joined.forEach((member, i) => {
    const given = byName(member.artifactFilename);
    if (!given) {
      add("SET_MEMBER_MISSING", "error", `/linkRun/designSystemExports/${i}`,
        `the link run joined \`${member.artifactFilename}\` (${member.documentName}, ${member.generatedAt}) and it was not given — add that export to the set`);
    } else if (given.doc.generatedAt !== member.generatedAt) {
      add("STALE_PAIR", "error", `/linkRun/designSystemExports/${i}`,
        `${given.file} is the ${given.doc.generatedAt} run of \`${member.artifactFilename}\`; the brief was made from the ${member.generatedAt} run — ${fix(given, member.generatedAt, member.artifactFilename)}`);
    }
  });

  // The script's own findings (unpublished or changed style, missing library,
  // a variable no export covers…) are decisions for a human, never inlined
  // around: each stays visible under the code the script gave it.
  (brief.linkRun?.findings ?? []).forEach((f, i) => add(f.code, "warning", `/linkRun/findings/${i}`, f.message));
  // HT-25 — the findings that mean this file's Design System Handoff export is
  // behind the file are one ask: that plugin run, by file name. Figma's REST
  // API reads no variables without the Enterprise-only file_variables:read
  // scope, so no agent can bring that export up to date itself. A variable
  // from a library (its id carries a key: `VariableID:<key>/…`) is a missing
  // export in the set, not a stale one.
  const behind = (brief.linkRun?.findings ?? []).some((f) => BEHIND.has(f.code) || (f.code === "VARIABLE_NOT_IN_DS_EXPORTS" && !String(f.variableId).includes("/")));
  const file = brief.linkRun?.sources?.find((s) => s.role === "this file")?.name ?? brief.documentName;
  if (behind) add("DS_EXPORT_OUT_OF_DATE", "warning", "/linkRun/findings",
    `run the Design System Handoff plugin on ${file}, then regenerate the brief with its export — variables cannot be read without that plugin`);

  const specs = [];
  const missing = (brief.specs ?? []).map((s, i) => ({ ...s, i })).filter((s) => s.markdown == null);
  const fileKey = brief.linkRun?.sources?.find((s) => s.role === "this file")?.fileKey ?? null;
  const index = specIndex && missing.length ? readSpecIndex(specIndex) : [];
  for (const spec of missing) {
    const where = `/specs/${spec.i}`;
    if (!specIndex) {
      add("SPEC_TEXT_NOT_IN_EXPORT", "warning", where, `spec ${spec.name} (${spec.id}) has no text in the export — pass --spec-index to read it from its file`);
      continue;
    }
    const entry = index.find((e) => e.id === spec.id && e.fileKey === fileKey);
    if (!entry) {
      add("SPEC_NOT_INDEXED", "warning", where, `spec ${spec.name} (${spec.id}, file ${fileKey ?? "key unknown"}) has no spec index entry — its text cannot be read; add the entry, never build without it unremarked`);
    } else if (!existsSync(entry.path)) {
      add("SPEC_INDEX_PATH_MISSING", "error", where, `the spec index lists ${spec.id} at ${entry.path}, and no file is there`);
    } else {
      specs.push({ id: spec.id, name: spec.name, path: entry.path });
    }
  }

  return { ok: findings.every((f) => f.severity !== "error"), specs, findings };
}

/** The index's rows as {fileKey, id, path}, the path resolved against the index's own folder. */
function readSpecIndex(file) {
  const rows = readFileSync(file, "utf8").split("\n").filter((l) => l.trim().startsWith("|"))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  const header = rows.findIndex((r) => r.some((c) => /^file key$/i.test(c)));
  if (header === -1) return [];
  const col = (name) => rows[header].findIndex((c) => c.toLowerCase() === name);
  const [key, id, at] = [col("file key"), col("spec node id"), col("path")];
  const bare = (c = "") => c.replace(/^`|`$/g, "");
  return rows.slice(header + 2).map((r) => ({
    fileKey: bare(r[key]),
    id: bare(r[id]),
    path: path.resolve(path.dirname(file), bare(/\]\(([^)]+)\)/.exec(r[at] ?? "")?.[1] ?? r[at])),
  }));
}
