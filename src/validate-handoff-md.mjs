// P14 — the OTHER half of the pair. The layer brief is markdown, so its
// contract is a line grammar rather than a JSON Schema: see
// `schema/design-handoff.v6.grammar.md`, which this module implements line for
// line and which names every code raised here.
//
// Two jobs, deliberately one module:
//   `parseHandoffMarkdown` — the brief as data (identity, tokens, nodes,
//                            tables, copy). Lock 3's conformance check reads
//                            the bindings from here rather than re-parsing.
//   `validateHandoffMarkdown` — the grammar check over that parse.
//
// P17 — the 2026-09-11 plugin export prepends a `---` YAML front-matter block
// ahead of the bold identity lines. `parseFrontMatter` (src/front-matter.mjs)
// reads it; this module cross-checks it against the bold lines it already
// parses and prefers it when both exist and agree.
import { parseFrontMatter } from "./front-matter.mjs";

/** Section headers the grammar requires, in the order they must appear. */
export const REQUIRED_SECTIONS = [
  "## Design handoff",
  "**Design system handoff:**",
  "**Build standards:**",
  "## Design Summary",
  "### Content Outline",
];

const HEX64 = /^[0-9a-f]{64}$/;
const ARTIFACT = /^\*\*Artifact:\*\* `design-handoff` schema v(\d+) · compatibility `([^`]+)` · lane `([^`]+)` · filename `([^`]+)`/;
const CONTENT_HASH = /^\*\*Content hash:\*\* `([^`]*)`/;
const FINGERPRINT = /^\*\*Fingerprint:\*\* current design-system state `([^`]*)`(.*)$/;
const COMPANION = /^- Last-known companion `([^`]+)` · `design-system-handoff` v(\d+) · content `([^`]*)` · state `([^`]*)`/;
const COMPANION_POLICIES = /^- Policies: (.+)$/;
const TOKENS_HEADER = /^\*\*Variable tokens \((\d+) unique\):\*\*/;
const TOKEN_ROW = /^- \$(\S+) ·\s*(.*)$/;
const WEB_NAME = /(?:^|·)\s*WEB `(--[a-z0-9-]+)`/;
const RESPONSIVE_ROW = /^\s+Responsive behavior: (.+)$/;
const NODE_ANCHOR = /^### (.+?) \(([A-Z_]+)\) #(\S+)(.*)$/;
const NODE_ROW = /^(\s*)- \*\*(.+?)\*\* \(([A-Z_]+)\)(.*)$/;
const NODE_ID = /(?:^|\s)#([0-9I][^\s]*)/;
const NODE_LINK = /\[→\]\(([^)]*)\)/;
const COPY = / — "([^"]*)"/;
const BUILD_STANDARD = /^(\d)\. \*\*(.+?)\*\* — /;
const POLICY_PAIR = /\b(fingerprint|naming|units|mode|responsive) v(\d+)\b/g;
const CHANGELOG_ROW = /^- \*\*(.+?)\*\* #(\S+) — (.+)$/;
// A standalone footnote line: a leading sigil (either generation's) followed
// by prose — table footnotes (`† **sm** wraps…`) and nothing else. Node rows
// and table rows start with `-`/`|` and never reach this branch.
const FOOTNOTE = /^\s*([†⚠])\s+(.+)$/;

/** The closed cell vocabulary of a responsive grid table (grammar §tables). */
const CELL = [
  /^—$/,
  /^\$[\w./-]+(?:\s*[×/+]\s*(?:\$[\w./-]+|hug|fill|\d+(?:px)?))*$/,
  /^col-span \d+\/\d+$/,
  /^(?:hug|fill)$/,
  /^\d+(?:\.\d+)?(?:px|rem|%)?$/,
];
// The plugin's 2026-09-11 export moved the table-note sigil to `†`, freeing
// `⚠` to mean only "flag this value" (raw/placeholder). Both sigils are
// accepted here: `⚠ <note>` is the pre-v2 form, `† <note>` is the current one.
const RAGGED_NOTE = /^[†⚠] [\w-]+$/;
// The 2026-09-11 plugin's proper `Notes` column: same two sigils, but the
// note text is free prose (`† row-wrap: 2 rows (row 1: …, row 2: …)`), not
// the single-word form the legacy ragged cell used.
const NOTES_CELL = /^[†⚠] .+$/;

