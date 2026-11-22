# HT-134 contrast report fixtures

Two Design System Handoff exports of the JHD design system, vendored from `jhd-design-system`
(`design/handoff/`), gzipped whole:

- `ds-export-16-nov.json.gz` — v40, generated 2026-11-16 06:21Z. The state PF-1743 measured
  before the Time Circuits colour remap (three code overrides were added because of it).
- `ds-export-21-nov.json.gz` — v45, generated 2026-11-21 19:22Z. The state after the remap.

`action-pairs.json` names the Action component's foreground/background pairs by variable
name only; no colour value is copied into it.
