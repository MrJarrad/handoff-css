# HT-102 worked example — raw values from a design link

`card.*` is a real run of the toolkit's `handoff/design-handoff-script` (figma-plugins
`claude/ht102-raw-values`) on a synthetic Figma file: a Card frame whose values are plain numbers,
no Figma variables, so the run takes no `--ds` (HT-107). The link-run file lists every value not
bound to a variable (`unboundValues`). `tokens.css` is a small coded design system.

```
handoff-css match --export card.json --src tokens.css   # → match.md, exit 0
```

`match.md` shows each lock: `#1A1A1AFF` built with `--color-ink` (can't tell apart, HT-104/105);
`#2F2F2FFF` slightly off, listed with `--color-ink-soft` suggested (HT-105); the 12px gap kept and
listed with `--space-2` and `--space-4` (HT-106). Listed values never fail the run.