const policyVersions = (text) => {
  const out = {};
  for (const [, name, version] of text.matchAll(POLICY_PAIR)) out[name] = Number(version);
  return out;
};

/**
 * The brief as data. Pure, no filesystem, no validation — a malformed line is
 * simply absent from the parse, and `validateHandoffMarkdown` is what says so.
 *
 * @param {string} text
 * @returns {{
 *   schemaVersion: number|null, artifact: object|null, contentHash: {value: string, line: number}|null,
 *   fingerprint: {state: string, policies: object, line: number}|null,
 *   companion: {base: string, schemaVersion: number, contentHash: string, state: string,
 *               policies: object, line: number}|null,
 *   buildStandards: {n: number, title: string, line: number}[],
 *   tokens: {token: string, web: string|null, responsive: string|null, line: number}[],
 *   declaredTokenCount: {count: number, line: number}|null,
 *   nodes: {name: string, type: string, id: string|null, link: string|null, depth: number,
 *           copy: string|null, placeholder: boolean, annotation: boolean, line: number}[],
 *   tables: {header: string[], rows: {cells: string[], ragged: string|null, note: string|null, line: number}[], line: number}[],
 *   notes: {marker: "†"|"⚠", text: string, line: number}[],
 *   changes: {node: string, id: string, kind: string, line: number}[],
 *   sections: Set<string>, lines: string[],
 * }}
 */
