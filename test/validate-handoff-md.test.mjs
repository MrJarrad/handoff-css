// P14, markdown half — `schema/design-handoff.v6.grammar.md` implemented.
// Every case is a MUTATION of the real 2026-09-10 navigation brief: the
// grammar is asserted against the document the plugin actually writes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseHandoffMarkdown, validateHandoffMarkdown } from "../src/validate-handoff-md.mjs";

const PATH = new URL("../fixtures/jhd-v8b-2026-09-10/design-handoff-block-navigation.md", import.meta.url);
const brief = () => readFileSync(PATH, "utf8");

/** Replace the first occurrence of `find`, and return the 1-based line it was on. */
const edit = (text, find, replace) => {
  const at = text.indexOf(find);
  assert.notEqual(at, -1, `fixture no longer contains: ${find.slice(0, 60)}`);
  const line = text.slice(0, at).split("\n").length;
  return { text: text.slice(0, at) + replace + text.slice(at + find.length), line };
};
const only = (findings, code) => findings.filter((f) => f.code === code);

test("the real nav brief passes with exactly one warning: POLICY_VERSION_MISMATCH", () => {
  const { ok, findings } = validateHandoffMarkdown(brief());
  assert.equal(ok, true);
  assert.equal(findings.length, 1, findings.map((f) => `${f.line} ${f.code}`).join("; "));
  const [w] = findings;
  assert.equal(w.code, "POLICY_VERSION_MISMATCH");
  assert.equal(w.severity, "warning");
  assert.equal(w.line, 27, "the companion Policies: line");
  assert.match(w.message, /`units` policy is v4 .* and v5 in the companion block/);
});

test("the parse carries the identity, the tokens, the nodes and the tables", () => {
  const p = parseHandoffMarkdown(brief());
  assert.equal(p.schemaVersion, 6);
  assert.equal(p.companion.schemaVersion, 8);
  assert.equal(p.companion.state, "bb6a002560860ecfb6376514a66ca4173a673c1237033c97b627520356bc7224");
  assert.equal(p.companion.state, p.fingerprint.state);
  assert.equal(p.companion.contentHash, "914307e4b13d58b18b171715cdcd8961d1220787885e84e2b7b807ce67c71d7e");
  assert.equal(p.tokens.length, 30);
  assert.equal(p.declaredTokenCount.count, 30);
  assert.deepEqual(p.buildStandards.map((s) => s.n), [1, 2, 3, 4, 5]);
  assert.equal(p.tables.length, 2);
  // The binding `handoff-to-code`'s worked example turns on.
  const full = p.tokens.find((t) => t.token === "device/screen-height/full");
  assert.equal(full.web, "--device-screen-height-full");
  assert.match(full.responsive, /default=100dvh/);
  // Copy is parsed, placeholders with it — never warned on here.
  assert.ok(p.nodes.some((n) => n.copy === "Title" && n.placeholder));
});

test("a companion state that is not the header's is COMPANION_STATE_MISMATCH at the companion line", () => {
  // The companion occurrence, not the header's — they are the same hash, which
  // is the whole point of the check.
  const { text, line } = edit(brief(),
    "· state `bb6a002560860ecfb6376514a66ca4173a673c1237033c97b627520356bc7224`",
    "· state `aa6a002560860ecfb6376514a66ca4173a673c1237033c97b627520356bc7224`");
  const { ok, findings } = validateHandoffMarkdown(text);
  assert.equal(ok, false);
  const [hit] = only(findings, "COMPANION_STATE_MISMATCH");
  assert.equal(hit.line, line);
  assert.match(hit.message, /the pair is stale, ask for a re-export/);
});

test("a truncated content hash is CONTENT_HASH_MALFORMED at line 4", () => {
  const { text, line } = edit(brief(),
    "**Content hash:** `1f678202771e28f4b88421f9bd97f0ed927ad42296641e829bdbe543005e6769`",
    "**Content hash:** `1f678202`");
  const [hit] = only(validateHandoffMarkdown(text).findings, "CONTENT_HASH_MALFORMED");
  assert.equal(hit.line, line);
  assert.equal(line, 4);
});

test("a missing Artifact line is ARTIFACT_LINE_MALFORMED and MISSING_SECTION", () => {
  const text = brief().split("\n").filter((l) => !l.startsWith("**Artifact:**")).join("\n");
  const { ok, findings } = validateHandoffMarkdown(text);
  assert.equal(ok, false);
  assert.equal(only(findings, "ARTIFACT_LINE_MALFORMED").length, 1);
});

test("a dropped Build standard is BUILD_STANDARDS_INCOMPLETE, naming what was found", () => {
  const text = brief().split("\n")
    .filter((l) => !l.startsWith("5. **Grid frames are CSS Grid containers**")).join("\n");
  const [hit] = only(validateHandoffMarkdown(text).findings, "BUILD_STANDARDS_INCOMPLETE");
  assert.match(hit.message, /found \[1, 2, 3, 4\]/);
  assert.equal(hit.line, 35, "reported at the `**Build standards:**` line");
});

