// The reconciliation report — the audit trail for every decision the emit
// modules took, and the place a consumer's own policy narrative lands.
//
// The tables here are mechanics and stay generic. Every paragraph that states
// a HOUSE fact — which ruling excluded a path, which modes a collection
// publishes, why a namespace is held — is a `report.notes.*` string in the
// consumer's config, interpolated with `{{name}}` placeholders. A consumer that
// supplies none still gets the whole report; it just carries no narrative.
import { layoutBreakpoints } from "./modes.mjs";
import { cmp, num } from "./resolve.mjs";
import { changesOutput } from "./responsive.mjs";

/** `{{name}}` -> `vars.name`. An unknown placeholder is left alone, not blanked. */
const fillIn = (text, vars) =>
  String(text ?? "").replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export function report(doc, rows, handNames, handScoped, themeRows, handDeclared, cfg,
                       privateRows = [], hiddenRows = [], excludedRows = [],
                       responsiveRows = [], aliasRows = [], warnings = []) {
  const handFile = cfg.paths.handAuthored.split("/").pop();
  const by = (s) => rows.filter((r) => r.status === s);
  const drift = by("VALUE-DRIFT");
  const match = by("MATCH");
  const onlyExport = by("NAME-ONLY-IN-EXPORT");
  const unconverted = rows.filter((r) => r.unconverted).sort((a, b) => cmp(a.name, b.name));
  const scopedOnly = [...handScoped].filter((n) => rows.some((r) => r.name === n)).sort(cmp);
  const colourSuppressed = rows.filter(
    (r) => cfg.report.colourCollections.includes(r.collection) && r.status !== "NAME-ONLY-IN-EXPORT",
  );
  const layout = layoutBreakpoints(doc, cfg);
  const { widths, variants } = layout;
  const codeNameChanged = doc.changes?.variables?.codeNameChanged ?? [];

  const parity = rows
    .filter((r) => r.name.startsWith(cfg.report.parity.namePrefix))
    .sort((a, b) => cmp(a.name, b.name));
  const zeroUsage = rows.filter((r) => r.usage === 0).sort((a, b) => cmp(a.name, b.name));
  const unresolvedAlias = rows.filter((r) => r.unresolvedAlias);
  const styleSummary = (doc.styleSummaries ?? [])
    .map((s) => `| ${s.type} | ${s.styleCount} | ${(s.groups ?? []).map((g) => g.name).join(", ") || "—"} |`)
    .join("\n");

  const note = (key, vars = {}) =>
    fillIn(cfg.report.notes?.[key], {
      handAuthored: cfg.paths.handAuthored,
      out: cfg.paths.out,
      theme: cfg.paths.theme,
      policyRef: cfg.report.policyRef,
      unconverted: unconverted.length,
      colourSuppressed: colourSuppressed.length,
      ...vars,
    });

  return `# ${cfg.report.title}

GENERATED FILE — regenerate with \`${cfg.header.regenerateCommand}\`.

| | |
| --- | --- |
| Export | \`${doc.artifactFilename ?? doc.documentName}\` |
| Schema | ${doc.schema} v${doc.schemaVersion} |
| Exported at | ${doc.generatedAt} |
| designSystemStateHash | \`${doc.fingerprint.designSystemStateHash}\` |
| Tokens in export | ${rows.length} |
| MATCH (hand-authored, same value) | ${match.length} |
| VALUE-DRIFT (hand-authored, different value) | ${drift.length} |
| NAME-ONLY-IN-EXPORT (newly generated) | ${onlyExport.length} |
| NAME-ONLY-IN-HAND (in ${handFile}, not in export) | see §4 |
| PRIVATE (hidden, but an alias target of a published token — emitted) | ${privateRows.length} |
| HIDDEN (hidden and unreachable — not emitted) | ${hiddenRows.length} |
| EXCLUDED (\`EXCLUDE_PATHS\` policy list — not emitted) | ${excludedRows.length} |

Statuses compare the export's **default mode** against the value declared in
\`${cfg.paths.handAuthored}\`. Anything with a hand-authored declaration is reported here but
**not** emitted into \`${cfg.paths.out}\` — hand-authored wins (policy P2).
PRIVATE, HIDDEN and EXCLUDED variables (policy P7, §0) are never counted in
MATCH/VALUE-DRIFT/NAME-ONLY-IN-EXPORT — they are not public design-system
tokens. Of the three, **only PRIVATE is emitted**, because published tokens
alias it and a referenced-but-undeclared custom property is invalid at
computed-value time.

## 0. PRIVATE (${privateRows.length}), HIDDEN (${hiddenRows.length}) and EXCLUDED (${excludedRows.length})

Not public tokens, and excluded from every other class in this report (policy P7
in \`${cfg.report.policyRef}\`). ${note("private")}

**PRIVATE** — hidden in Figma, but reachable by alias from a published token, so
they **are** emitted (same names, fenced in a marked block). Not publishing a
primitive in Figma means *"don't pick this in a layout"*; it does not mean the
value is unused. CSS has no such distinction — dropping these would leave the
semantic tokens that reference them invalid at computed-value time. Reference the
semantic token in the "Aliased by" column, never the private name.

${privateRows.length
  ? ["| Name | Collection | Value | Aliased by |", "| --- | --- | --- | --- |",
     ...[...privateRows].sort((a, b) => cmp(a.name, b.name)).map(
       (r) => `| \`${r.name}\` | ${r.collection} | \`${r.value}\` | ${r.aliasedBy.map((n) => `\`${n}\``).join(", ") || "—"} |`)].join("\n")
  : "None."}

**HIDDEN** — marked \`hiddenFromPublishing\` / \`effectivelyHiddenFromPublishing\`
in the export **and** unreachable by alias from anything emitted. Nothing refers
to them, so they are safely dropped. This is the durable signal: once Figma marks
a variable hidden and nothing aliases it, it lands here with no generator change.

${hiddenRows.length
  ? ["| Name | Collection |", "| --- | --- |",
     ...[...hiddenRows].sort((a, b) => cmp(a.name, b.name)).map((r) => `| \`${r.name}\` | ${r.collection} |`)].join("\n")
  : "None."}

