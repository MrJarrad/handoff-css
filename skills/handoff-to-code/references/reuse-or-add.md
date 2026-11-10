# Reuse a name, or add one

Step 2b writes down how the system is built; step 3b decides, for each need, whether the system already
has it. This is the detail behind 3b. Nothing here assumes a collection, group, step or mode name: every
one is read from `system-profile.md`.

## Resolve

`handoff-css resolve --export <json|json.gz|zip> --need <needs.json> [--rulings <md>] [--out <dir>] [--json]`
writes `resolve-report.json` and `resolve-report.md`. A need is `{ "id", "name"?, "group"?, "collection"?,
"wants"? }` with at least one of `name`, `group`, `wants`; `wants` maps a mode name (or `*`) to the raw value
the build holds. It never invents a name.

| Verdict | Means | Your move |
| --- | --- | --- |
| `REUSE` | the name exists and holds the wanted value, or a name holds it exactly | build that name |
| `RULED` | a ruling row settles it | build what the ruling says |
| `SIBLING` | no name asked; the nearest name is close but not the same | one question, the nearest as the recommendation |
| `MISMATCH` | the name exists but holds another value | one question: use it, or change the value |
| `NEW_NAME` | the name is not in the system; `bindTo` shows the existing value each mode could point at | one question, `bindTo` as the recommendation |
| `NEW_RAMP` | nothing in the system holds the value in every mode asked | the `ramp` flow below |
| `RULING_STALE` | a `use` ruling names something the export no longer has | ask again |

Every open need carries `fallback: raw-value, assumed-ask`. Exit `0`: all `REUSE` or `RULED`. Exit `2`: at
least one need is open and the report is written. Exit `1`: a usage or input error, nothing written.

Rulings use the table `match` reads, `| kind | figma | ruling | code | note |`, with kind `resolve-need`,
`figma` the need id, and ruling `use` (existing name in `code`), `new` (the designer approved the name) or
`skip`. Record the designer's answer there, and the next run reads it.

## Ramp

`handoff-css ramp --export <json|json.gz|zip> --anchor <#hex>[@step]… [--name <name>] [--from-scratch]
[--for <semantic variable>[@step]… --on <surface variable>… [--use text|large-text|ui] [--keep-anchor]]
[--out <dir>] [--json]` writes `ramp-proposal.json` (a patch) and `ramp-proposal.md`, and writes nothing into
the design file. `--for` and `--on` each name a variable the export has, in full (the full names are in `system-profile.json`); none is inferred, and a name the export lacks exits 1. Exit `2` means a
semantic colour has no passing step; the report names it, so put that to the designer rather than choosing.

**The name.** The ramp's name is the designer's (`--name`) or generated. Ask one question: "generated name
`<name>`, or your own?", recommending the generated one. `nameSource` in the proposal records the answer.

**The yes.** Show `ramp-proposal.md` (name, steps, per-mode step mapping with contrast) and stop. One yes
covers one patch. Without it, hand the patch to the designer.

**The write.** Apply the patch with the host's Figma write tool, following that tool's own instructions.
Worked case: `references/write-back.md` writes through Figma's MCP, loading Figma's own skill first, and
reads the result back. Variables are written the same way: create the ramp's variables with their per-mode
values, then the semantic aliases. Add; never rewrite or remove a variable the designer owns.

**The read-back.** Read the variables again and compare names and per-mode values with
`ramp-proposal.json`. A difference is fixed once; if it still differs, report it and stop.

**After.** Take a new export, `vendor` it, regenerate, and run `resolve` again: the need should now be
`REUSE`. Only then bind. Each written ramp is a row in the deviation table, "written, read back".

## Later: components and blocks

Reuse-before-add for components and blocks is not covered here yet.
