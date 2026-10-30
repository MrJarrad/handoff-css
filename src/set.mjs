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

/**
 * @param {object} brief    the parsed brief JSON (schema `design-handoff`)
 * @param {{file: string, doc: object}[]} exports  every Design System Handoff export given
 * @param {{specIndex?: string|null}} [options]  absolute path of the spec index, when given
 * @returns {{ ok: boolean, specs: {id: string, name: string, path: string}[], findings: {code: string, severity: "error"|"warning", path: string, message: string}[] }}
 */
export function validateSet(brief, exports, { specIndex = null } = {}) {
  const findings = [];
  const add = (code, severity, path, message) => findings.push({ code, severity, path, message });
  const byName = (name) => exports.find((e) => e.doc.artifactFilename === name);

  const companion = brief.companion ?? {};
  const own = byName(companion.artifactFilename);
  if (own) {
    for (const [label, given] of [["contentHash", own.doc.contentHash], ["designSystemStateHash", own.doc.fingerprint?.designSystemStateHash]]) {
      if (given !== companion[label]) {
        add("STALE_PAIR", "error", "/companion/" + label,
          `${own.file} has ${label} \`${given}\`; the brief was made from \`${companion[label]}\` — re-export so both halves are one design-system state`);
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
        `${given.file} is the ${given.doc.generatedAt} run of \`${member.artifactFilename}\`; the brief was made from the ${member.generatedAt} run — give that run, or re-export the brief`);
    }
  });

  // The script's own findings (unpublished or changed style, missing library,
  // a variable no export covers…) are decisions for a human, never inlined
  // around: each stays visible under the code the script gave it.
  (brief.linkRun?.findings ?? []).forEach((f, i) => add(f.code, "warning", `/linkRun/findings/${i}`, f.message));

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