export function parseHandoffMarkdown(text) {
  const { frontMatter, body, offset } = parseFrontMatter(text);
  const lines = body.split("\n");
  const out = {
    schemaVersion: null,
    artifact: null,
    contentHash: null,
    fingerprint: null,
    companion: null,
    buildStandards: [],
    tokens: [],
    declaredTokenCount: null,
    nodes: [],
    tables: [],
    notes: [],
    changes: [],
    sections: new Set(),
    lines,
    frontMatter,
  };

  let inBuildStandards = false;
  let inTokens = false;
  let inChangelog = false;
  let table = null;

  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, "");
    const at = i + 1 + offset;

    for (const s of REQUIRED_SECTIONS) if (line.startsWith(s)) out.sections.add(s);

    const artifact = ARTIFACT.exec(line);
    if (artifact) {
      out.schemaVersion = Number(artifact[1]);
      out.artifact = { schemaVersion: Number(artifact[1]), compatibility: artifact[2], lane: artifact[3], filename: artifact[4], line: at };
    }

    const hash = CONTENT_HASH.exec(line);
    if (hash) out.contentHash = { value: hash[1], line: at };

    const fp = FINGERPRINT.exec(line);
    if (fp) out.fingerprint = { state: fp[1], policies: policyVersions(fp[2]), line: at };

    const comp = COMPANION.exec(line);
    if (comp) {
      out.companion = {
        base: comp[1],
        schemaVersion: Number(comp[2]),
        contentHash: comp[3],
        state: comp[4],
        policies: {},
        line: at,
      };
    }
    const compPolicies = COMPANION_POLICIES.exec(line);
    if (compPolicies && out.companion != null && Object.keys(out.companion.policies).length === 0) {
      out.companion.policies = policyVersions(compPolicies[1]);
      out.companion.policiesLine = at;
    }

    if (line.startsWith("**Changelog**")) { inChangelog = true; return; }
    if (inChangelog) {
      const change = CHANGELOG_ROW.exec(line);
      if (change) { out.changes.push({ node: change[1], id: change[2], kind: change[3], line: at }); return; }
      if (line.startsWith("###") || line.startsWith("**") || line.trim() === "") inChangelog = false;
    }

    if (line.startsWith("**Build standards:**")) { inBuildStandards = true; out.buildStandardsLine = at; return; }
    if (inBuildStandards) {
      const std = BUILD_STANDARD.exec(line);
      if (std) out.buildStandards.push({ n: Number(std[1]), title: std[2], line: at });
      else if (line.startsWith("**")) inBuildStandards = false;
    }

    const tokensHeader = TOKENS_HEADER.exec(line);
    if (tokensHeader) {
      out.declaredTokenCount = { count: Number(tokensHeader[1]), line: at };
      inTokens = true;
      return;
    }
    if (inTokens) {
      const responsive = RESPONSIVE_ROW.exec(line);
      if (responsive && out.tokens.length > 0) {
        out.tokens[out.tokens.length - 1].responsive = responsive[1];
        return;
      }
      const row = TOKEN_ROW.exec(line);
      if (row) {
        const web = WEB_NAME.exec(line);
        out.tokens.push({ token: row[1], web: web ? web[1] : null, responsive: null, line: at });
        return;
      }
      if (line.startsWith("###") || line.startsWith("**")) inTokens = false;
    }

    const anchor = NODE_ANCHOR.exec(line);
    if (anchor) {
      const link = NODE_LINK.exec(anchor[4]);
      out.nodes.push({
        name: anchor[1], type: anchor[2], id: anchor[3], depth: 0, link: link ? link[1] : null,
        copy: null, placeholder: false, annotation: anchor[4].includes("📝"), line: at,
      });
      return;
    }
    const node = NODE_ROW.exec(line);
    if (node && /\(([A-Z_]+)\)/.test(line)) {
      const rest = node[4];
      const id = NODE_ID.exec(rest);
      const link = NODE_LINK.exec(rest);
      const copy = COPY.exec(rest);
      // A development/interaction note bullet (`- **Name** (Development): …`)
      // is prose, not a node row: it has no `#id` and no parenthesised TYPE.
      if (id == null && /^\s*:/.test(rest)) return;
      out.nodes.push({
        name: node[2], type: node[3], id: id ? id[1] : null, depth: node[1].length / 2,
        link: link ? link[1] : null, copy: copy ? copy[1] : null,
        placeholder: rest.includes("⚠ placeholder"), annotation: rest.includes("📝"), line: at,
      });
      return;
    }

    if (/^\s*\|/.test(line)) {
      const trailing = line.trimEnd();
      const ragged = trailing.endsWith("|") ? null : trailing.slice(trailing.lastIndexOf("|") + 1).trim();
      const body = ragged == null ? trailing : trailing.slice(0, trailing.lastIndexOf("|") + 1);
      const cells = body.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      if (cells.every((c) => /^-{3,}$/.test(c))) return; // the separator row
      if (table == null) {
        table = { header: cells, rows: [], line: at, hasNotesColumn: cells[cells.length - 1] === "Notes" };
        out.tables.push(table);
      } else {
        // `note` normalises the sigil away — one shape, `† token-swap` or
        // `⚠ token-swap` both read as `{ note: "token-swap" }`. A ragged
        // trailing cell is the legacy form; a proper `Notes` column (last
        // header cell literally `Notes`) is the 2026-09-11 plugin's form —
        // both populate the same `note`.
        let note = ragged != null ? ragged.replace(/^[†⚠]\s*/, "") : null;
        let dataCells = cells;
        let notesRaw = null;
        if (table.hasNotesColumn && cells.length === table.header.length) {
          notesRaw = cells[cells.length - 1];
          dataCells = cells.slice(0, -1);
          if (notesRaw !== "") note = notesRaw.replace(/^[†⚠]\s*/, "");
        }
        table.rows.push({ cells: dataCells, ragged, note, notesRaw, line: at });
      }
      return;
    }
    if (table != null && line.trim() === "") table = null;

    const footnote = FOOTNOTE.exec(line);
    if (footnote) out.notes.push({ marker: footnote[1], text: footnote[2], line: at });
  });

  out.frontMatterMismatches = frontMatterMismatches(out);
  return out;
}

/**
 * Cross-check the front-matter block against the bold identity lines it
 * duplicates. Each mismatch names the field and the line of the bold line
 * that disagrees (the front matter itself has no per-field line number).
 * Identity fields present in ONLY one of the two are not a mismatch — the
 * front matter is additive, not a second required source.
 */
