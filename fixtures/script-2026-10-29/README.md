# Link-run script exports, 29 Oct 2026

Made by figma-plugins `handoff/design-handoff-script` (main 3eadb65) from its own recorded REST
reads (`test/fixtures/rest-{navigation,overlay}-2026-10-29T1241.json.gz`, file version
2415764726252821530) with `screenshots: false`, joined to the operator's 28 Oct Design System
Handoff export of JHD-Spec-DesignSystem (`design-system-handoff.json.gz`, copied unchanged from
that repo's `test/fixtures/design-system-handoff-2026-10-28.json.gz`).

- `navigation.*` — Navigation (4227:16271), brief schema v13.
- `overlay.*` — Overlay (4227:16274), brief schema v14: it holds the Overlay spec (5408:2621),
  listed without text.

Both briefs carry `linkRun` with one finding, `DS_EXPORT_HAS_NO_ANNOTATIONS` (the 28 Oct export
predates annotation export), so their annotations are label-only (`labelMarkdown`,
`categoryId`, `category` null). Gzipped to keep the repo small; tests read them with `zlib`.