**EXCLUDED** — matched an \`EXCLUDE_PATHS\` prefix. A policy list applied wholesale
on path identity, regardless of hidden state, and never revived by reachability.
${note("excluded")}

${excludedRows.length
  ? ["| Name | Collection | Reason |", "| --- | --- | --- |",
     ...[...excludedRows].sort((a, b) => cmp(a.name, b.name)).map((r) => `| \`${r.name}\` | ${r.collection} | ${r.reason} |`)].join("\n")
  : "None."}

## 1. ${cfg.report.parity.title}

${[`| Token | Export | ${handFile} | Status |`, "| --- | --- | --- | --- |",
  ...parity.map((r) => `| \`${r.name}\` | \`${r.generated}\` | ${r.hand ? `\`${r.hand}\`` : "—" } | ${r.status} |`)].join("\n")}

## 2. VALUE-DRIFT (${drift.length})

${drift.length
  ? [`| Token | Collection | Export | ${handFile} |`, "| --- | --- | --- | --- |",
     ...drift.sort((a, b) => cmp(a.name, b.name)).map((r) => `| \`${r.name}\` | ${r.collection} | \`${r.generated}\` | \`${r.hand}\` |`)].join("\n")
  : "None."}

## 3. MATCH (${match.length})

${match.length
  ? ["| Token | Collection | Value |", "| --- | --- | --- |",
     ...match.sort((a, b) => cmp(a.name, b.name)).map((r) => `| \`${r.name}\` | ${r.collection} | \`${r.generated}\` |`)].join("\n")
  : "None."}

## 4. NAME-ONLY-IN-HAND

Every \`--*\` declared in \`${cfg.paths.handAuthored}\` whose name is not a WEB name in the
export. ${note("nameOnlyInHand")}

${(() => {
  const exportNames = new Set(rows.map((r) => r.name));
  const handOnly = [...handNames].filter((n) => !exportNames.has(n)).sort(cmp);
  return `${handOnly.length} names.\n\n${handOnly.map((n) => `- \`${n}\``).join("\n")}`;
})()}

## 5. Unresolved aliases (${unresolvedAlias.length})

${unresolvedAlias.length
  ? unresolvedAlias.map((r) => `- \`${r.name}\` — terminal value inlined`).join("\n")
  : "None. Every alias in the export resolves to a variable that is also in the export."}

## 6. UNCONVERTED (${unconverted.length})

Tokens where the export names a \`conversionStrategy\` it could not carry out,
so no \`convertedValue\` is published. The generator emits the raw source value
with an inline \`UNCONVERTED:\` comment — it does **not** invent the missing
divisor (P4).

${unconverted.length
  ? ["| Token | Collection | Strategy | buildUnit | Confidence | Emitted |", "| --- | --- | --- | --- | --- | --- |",
     ...unconverted.map((r) => `| \`${r.name}\` | ${r.collection} | ${r.unconverted.strategy} | ${r.unconverted.buildUnit ?? "—"} | ${r.unconverted.confidence} | \`${r.generated}\` |`)].join("\n")
  : "None."}