test("a token row with no WEB name is TOKEN_ROW_MALFORMED at that row", () => {
  const { text, line } = edit(brief(),
    "- $device/screen-height/full · WEB `--device-screen-height-full` (derived)",
    "- $device/screen-height/full · (derived)");
  const [hit] = only(validateHandoffMarkdown(text).findings, "TOKEN_ROW_MALFORMED");
  assert.equal(hit.line, line);
  assert.match(hit.message, /\$device\/screen-height\/full/);
});

test("a truncated token list is TOKEN_ROW_COUNT_MISMATCH at the header line", () => {
  const { text, line } = edit(brief(), "**Variable tokens (30 unique):**", "**Variable tokens (31 unique):**");
  const [hit] = only(validateHandoffMarkdown(text).findings, "TOKEN_ROW_COUNT_MISMATCH");
  assert.equal(hit.line, line);
  assert.match(hit.message, /declares 31 unique tokens, 30 token rows parsed/);
});

test("a node row with no #id is NODE_ROW_MALFORMED at that row", () => {
  const { text, line } = edit(brief(),
    "- **title** (TEXT) #3859:32398",
    "- **title** (TEXT)");
  const [hit] = only(validateHandoffMarkdown(text).findings, "NODE_ROW_MALFORMED");
  assert.equal(hit.line, line);
});

test("a node row with no [→] link is NODE_LINK_MISSING at that row", () => {
  const t = brief();
  const at = t.indexOf("- **title** (TEXT) #3859:32398");
  const end = t.indexOf("\n", at);
  const row = t.slice(at, end);
  const { text, line } = edit(t, row, row.replace(/ \[→\]\([^)]*\)/, ""));
  const [hit] = only(validateHandoffMarkdown(text).findings, "NODE_LINK_MISSING");
  assert.equal(hit.line, line);
});

test("a cell outside the vocabulary is TABLE_CELL_UNKNOWN at that row", () => {
  const { text, line } = edit(brief(),
    "| title | col-span 3/12 | col-span 3/12 | col-span 6/12 |",
    "| title | 25% of the row | col-span 3/12 | col-span 6/12 |");
  const [hit] = only(validateHandoffMarkdown(text).findings, "TABLE_CELL_UNKNOWN");
  assert.equal(hit.line, line);
  assert.match(hit.message, /outside the cell vocabulary/);
});

test("the export's own ragged `⚠ token-swap` rows are accepted, a stray trailing cell is not", () => {
  const clean = validateHandoffMarkdown(brief()).findings;
  assert.equal(only(clean, "TABLE_RAGGED").length, 0, "the real ragged ⚠ rows must pass");
  const { text, line } = edit(brief(),
    "| colGap | $grid/gap-sm | $grid/gap-sm | $grid/gap | ⚠ token-swap",
    "| colGap | $grid/gap-sm | $grid/gap-sm | $grid/gap | see below");
  const [hit] = only(validateHandoffMarkdown(text).findings, "TABLE_RAGGED");
  assert.equal(hit.line, line);
  assert.match(hit.message, /is not a `⚠ <note>` marker/);
});

