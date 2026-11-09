# Link-run notes

_Written by design-handoff-script beside `design-handoff-example-checkout-card-2026-11-09-13-56-40.md`; the brief itself is exactly the plugin's. Tied to it by content hash `8c828900da237560abf5fd4eac8b3a6973a3babcc91fe1b4719a3fc35688cb44`._

## Link-run findings

_Checked by design-handoff-script against Figma file version 1; not part of the plugin export._

No findings.

**Sources:**
- This file: Example (F) — 0 components, 0 styles, 0 variables; no Design System Handoff export given

## Values not bound to a variable

19 values the layer states as a plain number; `handoff-css match --export` matches each to the project's own tokens.

| layer | kind | property | value |
| --- | --- | --- | --- |
| Card (`20:1`) | size | width | 320 |
| Card (`20:1`) | size | height | 200 |
| Card (`20:1`) | spacing | gap | 12 |
| Card (`20:1`) | spacing | paddingTop | 16 |
| Card (`20:1`) | spacing | paddingRight | 16 |
| Card (`20:1`) | spacing | paddingBottom | 16 |
| Card (`20:1`) | spacing | paddingLeft | 16 |
| Card (`20:1`) | radius | cornerRadius | 8 |
| Card (`20:1`) | colour | fill | #1A1A1AFF |
| title (`20:3`) | colour | fill | #1A1A1AFF |
| Note (`20:2`) | spacing | paddingTop | 8 |
| Note (`20:2`) | spacing | paddingRight | 8 |
| Note (`20:2`) | spacing | paddingBottom | 8 |
| Note (`20:2`) | spacing | paddingLeft | 8 |
| Note (`20:2`) | radius | cornerRadius | 8 |
| Note (`20:2`) | colour | fill | #2F2F2FFF |
| title (`20:3`) | type | fontSize | 15 |
| title (`20:3`) | type | lineHeight | 22 |
| title (`20:3`) | type | fontWeight | 500 |

## Asks

_What a build would otherwise guess, checked by design-handoff-script. Asks are answered in chat, through the agent, and never stop a run: until one is answered, a build takes its suggestion (from the design system or the motion law) as a recorded assumption. Outcome is the likely route: figma-update (the person changes Figma), code-side (added in the codebase) or accept-suggestion. The key matches an open ask across runs._

- **VALUE_UNBOUND** `VALUE_UNBOUND:20:1:fill` Card → fill: Card fill #1A1A1AFF is bound to no variable — which token? No suggestion. Outcome: figma-update. Status: open — no answer and no suggestion; a build guesses nothing and reports it. [→](https://figma.com/design/F?node-id=20-1)
- **VALUE_UNBOUND** `VALUE_UNBOUND:20:1:radius` Card → radius: Card radius 8 is bound to no variable — which token? No suggestion. Outcome: figma-update. Status: open — no answer and no suggestion; a build guesses nothing and reports it. [→](https://figma.com/design/F?node-id=20-1)
- **VALUE_UNBOUND** `VALUE_UNBOUND:20:3:fill` title → fill: title fill #1A1A1AFF is bound to no variable — which token? No suggestion. Outcome: figma-update. Status: open — no answer and no suggestion; a build guesses nothing and reports it. [→](https://figma.com/design/F?node-id=20-3)
- **VALUE_UNBOUND** `VALUE_UNBOUND:20:2:fill` Note → fill: Note fill #2F2F2FFF is bound to no variable — which token? No suggestion. Outcome: figma-update. Status: open — no answer and no suggestion; a build guesses nothing and reports it. [→](https://figma.com/design/F?node-id=20-2)
- **VALUE_UNBOUND** `VALUE_UNBOUND:20:2:radius` Note → radius: Note radius 8 is bound to no variable — which token? No suggestion. Outcome: figma-update. Status: open — no answer and no suggestion; a build guesses nothing and reports it. [→](https://figma.com/design/F?node-id=20-2)
