# `design-handoff` v6 — line grammar

The other half of the pair is markdown, so it has no JSON Schema. This file is its contract:
the lines `handoff-css` reads by shape, the vocabulary their cells may use, and the code each
violation raises. `src/validate-handoff-md.mjs` implements exactly this document; the real
`fixtures/jhd-v8b-2026-09-10/design-handoff-block-navigation.md` is the conformance fixture.

Everything not listed here is prose the validator passes through untouched. The grammar is
deliberately narrow: it covers the lines a consumer *binds to*, because those are the lines a
silent drift would corrupt a build from.

## Header block — the identity lines

| Line | Shape | Code when wrong |
| --- | --- | --- |
| Artifact | `**Artifact:** \`design-handoff\` schema v<N> · compatibility \`<contract>\` · lane \`<lane>\` · filename \`<file>\`` | `ARTIFACT_LINE_MALFORMED` (error) |
| Content hash | `**Content hash:** \`<64 hex>\` · SHA-256 · policy v<N> …` | `CONTENT_HASH_MALFORMED` (error) |
| Fingerprint | `**Fingerprint:** current design-system state \`<64 hex>\` · SHA-256 policy v<N> · naming v<N> · units v<N> · mode v<N> · responsive v<N>` | `FINGERPRINT_MALFORMED` (error) |
| Companion block | `**Design system handoff:**` followed by the four `- ` lines below | `COMPANION_BLOCK_MALFORMED` (error) |

The companion block's four lines:

```
- Last-known companion `<base>` · `design-system-handoff` v<N> · content `<64 hex>` · state `<64 hex>`
- Policies: fingerprint v<N> · naming v<N> · units v<N> · mode v<N> · <n> collections · <n> variables · <n> styles
- Generated: <ISO-8601> · independent state hash matches.
- Hash references identify the last-known companion only; they do not claim simultaneous export.
```

Two cross-checks run on those values:

- **`COMPANION_STATE_MISMATCH` (error)** — the companion block's `state` is not the header
  `Fingerprint`'s state hash. The two halves describe different design-system states; this is
  the stale-pair defect `handoff-to-code` step 1 stops on.
- **`POLICY_VERSION_MISMATCH` (warning)** — a policy version stated in both the header
  `Fingerprint` line and the companion `Policies:` line disagrees. The real 2026-09-10 nav
  brief carries exactly one: `units v4` in the header, `units v5` in the companion. It is a
  warning, not an error, because neither number changes a binding — but it is the kind of
  drift that stops being harmless the day a consumer reads units policy from the markdown.

## Build standards

`**Build standards:**` followed by numbered items `1.`…`5.`, each `**bolded title** — body`.
These are the mechanism rules `handoff-to-code` step 4 builds against, so a brief that ships
four of them has dropped one: `BUILD_STANDARDS_INCOMPLETE` (error), reported at the block's
first line, naming the numbers found.

## Required sections

`## Design handoff`, `## Design Summary`, `### Content Outline`, `**Build standards:**`,
`**Design system handoff:**`, and a `**Variable tokens (<N> unique):**` block. A missing one
is `MISSING_SECTION` (error), reported at line 1 with the section named.

## Token rows

```
- $<collection>/<path> · WEB `--<name>` (<source>) · ANDROID `…` · iOS `…` · scopes … · …
  Responsive behavior: <variant>=<value>; …
```

The `WEB` backtick is the binding name — the same string `codeSyntax.WEB.value` carries in the
companion JSON, and the only name a consumer may bind. A row that states no WEB name is
`TOKEN_ROW_MALFORMED` (error). The section header states its own count; a count that does not
match the rows parsed is `TOKEN_ROW_COUNT_MISMATCH` (error), reported at the header line —
a truncated brief is otherwise indistinguishable from a small one.

## Node rows

A node row is either the section anchor

```
### <Name> (<TYPE>) #<id> <w>×<h> [→](<url>) …
```

or a tree row at any indent