function frontMatterMismatches(parsed) {
  const fm = parsed.frontMatter;
  if (fm == null) return [];
  const mismatches = [];
  const check = (field, fmValue, boldValue, line) => {
    if (fmValue == null || boldValue == null) return;
    if (fmValue !== boldValue) mismatches.push({ field, frontMatter: fmValue, bold: boldValue, line });
  };

  check("schemaVersion", fm.schemaVersion, parsed.artifact?.schemaVersion, parsed.artifact?.line ?? 1);
  check("contract", fm.contract, parsed.artifact?.compatibility, parsed.artifact?.line ?? 1);
  check("lane", fm.lane, parsed.artifact?.lane, parsed.artifact?.line ?? 1);
  check("contentHash", fm.contentHash, parsed.contentHash?.value, parsed.contentHash?.line ?? 1);
  check("fingerprint.designSystemStateHash", fm.fingerprint?.designSystemStateHash,
    parsed.fingerprint?.state, parsed.fingerprint?.line ?? 1);
  check("companion.artifactFilename", fm.companion?.artifactFilename,
    parsed.companion?.base, parsed.companion?.line ?? 1);
  check("companion.schemaVersion", fm.companion?.schemaVersion,
    parsed.companion?.schemaVersion, parsed.companion?.line ?? 1);
  check("companion.contentHash", fm.companion?.contentHash,
    parsed.companion?.contentHash, parsed.companion?.line ?? 1);
  check("companion.designSystemStateHash", fm.companion?.designSystemStateHash,
    parsed.companion?.state, parsed.companion?.line ?? 1);

  return mismatches;
}

/**
 * The grammar check.
 *
 * @returns {{ ok: boolean, findings: {code: string, severity: "error"|"warning", line: number, message: string}[], parsed: object }}
 *   `ok` is false only on an ERROR — a warning is a decision waiting on a
 *   human, never a broken file.
 */