## 7. Layout modes — media queries (${widths.size ? "resolved" : "unresolved"})

${note("layoutModes")}

${widths.size
  ? `All ${widths.size} layout modes resolve to a width, so they are emitted as
mobile-first \`@media (min-width: …)\` blocks in ascending width order. The
second axis — \`layoutVariant\` — is a selector, not a width: \`default\` lands on
\`:root\`, every other variant on \`[${cfg.layout.variantAttribute}="<variant>"]\` inside
the same media block.

${["| Mode | Width | layoutVariant | Emitted as |", "| --- | --- | --- | --- |",
   ...(doc.collections.find((c) => c.name === cfg.layout.collection)?.modes ?? []).map((m) => {
     const variant = variants.get(m.id) ?? "default";
     const sel = variant === "default" ? ":root" : `[${cfg.layout.variantAttribute}="${variant}"]`;
     const base = m.id === layout.baseModeId ? ` (also the unconditional \`${sel}\` base)` : "";
     return `| \`${m.name}\` | ${num(widths.get(m.id))}px | ${variant} | \`@media (min-width: ${num(widths.get(m.id))}px) { ${sel} }\`${base} |`;
   })].join("\n")}

${note("baseMode")}`
  : `The export does not publish a resolvable width for every layout mode in
\`breakpoints.entries\`, so the generator keeps the \`[${cfg.modes.collectionModeAttribute.replace("{collection}", cfg.layout.collection)}="…"]\`
placeholder rather than guessing breakpoints. **Open question 1 stays open.**`}

## 8. Hand-authored but SCOPED (${scopedOnly.length})

Names \`${handFile}\` declares only inside a scoped or conditional block
(\`.dark\`, \`@media\`, \`@supports\`, \`@utility\`) and never globally. A scoped
declaration cannot supersede the token everywhere, so it does **not** suppress
generation — the generated global declaration is what the scoped one overrides.

${scopedOnly.length ? scopedOnly.map((n) => `- \`${n}\``).join("\n") : "None."}

## 9. P8 — Tailwind namespace reconciliation

\`${cfg.paths.theme}\` emits ONE \`@theme\` block: a \`--<namespace>-*: initial\`
reset per namespace the house populates, then house-keyed entries whose suffixes
come from the export's own WEB names (P8.1). P2 does **not** apply to that file —
a namespace reset is only true if the whole namespace is emitted in one place, so
P8 always emits the full namespace and this section is how the hand-authored
\`@theme\` entries in \`${cfg.paths.handAuthored}\` are settled against it.

**GENERATED-EQUIVALENT** — byte-equal to what P8 emits. ${note("generatedEquivalent")} **VALUE-DRIFT** — same key, different value: ${handFile}
keeps it (it overrides the generated entry, being later in the cascade) and the
disagreement needs its own ruling. **HAND-ONLY** — a key P8 does not emit at all,
because the export has no variable behind it.

${(() => {
  const namespaces = [...new Set(themeRows.map((r) => r.ns))];
  const inNs = (k) => namespaces.find((ns) => k.startsWith(`--${ns}-`));
  const gen = new Map(themeRows.map((r) => [r.key, r.value]));
  const hand = [...handDeclared].filter(([k]) => inNs(k)).sort((a, b) => cmp(a[0], b[0]));
  const cls = (k, v) => (!gen.has(k) ? "HAND-ONLY" : gen.get(k) === v ? "GENERATED-EQUIVALENT" : "VALUE-DRIFT");
  const counts = { "GENERATED-EQUIVALENT": 0, "VALUE-DRIFT": 0, "HAND-ONLY": 0 };
  const table = hand.map(([k, v]) => {
    const c = cls(k, v);
    counts[c] += 1;
    return `| \`${k}\` | ${inNs(k)} | ${gen.has(k) ? `\`${gen.get(k)}\`` : "—"} | \`${v}\` | ${c} |`;
  });
  const summary = Object.entries(counts).map(([c, n]) => `${c}: ${n}`).join(" · ");
  return `${themeRows.length} generated \`@theme\` keys across ${namespaces.length} namespaces.
${hand.length} hand-authored \`@theme\` entries fall inside those namespaces — ${summary}.

${table.length ? [`| Key | Namespace | P8 emits | ${handFile} | Status |`, "| --- | --- | --- | --- | --- |", ...table].join("\n") : "None."}

### Namespaces NOT reset (P8.3)

${["| Namespace | Why it is held |", "| --- | --- |", ...cfg.tailwind.held.map(([k, why]) => `| \`${k}\` | ${why} |`)].join("\n")}