```
- **<Name>** (<TYPE>) #<id> <sizing> … [→](<url>)
```

`TYPE` is Figma's node type (`SECTION`, `FRAME`, `COMPONENT_SET`, `COMPONENT`, `INSTANCE`,
`TEXT`, …). `#<id>` is the Plugin API node id and is what a defect cites — line numbers drift,
ids do not. A row with no `#id` is `NODE_ROW_MALFORMED` (error).

Every node row carries a `[→]` node link, so a reader can open the node: `NODE_LINK_MISSING`
(error). One exception, present in the real brief: a row whose line carries a `📝` annotation
puts the link at the end of the annotation, which is a multi-line block — those rows are
exempt rather than reported.

Copy on a `TEXT` row is the quoted string after `— `; `⚠ placeholder` after it means the
design has not stated the copy. The validator **parses** placeholders and never warns on them:
they are the design file's state, and it is the *consumer* that must not ship one
(`PLACEHOLDER_COPY`, `handoff-css conform`).

The 2026-09-11 export gave `⚠` a single meaning — a raw value that should be bound — and moved
table/footnote/layout notes to `†`. Both forms of the raw marker mean the same thing:
`⚠raw <value>` (the export's prose name for it) and the bare `⚠<value>` it actually emits inline
(`radius(⚠2)`, `fill(⚠#eeeeee)`) both read as unbound raw. Neither is structurally parsed today —
they are prose the validator passes through, same as before — this section states the
normalisation so a future check has one meaning to enforce, not two sigils to special-case.

## Changelog

```
**Changelog** _(since <ISO-8601>):_
- **<Node>** #<id> — <kind>
```

or `- No changes detected.` Rows parse into `parsed.changes: {node, id, kind, line}[]`. Not
validated — there is no wrong shape for "nothing changed" — but parsed, because `id` is the
stable citation a consumer diffs a re-export against.

## Footnotes and row-wrap notes

A standalone line whose only content is a sigil and prose — a table footnote
(`† **sm** wraps to 2 rows…`) or a layout-block aside (`† row-wrap (…)` inside a node row's
bracketed `[Grid, …]` list) — is a **note**, never a binding. Table footnotes parse into
`parsed.notes: {marker, text, line}[]`; `marker` is whichever sigil the line used (`†` the
2026-09-11 form, `⚠` the legacy one) and carries no different meaning. A row-wrap note that
sits inside a node row's bracket list is not separately parsed — it is inside prose the
validator already passes through untouched — but it is unambiguously a note, not a binding,
under either sigil.

## Responsive grid tables

```
| Child | lg+ | md | sm |
| --- | --- | --- | --- |
| size (w×h) | $device/width×hug | … | … |
| title | col-span 3/12 | col-span 3/12 | col-span 6/12 |
| colGap | $grid/gap-sm | $grid/gap-sm | $grid/gap | † token-swap
```

Cells in the value columns use one closed vocabulary:

| Cell | Meaning |
| --- | --- |
| `—` | not set at this variant |
| `$a/b` (joined by `×`, `/`, `+`, or spaces) | variable bindings — the sizing chain |
| `col-span N/M` | grid placement: `grid-column: span N` on an M-column grid |
| `hug` / `fill` | sizing chain terms |
| a bare number or `<n>px` | a reference sample |

Anything else is `TABLE_CELL_UNKNOWN` (error) at that line.

The last row of a variant column may be **ragged** — one extra trailing cell with no closing
pipe, carrying a note marker (`† token-swap`, `† variant-only`, or the pre-2026-09-11
`⚠ token-swap` / `⚠ variant-only` form). Both sigils are accepted and normalise to the same
`row.note` field (the sigil stripped); a ragged row whose extra cell is neither is
`TABLE_RAGGED` (error), and a row with fewer cells than the header is `TABLE_RAGGED` too.

## Exit codes

`handoff-css validate` prints one line per file and exits 1 if any file raised an **error**.
Warnings never fail the run: a warning is a decision waiting on a human, not a broken file.