export function validateHandoffMarkdown(text) {
  const parsed = parseHandoffMarkdown(text);
  const findings = [];
  const add = (code, severity, line, message) => findings.push({ code, severity, line, message });

  for (const section of REQUIRED_SECTIONS) {
    if (!parsed.sections.has(section)) add("MISSING_SECTION", "error", 1, `required section missing: ${section}`);
  }

  for (const m of parsed.frontMatterMismatches) {
    add("FRONT_MATTER_MISMATCH", "error", m.line,
      `front matter \`${m.field}\` is \`${m.frontMatter}\`, the bold line (line ${m.line}) states \`${m.bold}\``);
  }

  if (parsed.artifact == null) {
    add("ARTIFACT_LINE_MALFORMED", "error", 1,
      "no `**Artifact:** `design-handoff` schema v<N> · compatibility … · lane … · filename …` line");
  }

  if (parsed.contentHash == null) {
    add("CONTENT_HASH_MALFORMED", "error", 1, "no `**Content hash:**` line");
  } else if (!HEX64.test(parsed.contentHash.value)) {
    add("CONTENT_HASH_MALFORMED", "error", parsed.contentHash.line,
      `content hash is not 64 hex characters: \`${parsed.contentHash.value}\``);
  }

  if (parsed.fingerprint == null) {
    add("FINGERPRINT_MALFORMED", "error", 1, "no `**Fingerprint:** current design-system state …` line");
  } else if (!HEX64.test(parsed.fingerprint.state)) {
    add("FINGERPRINT_MALFORMED", "error", parsed.fingerprint.line,
      `design-system state hash is not 64 hex characters: \`${parsed.fingerprint.state}\``);
  }

  if (parsed.companion == null) {
    add("COMPANION_BLOCK_MALFORMED", "error", 1,
      "no `- Last-known companion … · `design-system-handoff` v<N> · content `…` · state `…`` line");
  } else {
    if (!HEX64.test(parsed.companion.state) || !HEX64.test(parsed.companion.contentHash)) {
      add("COMPANION_BLOCK_MALFORMED", "error", parsed.companion.line,
        "the companion block's `content` and `state` must both be 64 hex characters");
    } else if (parsed.fingerprint != null && parsed.companion.state !== parsed.fingerprint.state) {
      // The stale-pair defect: the two halves describe different states.
      add("COMPANION_STATE_MISMATCH", "error", parsed.companion.line,
        `companion state \`${parsed.companion.state}\` is not the header fingerprint state ` +
        `\`${parsed.fingerprint.state}\` — the pair is stale, ask for a re-export`);
    }
    for (const [policy, version] of Object.entries(parsed.companion.policies)) {
      const header = parsed.fingerprint?.policies?.[policy];
      if (header != null && header !== version) {
        add("POLICY_VERSION_MISMATCH", "warning", parsed.companion.policiesLine ?? parsed.companion.line,
          `\`${policy}\` policy is v${header} in the Fingerprint line (line ${parsed.fingerprint.line}) ` +
          `and v${version} in the companion block`);
      }
    }
  }

  const numbers = parsed.buildStandards.map((s) => s.n);
  if (parsed.sections.has("**Build standards:**") && String(numbers) !== String([1, 2, 3, 4, 5])) {
    add("BUILD_STANDARDS_INCOMPLETE", "error", parsed.buildStandardsLine ?? 1,
      `Build standards must be 1–5, found [${numbers.join(", ")}]`);
  }

  if (parsed.declaredTokenCount == null) {
    add("MISSING_SECTION", "error", 1, "required section missing: **Variable tokens (<N> unique):**");
  } else if (parsed.declaredTokenCount.count !== parsed.tokens.length) {
    add("TOKEN_ROW_COUNT_MISMATCH", "error", parsed.declaredTokenCount.line,
      `header declares ${parsed.declaredTokenCount.count} unique tokens, ${parsed.tokens.length} token rows parsed`);
  }
  for (const t of parsed.tokens) {
    if (t.web == null) {
      add("TOKEN_ROW_MALFORMED", "error", t.line,
        `\`$${t.token}\` states no WEB name — a binding with no \`codeSyntax.WEB\` cannot be consumed`);
    }
  }

  for (const n of parsed.nodes) {
    if (n.id == null) {
      add("NODE_ROW_MALFORMED", "error", n.line, `node row \`${n.name}\` (${n.type}) carries no #id`);
    }
    // An annotated row puts its link at the end of a multi-line annotation
    // block (grammar §node rows), so it is exempt rather than reported.
    if (n.link == null && !n.annotation) {
      add("NODE_LINK_MISSING", "error", n.line, `node row \`${n.name}\` (${n.type}) carries no [→] node link`);
    }
  }

  for (const table of parsed.tables) {
    const dataWidth = table.hasNotesColumn ? table.header.length - 1 : table.header.length;
    for (const row of table.rows) {
      if (row.cells.length !== dataWidth) {
        add("TABLE_RAGGED", "error", row.line,
          `row has ${row.cells.length} cells, the header (line ${table.line}) has ${dataWidth}`);
      }
      if (row.ragged != null && !RAGGED_NOTE.test(row.ragged)) {
        add("TABLE_RAGGED", "error", row.line,
          `trailing cell \`${row.ragged}\` is not a \`⚠ <note>\` marker (nor \`† <note>\`)`);
      }
      if (row.notesRaw != null && row.notesRaw !== "" && !NOTES_CELL.test(row.notesRaw)) {
        add("TABLE_CELL_UNKNOWN", "error", row.line,
          `Notes cell \`${row.notesRaw}\` is not empty nor a \`† <note>\` marker`);
      }
      for (const cell of row.cells.slice(1)) {
        if (cell === "" || CELL.some((re) => re.test(cell))) continue;
        add("TABLE_CELL_UNKNOWN", "error", row.line,
          `\`${cell}\` is outside the cell vocabulary (—, $bindings, col-span N/M, hug, fill, a sample)`);
      }
    }
  }

  findings.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
  return { ok: !findings.some((f) => f.severity === "error"), findings, parsed };
}