### Breakpoints emitted (P8.4)

${["| Key | Value | Figma |", "| --- | --- | --- |",
   ...themeRows.filter((r) => r.ns === "breakpoint").map((r) => `| \`${r.key}\` | \`${r.value}\` | ${r.note} |`)].join("\n")}

${note("breakpointNote")}`;
})()}

## 10. Responsive classes (P11) and aliases (P12)

How each variable became CSS. **Class** is the export's own responsive class —
\`viewport-width\` / \`viewport-height\` (a fraction of the screen), \`fluid-clamp\`
(one \`clamp()\` across the range), \`mode-stepped\` (per-breakpoint samples),
\`fixed\` (equal at every mode), \`sample-only\` (one published sample). **Source**
is where the class came from: a \`responsive\` **field** on the variable, the
\`"N% of screen height|width"\` **description** convention, the export's own
\`responsiveBehavior\` (**export**), or none of the three (**default**).
**Effect** is what this run emitted — only a class named in
\`responsive.honourClasses\` changes it; every other class takes the per-mode
path, so parity can be pinned.

Honoured this run: ${cfg.responsive.honourClasses.length ? cfg.responsive.honourClasses.map((c) => `\`${c}\``).join(", ") : "none — every class takes the per-mode path"}.

${(() => {
  const classified = responsiveRows.filter((r) => r.cls).sort((a, b) => cmp(a.name, b.name));
  const tally = {};
  for (const r of classified) tally[`${r.cls} (${r.source})`] = (tally[`${r.cls} (${r.source})`] ?? 0) + 1;
  const summary = Object.entries(tally).sort((a, b) => cmp(a[0], b[0]))
    .map(([k, n]) => `${k}: ${n}`).join(" · ");
  // Listed individually: every variable whose class WOULD change its output if
  // honoured. The rest are `mode-stepped`/`sample-only` — the per-mode path
  // either way — and there are too many to be worth a row each.
  const table = classified.filter((r) => changesOutput(r.cls));
  return `${classified.length} of ${responsiveRows.length} emitted variables carry a class — ${summary || "none"}.
The other ${classified.length - table.length} are \`mode-stepped\` or \`sample-only\`, which IS the
per-mode path, so they are not listed individually: their output is unchanged.

${table.length
  ? ["| Token | Collection | Class | Source | Effect |", "| --- | --- | --- | --- | --- |",
     ...table.map((r) => `| \`${r.name}\` | ${r.collection} | ${r.cls} | ${r.source} | ${r.effect} |`)].join("\n")
  : "None."}`;
})()}

**Warnings (${warnings.length})** — what the generator would not guess at. A
variable in a \`viewport.groups\` group with no stated fraction keeps its px
samples: the fix is one description in Figma, not a heuristic here.

${warnings.length
  ? ["| Code | Token | Detail |", "| --- | --- | --- |",
     ...[...warnings].sort((a, b) => cmp(a.code + a.name, b.code + b.name))
       .map((w) => `| \`${w.code}\` | \`${w.name}\` | ${w.detail} |`)].join("\n")
  : "None."}

**Aliases (${aliasRows.length})** — published names that are a \`var()\` hop onto a
generated token, expanded from \`aliases\` over the emitted leaves. The token is
still the single place the value is stated.

${aliasRows.length
  ? ["| Alias | Target | Pattern |", "| --- | --- | --- |",
     ...aliasRows.map((r) => `| \`${r.name}\` | \`${r.target}\` | \`${r.pattern}\` |`)].join("\n")
  : "None."}

## Appendix A — zero-usage tokens (${zeroUsage.length})

${note("zeroUsage")}

${zeroUsage.length ? zeroUsage.map((r) => `- \`${r.name}\` (${r.collection})`).join("\n") : "None."}

## Appendix C — codeNameChanged (${codeNameChanged.length})

Schema 6's \`changes.variables.codeNameChanged\` — variables whose emitted WEB
name changed since the export's diff baseline, its own class distinct from
renamed/valueChanged/aliasRetargeted (a name change is a breaking change for
every consumer that binds to it by string; a value or alias change is not).
Reported as its own class, not merged into MATCH/VALUE-DRIFT/NAME-ONLY-IN-EXPORT.

${codeNameChanged.length
  ? codeNameChanged.map((c) => `- \`${JSON.stringify(c)}\``).join("\n")
  : "None."}

## Appendix B — styles (not generated this slice)

${note("styles")}

${["| Type | Styles | Groups |", "| --- | --- | --- |", styleSummary].join("\n")}

## Open questions for the operator

${note("openQuestions")}
`;
}
