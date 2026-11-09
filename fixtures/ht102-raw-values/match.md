## Raw values

11 values not bound to a Figma variable · 6 built with a token · 5 need your call · 0 ruled

### Built with a token

Each is built with the token. To keep the raw value instead, add a `keep` row to the ruling table.

| kind | figma | token | why | where |
| --- | --- | --- | --- | --- |
| raw-size | 320px | --size-card | same: 20rem | 1 layer |
| raw-spacing | 16px | --space-4 | same: 1rem | 4 layers |
| raw-radius | 8px | --radius-md | same: 0.5rem | 2 layers |
| raw-colour | #1A1A1AFF | --color-ink | can't tell apart: ΔE 0.0 | 2 layers |
| raw-spacing | 8px | --space-2 | same: 0.5rem | 4 layers |
| raw-type | fontWeight 500 | --font-weight-medium | same: 500 | 1 layer |

### Needs your call

Built with the exact value and a deviation row until ruled — never a stop. Rule each row `use` (with the token) or `keep`, then pass the table back with `--rulings`.

| kind | figma | ruling | code | note |
| --- | --- | --- | --- | --- |
| raw-size | 200px |  |  | beyond the scale: exact 200px kept, nearest --size-card; suggested --size-card (20rem, +120px); 1 layer |
| raw-spacing | 12px |  |  | between --space-2 and --space-4: exact 12px kept; suggested --space-2 (0.5rem, -4px) or --space-4 (1rem, +4px); 1 layer |
| raw-colour | #2F2F2FFF |  | --color-ink-soft | slightly off: ΔE 3.5; suggested --color-ink-soft (#3a3a3a, ΔE 3.5); 1 layer |
| raw-type | fontSize 15px |  |  | between --font-size-sm and --font-size-md: exact 15px kept; suggested --font-size-sm (0.875rem, -1px) or --font-size-md (1rem, +1px); 1 layer |
| raw-type | lineHeight 22px |  |  | beyond the scale: exact 22px kept, nearest --line-height-md; suggested --line-height-md (1.5rem, +2px); 1 layer |
