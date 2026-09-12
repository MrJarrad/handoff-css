# `design-handoff` v9 — line grammar

This is the delta on top of `design-handoff.v6.grammar.md`, not a replacement for it: every
line the v6 grammar defines still applies unless this file states otherwise. `handoff-css
validate` picks the grammar to check by the file's `schemaVersion` (front matter first, the
bold `**Artifact:**` line otherwise); a schema-9 brief is checked against v6 plus these deltas.
The real `fixtures/jhd-v11-2026-09-12/design-handoff-block-navigation.md` (export v11,
2026-09-12) is the conformance fixture.

## Token rows (export v11, 2026-09-12)

Schema v9 dropped the per-platform `WEB`/`ANDROID`/`iOS` `codeSyntax` columns from the token
row's single line. The binding name now sits inline after `→ CSS`, and the fields that used to
trail the row on the same line (`scopes`, `mode builds`, the `(=…)` sample, `Responsive
behavior:`) move to indented continuation lines beneath it:

```
- $radius/action-radius-round → CSS `--radius-action-radius-round` · default=0.25rem
  scopes CORNER_RADIUS · stored raw-number / source px / build rem via divide-by-root-font-size (root 16px) (high)
  modes `[{"modeId":"8:0","modeName":"default","build":{…}}]`
  (=4)
```

The `CSS` backtick is the binding name — same role the v6 grammar's `WEB` backtick played, and
the only string a consumer may bind. A row with no `CSS` name is still `TOKEN_ROW_MALFORMED`
(error); the `**Variable tokens (<N> unique):**` header count still cross-checks against rows
parsed (`TOKEN_ROW_COUNT_MISMATCH`). Continuation lines (`scopes`, `modes`, `(=…)`,
`Responsive behavior:`) are not separately validated — they are prose the validator passes
through, same as the v6 grammar's `Responsive behavior:` line.

## Grid-table cell vocabulary — `col()` / `row()`

The responsive grid table's closed cell vocabulary (v6 grammar §Responsive grid tables) gains
two forms:

| Cell | Meaning |
| --- | --- |
| `col(S/N of M)` | `grid-column: S / span N` on an M-column grid |
| `row(S/N)` | `grid-row: S / span N` |
| `col(S/N of M) row(S/N)` | both, `col()` first, space-separated |

Anything else is still `TABLE_CELL_UNKNOWN` (error) at that line, per v6.

## Aspect-ratio notes

The `Notes` column (or legacy ragged trailing cell) may carry an aspect-ratio hint:
`† aspect: $token (stable)` (same ratio at every breakpoint — implement with CSS
`aspect-ratio` and intrinsic height) or `† aspect: varies ($t1→$t2)` (ratio shifts across
breakpoints — implement per-breakpoint dimensions instead). Both are ordinary `† <note>` /
`⚠ <note>` prose under the existing Notes-cell grammar (§Notes column, v6) — no new parsing,
just a documented vocabulary a consumer's `col()`/`aspect` build step reads.

## Node hint prose

The following node-row hints are new in the schema-v9 legend. None of them change the node-row
*shape* the v6 grammar parses (`- **Name** (TYPE) #id … [→](url)`) — they are inline prose
tokens inside a node row's trailing details, same status as v6's `constraints()` or
`justify:X`, and are not separately validated:

- `semantic(<tag>)` — inferred HTML element (from naming, structure, or interactions);
  auto-detected tags include `<nav>`, `<h1>`–`<h6>`, `<img>`, `<dialog>`, `<input>`, and more
- `interactive(click, hover, drag, keyboard)` — node has prototype interactions, needs an
  interactive element wired for the named event(s)
- `states(:hover, :focus, :disabled, …)` — CSS pseudo-class states available as component
  variants
- `a11y(…)` — accessibility attribute from a designer description, either an attribute form
  (`a11y(aria-label: …)`) or a role form (`a11y(role: …)`)
- `position(sticky)` / `position(fixed)` — positioning hint from a designer description
- `@container` — container-query hint from a designer description
- `desc("…")` — a designer description note carried for build context
- `link(url)` — hyperlink destination (v6 legend; restated here as it composes with the above)

The full Design Handoff plugin (per the operator's Figma-agent overview,
`~/JHD/vault/main/references/assets/figma-handoff-plugins-overview-2026-09-12/`) emits a wider
per-node vocabulary than any single brief necessarily exercises — `aspect($token)` /
`aspect(16:9, locked)` / `aspectLocked`, `alignSelf`/`alignContent`, `reverseZ`, masks,
`smooth(60%)` corner smoothing, gradient/multi fills, per-side stroke weight/align/dash/cap/
join, and text properties (`truncate(N lines)`, `textWrap:balance`, `leadingTrim`, hanging
punctuation). All of it is prose the v6/v9 grammar passes through untouched inside a node row's
trailing details — the grammar's job is the row *shape*, never the hint vocabulary inside it —
except the two cases that can also appear as a bare **table cell** value rather than node-row
prose, which the CELL vocabulary now accepts explicitly: `aspect(…)` and `justifySelf:X` /
`alignSelf:X`.

A schema-v9 export may also add optional sections beyond the six the grammar requires — a
Z-Index Scale and Motion & Transition Tokens section were named in the plugin overview. Neither
is in `REQUIRED_SECTIONS`: an unlisted section is prose, present or absent per page, and its
absence is never `MISSING_SECTION`.

## Build standards (unchanged count)

Schema v9's `**Build standards:**` block is still five items (1–5); the count check
(`BUILD_STANDARDS_INCOMPLETE`) is unchanged from v6. The three additional consumption rules —
semantic HTML, accessibility, description conventions — live in the brief's numbered "How to
use this brief" list (items 9–11), which is prose the grammar has never validated (v6
grammar's "everything not listed here is prose the validator passes through untouched").

## Exit codes

Unchanged from v6: `handoff-css validate` exits 1 if any file raised an **error**; warnings
never fail the run.