test("a missing required section is MISSING_SECTION at line 1", () => {
  const text = brief().split("\n").filter((l) => l !== "### Content Outline").join("\n");
  const [hit] = only(validateHandoffMarkdown(text).findings, "MISSING_SECTION");
  assert.equal(hit.line, 1);
  assert.match(hit.message, /### Content Outline/);
});

// The nav brief's next revision — schema v6, companion moved to
// design-system-handoff 9. Its header still names `units v4` against the
// companion's v5, the same open defect as brief 5's fixture.
const brief6Path = new URL(
  "../fixtures/jhd-v9-2026-09-11/design-handoff-block-navigation.md",
  import.meta.url,
);
const brief6 = () => readFileSync(brief6Path, "utf8");

test("brief 6 (companion v9) passes with exactly one warning: POLICY_VERSION_MISMATCH", () => {
  const { ok, findings } = validateHandoffMarkdown(brief6());
  assert.equal(ok, true);
  assert.equal(findings.length, 1, findings.map((f) => `${f.line} ${f.code}`).join("; "));
  const [w] = findings;
  assert.equal(w.code, "POLICY_VERSION_MISMATCH");
  assert.match(w.message, /`units` policy is v4 .* and v5 in the companion block/);
});

// 0.3.2 — the plugin's single-meaning sigils. v1 is the pre-2026-09-11 nav
// brief (legacy `⚠ <note>` tables), v2 is the same brief re-exported with the
// new `†` table/footnote sigil and a changed Navigation node.
const v9bDir = new URL("../fixtures/jhd-v9b-2026-09-11/", import.meta.url);
const v9bV1 = () => readFileSync(new URL("design-handoff-block-navigation.md", v9bDir), "utf8");
const v9bV2 = () => readFileSync(new URL("design-handoff-block-navigation-v2.md", v9bDir), "utf8");

test("v1 (jhd-v9b, legacy `⚠` notes) still validates with zero errors and zero warnings", () => {
  const { ok, findings } = validateHandoffMarkdown(v9bV1());
  assert.equal(ok, true);
  assert.deepEqual(findings, []);
});

test("v2 (jhd-v9b, the `†` sigil) validates with zero errors and zero warnings", () => {
  const { ok, findings } = validateHandoffMarkdown(v9bV2());
  assert.equal(ok, true, findings.map((f) => `${f.line} ${f.code} ${f.message}`).join("\n"));
  assert.deepEqual(findings, []);
});

test("v2's NavigationHeader table carries token-swap on colGap, variant-only on rowGap", () => {
  const { parsed } = validateHandoffMarkdown(v9bV2());
  const [table] = parsed.tables;
  const row = (name) => table.rows.find((r) => r.cells[0] === name);
  assert.equal(row("colGap").note, "token-swap");
  assert.equal(row("rowGap").note, "variant-only");
  // The raw `ragged` cell still carries the `†` sigil the export wrote.
  assert.equal(row("colGap").ragged, "† token-swap");
});

test("v2's placeholders are still found under the unchanged `⚠ placeholder` marker", () => {
  const { parsed } = validateHandoffMarkdown(v9bV2());
  assert.ok(parsed.nodes.some((n) => n.copy === "Title" && n.placeholder));
  assert.ok(parsed.nodes.filter((n) => n.placeholder).length > 0);
});

test("v2's changelog entry parses to {node, id, kind}", () => {
  const { parsed } = validateHandoffMarkdown(v9bV2());
  assert.deepEqual(
    parsed.changes.map(({ node, id, kind }) => ({ node, id, kind })),
    [{ node: "Navigation", id: "4227:16272", kind: "content changed" }],
  );
});

test("v1's changelog ('No changes detected.') parses to an empty changes array", () => {
  const { parsed } = validateHandoffMarkdown(v9bV1());
  assert.deepEqual(parsed.changes, []);
});

test("a table trailing note still rejects a marker that is neither `†` nor `⚠`", () => {
  const { text, line } = edit(v9bV2(),
    "| colGap | $grid/gap-sm | $grid/gap-sm | $grid/gap | † token-swap",
    "| colGap | $grid/gap-sm | $grid/gap-sm | $grid/gap | see below");
  const [hit] = only(validateHandoffMarkdown(text).findings, "TABLE_RAGGED");
  assert.equal(hit.line, line);
  assert.match(hit.message, /is not a `⚠ <note>` marker/);
});

// 0.4.3 — the real 09:51 brief, schema v11 (export v15, 2026-09-12): the
// plugin also emits a JSON companion for the brief itself (see `src/brief.mjs`),
// and its grid-table cells now carry explicit alignment (`justifySelf:X
// alignSelf:Y`, a fixed pair after `col()`/`row()`); the rest of the v9 line
// grammar (`col(S/N of M)`/`row(S/N)` cells, the `→ CSS` token row form) is
// unchanged, and this fixture still validates with zero findings.
const v11Path = new URL(
  "../fixtures/jhd-v11-2026-09-12/design-handoff-block-navigation.md",
  import.meta.url,
);
const v11 = () => readFileSync(v11Path, "utf8");

test("the real schema-v11 brief validates with zero errors under the v9 line grammar", () => {
  const { ok, findings } = validateHandoffMarkdown(v11());
  assert.equal(ok, true, findings.map((f) => `${f.line} ${f.code} ${f.message}`).join("; "));
});

test("v11's grid tables parse `col(S/N of M)` and `row(S/N)` cells without TABLE_CELL_UNKNOWN", () => {
  const { parsed } = validateHandoffMarkdown(v11());
  const table = parsed.tables.find((t) => t.rows.some((r) => r.cells.some((c) => c.startsWith("col("))));
  assert.ok(table, "expected a grid table with col() cells");
  const descriptionRow = table.rows.find((r) => r.cells.some((c) => c.includes("row(2/1)")));
  assert.ok(descriptionRow, "expected a row combining col() and row()");
});

test("v11's token rows parse the schema-v9 `→ CSS` form, not the legacy `WEB` form", () => {
  const { parsed } = validateHandoffMarkdown(v11());
  assert.equal(parsed.declaredTokenCount.count, parsed.tokens.length);
  const radius = parsed.tokens.find((t) => t.token === "radius/action-radius-round");
  assert.equal(radius.web, "--radius-action-radius-round");
});
