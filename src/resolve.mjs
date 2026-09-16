// Value rendering (policies P4, P5, P9) plus the two determinism primitives
// every other module needs: `num` (float32 noise rounded off) and `cmp`.
// See docs/POLICIES.md.
import { isRatioVariable, ratioValue } from "./aspect.mjs";
import { webName } from "./schema.mjs";

export const fail = (msg) => {
  throw new Error(`handoff-css: ${msg}`);
};

/** Figma stores float32; round off the representation noise deterministically. */
export const num = (n) => {
  if (typeof n !== "number" || !Number.isFinite(n)) fail(`non-finite number ${n}`);
  const r = Math.round(n * 1e6) / 1e6;
  return String(r === 0 ? 0 : r);
};

/**
 * `#RRGGBBAA` (the export's COLOR form) -> the consumer's CSS convention,
 * chosen by `color.format`:
 *
 *   `rgb-slash-percent`  #rrggbb at full alpha, else `rgb(r g b / P%)`
 *   `hex8`               the export's 8-digit hex, lowercased, verbatim
 */
export const color = (hex8, cfg) => {
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/.exec(hex8);
  if (!m) {
    if (/^#[0-9a-fA-F]{6}$/.test(hex8)) return hex8.toLowerCase();
    fail(`unrecognised COLOR value ${JSON.stringify(hex8)}`);
  }
  const [, rgb, aa] = m;
  if (cfg.color.format === "hex8") return hex8.toLowerCase();
  if (aa.toLowerCase() === "ff") return `#${rgb.toLowerCase()}`;
  const ch = (i) => parseInt(rgb.slice(i, i + 2), 16);
  const pct = num((parseInt(aa, 16) / 255) * 100);
  return `rgb(${ch(0)} ${ch(2)} ${ch(4)} / ${pct}%)`;
};

/**
 * P19 — MOTION. Figma stores a TIMING variable in SECONDS; `motion.timingUnit`
 * states which unit the house publishes. Operator ruling 2026-09-12 row 2 —
 * "should the name reflect the time?" — names the steps by their milliseconds,
 * so the value has to read in the same unit the name states or the token lies
 * about itself (`--duration-375: 0.375s`).
 *
 * The float32 noise is rounded off in SECONDS (`num`'s six decimal places)
 * BEFORE the scale, not after: `0.10000000149011612 * 1000` is
 * `100.00000149011612`, which six decimal places preserve as `100.000001ms`.
 */
export const timing = (raw, cfg) => {
  if (typeof raw !== "number" || !Number.isFinite(raw)) fail(`non-finite TIMING value ${raw}`);
  if (cfg.motion.timingUnit === "s") return `${num(raw)}s`;
  return `${num(Math.round(raw * 1e6) / 1e3)}ms`;
};

const easing = (raw) => {
  const b = raw.easingFunctionCubicBezier;
  if (raw.type === "LINEAR") return "linear";
  if (!b) fail(`EASING without cubic bezier: ${JSON.stringify(raw)}`);
  return `cubic-bezier(${num(b.x1)}, ${num(b.y1)}, ${num(b.x2)}, ${num(b.y2)})`;
};

/**
 * Suffix per `buildUnit`. The export names the unit the build should use; this
 * map is the only place CSS syntax is attached to it. A `buildUnit` this map
 * does not know is a hard failure — silently dropping the unit is exactly the
 * class of bug the per-mode `unitHint` exists to remove.
 */
const BUILD_UNIT_SUFFIX = {
  rem: "rem",
  px: "px",
  em: "em",
  "%": "%",
  unitless: "",
};

/**
 * P13 — CELL TRUST. A `build` cell that contradicts itself does not get to
 * state the value.
 *
 * Two contradictions are detectable from the cell alone, needing no house
 * knowledge and no plausibility judgement about the number itself:
 *
 *   an `identity` that converted  `conversionStrategy: "identity"` means the
 *                                 build value IS the source value, so a
 *                                 `rawValue` differing from `convertedValue` is
 *                                 the cell disagreeing with its own strategy
 *                                 (2156px -> 100, `css: "100vw"`).
 *   a unit the cell did not name  `css` carrying a unit other than the
 *                                 `buildUnit` the same cell published.
 *
 * Both comparisons go through `num()`, so float32 representation noise
 * (`162.39999389648438` stored, `162.399994` converted) is NOT a
 * contradiction — it is one number written twice, and counting it as one would
 * condemn 12 healthy cells in every export of this family.
 *
 * @returns {{ code: string, detail: string }|null} null when the cell is trustworthy
 */
export function cellTrust(hint = {}, build = {}) {
  const { rawValue, convertedValue, sourceUnit, buildUnit, conversionStrategy, source } = hint;
  if (
    conversionStrategy === "identity" &&
    typeof rawValue === "number" &&
    typeof convertedValue === "number" &&
    num(rawValue) !== num(convertedValue)
  ) {
    return {
      code: "BUILD_CELL_CONTRADICTORY",
      detail: `\`conversionStrategy: "identity"\` but rawValue ${num(rawValue)}${sourceUnit ?? ""} != convertedValue ${num(convertedValue)}${buildUnit ?? ""} — the cell publishes \`css: "${build.css}"\`, source \`${source ?? "?"}\``,
    };
  }
  const emitted = String(build.css ?? "").replace(/^[-+.\d\s]+/, "");
  const stated = buildUnit === "unitless" ? "" : String(buildUnit ?? "");
  if (build.status === "resolved" && buildUnit != null && emitted !== stated) {
    return {
      code: "BUILD_CELL_UNIT_MISMATCH",
      detail: `\`css: "${build.css}"\` is in \`${emitted || "no unit"}\` while the same cell publishes \`buildUnit: "${buildUnit}"\``,
    };
  }
  return null;
}

/**
 * Every cell in the export that P13 will not let state its own value — the
 * export-health number the report publishes, and the one a fixed plugin export
 * takes to zero. Scanned over the whole document independently of what is
 * emitted, so an excluded or hand-superseded variable's bad cell still counts.
 *
 * @returns {Array<{ collection: string, name: string, mode: string, code: string,
 *                   detail: string, raw: string|null, converted: string|null }>}
 */
export function untrustedCells(doc) {
  const out = [];
  for (const c of doc.collections) {
    for (const v of c.variables) {
      if (v.type !== "FLOAT") continue;
      for (const m of v.modes) {
        if (m.alias) continue;
        const hint = m.unitHint ?? {};
        const t = cellTrust(hint, m.build ?? {});
        if (!t) continue;
        out.push({
          collection: c.name,
          name: webName(v),
          mode: m.modeName,
          raw: typeof hint.rawValue === "number" ? `${num(hint.rawValue)}${hint.sourceUnit ?? ""}` : null,
          converted: typeof hint.convertedValue === "number" ? `${num(hint.convertedValue)}${hint.buildUnit ?? ""}` : null,
          ...t,
        });
      }
    }
  }
  return out.sort((a, b) => cmp(a.name + a.mode, b.name + b.mode));
}

/** Render an alias chain's terminal value the way the token itself would read. */
const terminalNote = (v, mode, terminal, byId, cfg) => {
  if (v.type === "FLOAT" && mode.build?.status === "resolved") return mode.build.css;
  if (v.type === "COLOR" && typeof terminal === "string") return color(terminal, cfg);
  // P19 — a delay aliasing a duration step (operator ruling row 4) carries the
  // duration's own terminal; render it in the unit the token publishes.
  if (v.type === "TIMING" && typeof terminal === "number") return timing(terminal, cfg);
  // P9: a COMPOSE_COLOR terminal is the expression object, not a hex string —
  // render it the same symbolic way composeColor's own note does rather than
  // stringifying the object. Either COMPOSE_COLOR raw shape qualifies —
  // see `composeColorAliasPair`.
  if (v.type === "COLOR" && terminal && typeof terminal === "object" && composeColorAliasPair(terminal)) {
    return composeColorNote(v, terminal, byId);
  }
  return String(terminal);
};

export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * P9 — COMPOSE_COLOR (schema 7 / handoff 8). `expressionFunction:
 * "COMPOSE_COLOR"` with exactly two `VARIABLE_ALIAS` arguments — arg 1 a
 * `color-primitives` colour, arg 2 a `core` `opacity/opacity-*` FLOAT — is
 * Figma's replacement for the alpha black/white ramp handoff 6 hand-authored.
 * Schema 7 resolves the expression itself: `mode.build.css` is a ready CSS
 * string (relative colour syntax, `rgb(from var(--<colour>) r g b /
 * var(--<opacity>))`) with both arguments still live `var()` references, so
 * `.dark`/theme-mode overrides on either half keep flowing through. Per P4's
 * contract, `composeColor` emits `build.css` VERBATIM — it does not compute a
 * `color-mix()` or any other value of its own; that was the OLD (schema 6)
 * behaviour, superseded now that the export states the answer.
 */
/**
 * Both COMPOSE_COLOR raw shapes this export family has published, normalized
 * to `[colorArg, opacityArg]` — or `null` when `raw` is neither.
 *
 *   wrapped   (schema 7, every export through 2026-09-13):
 *             `{ type: "VARIABLE_EXPRESSION", expressionFunction:
 *             "COMPOSE_COLOR", expressionArguments: [colorArg, opacityArg] }`
 *   bare pair (schema 17, export 2026-09-16 14:05 onward):
 *             `{ color: colorArg, opacity: opacityArg }` — no `type`, no
 *             `expressionFunction` wrapper, same two arguments.
 *
 * The bare-pair shape is Figma's own API changing how it reports this
 * expression, not a new authoring pattern in the file: the same variables
 * (`color/border/action/primary` etc.) carried the wrapped shape in the
 * 2026-09-13 export of the same design system and the bare pair in
 * 2026-09-16's, with identical argument ids. The design-system-handoff
 * plugin's own `isComposeColorExpression` detector (schema 17, `code.ts`)
 * still requires the wrapped shape, so `build.status` for a bare-pair mode
 * reports `"unresolved"` — this generator resolves the expression itself for
 * that shape instead of trusting `build` (see `composeColor` below).
 */
export function composeColorAliasPair(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "VARIABLE_EXPRESSION") {
    const args = raw.expressionArguments;
    if (raw.expressionFunction === "COMPOSE_COLOR" && Array.isArray(args) && args.length === 2) {
      return [args[0], args[1]];
    }
    return null;
  }
  if (raw.type === undefined && "color" in raw && "opacity" in raw) return [raw.color, raw.opacity];
  return null;
}

/**
 * Resolve a COMPOSE_COLOR expression's colour and opacity argument WEB names,
 * for the terminal-value comment (`COMPOSE_COLOR(colour, opacity)`) and as a
 * shape/reachability validation independent of `build`. Shared by
 * `composeColor` (the emitted value) and `composeColorNote` (a terminal
 * comment further down an alias chain) so both fail on the same malformed
 * shape instead of drifting apart.
 *
 * The opacity argument is a `VARIABLE_ALIAS` in every occurrence this export
 * publishes; a bare-number literal (one occurrence in an earlier export of
 * this schema family) is kept as a defensive fallback — nothing proves Figma
 * cannot reintroduce the shape — handled exactly like the aliased case minus the
 * `var()` indirection: `pct: "60%"` inline. Nothing is invented — the
 * export's own number is used verbatim, rounded once by `num()`.
 */
function composeColorArgs(v, raw, byId) {
  const pair = composeColorAliasPair(raw);
  const [colorArg, opacityArg] = pair ?? [];
  if (
    !pair ||
    colorArg?.type !== "VARIABLE_ALIAS" ||
    !(opacityArg?.type === "VARIABLE_ALIAS" || typeof opacityArg === "number")
  ) {
    fail(`${webName(v)}: unrecognised VARIABLE_EXPRESSION shape ${JSON.stringify(raw)}`);
  }
  const colorTarget = byId.get(colorArg.id);
  if (!colorTarget) fail(`${webName(v)}: COMPOSE_COLOR colour argument ${colorArg.id} not in export`);
  if (colorTarget.type !== "COLOR") {
    fail(`${webName(v)}: COMPOSE_COLOR arg 1 (${webName(colorTarget)}) is ${colorTarget.type}, expected COLOR`);
  }
  const colorName = webName(colorTarget);

  if (typeof opacityArg === "number") {
    const pct = `${num(opacityArg)}%`;
    return { colorName, opacityName: null, opacityLiteral: pct, note: `${colorName}, ${pct}` };
  }
  const opacityTarget = byId.get(opacityArg.id);
  if (!opacityTarget) fail(`${webName(v)}: COMPOSE_COLOR opacity argument ${opacityArg.id} not in export`);
  if (opacityTarget.type !== "FLOAT") {
    fail(`${webName(v)}: COMPOSE_COLOR arg 2 (${webName(opacityTarget)}) is ${opacityTarget.type}, expected FLOAT`);
  }
  const opacityName = webName(opacityTarget);
  return { colorName, opacityName, opacityLiteral: null, note: `${colorName}, ${opacityName}` };
}

/**
 * P4/P9 — emit the export's own `build.css` verbatim. `mode.build` for a
 * COMPOSE_COLOR mode carries the same contract as a FLOAT's (`status`, and
 * for "resolved", `css`/`raw`/`literal`): `build.status !== "resolved"` is a
 * hard failure (the export states it is the one who resolves this expression
 * now; an unresolved cell means the export itself could not, and inventing a
 * `color-mix()` in its place would silently re-take a responsibility schema 7
 * moved off the generator), and a `build.raw` that disagrees with `mode.raw`
 * is a hard failure, never a silent pick of one side (mirrors the FLOAT
 * check, P4).
 *
 * The bare-pair raw shape (`composeColorAliasPair`, 2026-09-16 export) is the
 * one exception to "trust `build`": the plugin's own detector for this
 * expression does not recognise that shape yet, so every bare-pair mode's
 * `build.status` reports `"unresolved"` even though both arguments resolve
 * cleanly in this export. Nothing here re-derives a NEW value — it is the
 * exact same `rgb(from var(<color>) r g b / var(<opacity>))` string schema 7
 * has always published for this pair (pinned against the 2026-09-13 export of
 * the same design system in `test/compose-color.test.mjs`), built from the
 * two argument names `composeColorArgs` already resolved and validated.
 */
function composeColor(v, mode, byId) {
  const raw = mode.raw;
  const { colorName, opacityName, opacityLiteral, note } = composeColorArgs(v, raw, byId);
  if (raw.type !== "VARIABLE_EXPRESSION") {
    const opacityTerm = opacityName ? `var(${opacityName})` : opacityLiteral;
    return plain(`rgb(from var(${colorName}) r g b / ${opacityTerm})`, `COMPOSE_COLOR(${note})`);
  }
  const b = mode.build;
  if (!b || !b.status) fail(`${webName(v)} mode ${mode.modeName}: no build cell published for COMPOSE_COLOR`);
  if (b.raw && JSON.stringify(b.raw) !== JSON.stringify(raw)) {
    fail(`${webName(v)} mode ${mode.modeName}: build.raw disagrees with raw for COMPOSE_COLOR`);
  }
  if (b.status !== "resolved") {
    fail(`${webName(v)} mode ${mode.modeName}: COMPOSE_COLOR build.status is "${b.status}", not "resolved"`);
  }
  return plain(b.css, `COMPOSE_COLOR(${note})`);
}

function composeColorNote(v, raw, byId) {
  const { note } = composeColorArgs(v, raw, byId);
  return `COMPOSE_COLOR(${note})`;
}

// --- value resolution ------------------------------------------------------

/**
 * @returns {{ value: string, note: string|null, aliasTarget: string|null,
 *             unresolvedAlias: boolean, terminal: string|null }}
 */
export function resolveValue(v, mode, byId, cfg, collection = null) {
  if (mode.alias) {
    const hop = mode.alias.chain?.[0];
    const terminal = mode.alias.terminalValue ?? null;
    const target = hop ? byId.get(hop.variableId) : undefined;
    if (target) {
      const name = webName(target);
      return {
        value: `var(${name})`,
        note: terminal == null ? null : terminalNote(v, mode, terminal, byId, cfg),
        aliasTarget: name,
        unresolvedAlias: false,
        terminal,
      };
    }
    // Remote / not exported: fall back to the terminal so the token still works.
    if (terminal == null) fail(`${webName(v)}: alias with no resolvable target or terminal`);
    return {
      value:
        v.type === "COLOR"
          ? color(terminal, cfg)
          : v.type === "TIMING" && typeof terminal === "number"
            ? timing(terminal, cfg)
            : String(terminal),
      note: `alias target ${hop?.variableName ?? "?"} not in export — terminal value inlined`,
      aliasTarget: null,
      unresolvedAlias: true,
      terminal,
    };
  }

  const raw = mode.raw;
  switch (v.type) {
    case "COLOR":
      if (raw && typeof raw === "object" && composeColorAliasPair(raw)) {
        return composeColor(v, mode, byId);
      }
      return plain(color(raw, cfg));
    case "STRING":
      // P22 — a STRING variable Figma holds a FONT STYLE NAME in ("Medium") is
      // a font weight, and `font-weight: "Medium"` is not a value CSS accepts.
      // Schema 12 states the number itself on the variable, so the value is
      // the export's own `css` verbatim — nothing here maps a style name to a
      // number, which is precisely the guess that would go wrong on the first
      // family whose "Medium" is not 500.
      if (v.fontWeightNumeric?.css != null) return plain(String(v.fontWeightNumeric.css));
      // P20 — a STRING variable the consumer declared a ratio holder is the
      // design system's aspect-ratio primitive, and `aspect-ratio: "3:2"` is
      // not a value CSS accepts. Every other STRING is quoted, as before.
      if (collection && isRatioVariable(collection, v, cfg)) return plain(ratioValue(v, raw));
      return plain(JSON.stringify(String(raw)));
    case "TIMING":
      return plain(timing(raw, cfg));
    case "EASING":
      return plain(easing(raw));
    case "BOOLEAN":
      return plain(String(raw));
    case "FLOAT": {
      const u = mode.unitHint ?? {};
      const b = mode.build;
      if (!b || !b.status) fail(`${webName(v)} mode ${mode.modeName}: no build cell published`);

      // The emitted value comes from `build`, not from `raw`. If the export
      // ever disagreed with itself the generator would silently ship the stale
      // half, so refuse rather than pick a side.
      if (typeof b.raw === "number" && num(b.raw) !== num(raw)) {
        fail(`${webName(v)} mode ${mode.modeName}: build.raw ${b.raw} disagrees with raw ${raw}`);
      }

      // P13 — an untrusted cell never emits its `css`. Nothing here invents a
      // replacement either: the raw source value the same cell published, in
      // the unit it published it in, is the only value the export actually
      // states about this mode. A stated fraction (a `responsive` field or the
      // description convention) outranks this path and never reaches it — see
      // `responsive.mjs` and P11's precedence.
      const trust = cellTrust(u, b);
      if (trust) {
        if (typeof u.rawValue !== "number") {
          fail(
            `${webName(v)} mode ${mode.modeName}: ${trust.code} and the cell carries no \`rawValue\` to fall back on — ${trust.detail}`,
          );
        }
        return {
          ...plain(
            `${num(u.rawValue)}${BUILD_UNIT_SUFFIX[u.sourceUnit] ?? ""}`,
            `${trust.code}: ${trust.detail}; raw ${u.sourceUnit ?? "value"} emitted`,
          ),
          untrusted: { ...trust, mode: mode.modeName },
        };
      }

      if (b.status === "resolved") {
        const note = u.sourceUnit === "px" && b.unit !== "px" ? `${num(raw)}px` : null;
        return plain(b.css, note);
      }

      // status === "unresolved" — in practice `divide-by-associated-font-size`,
      // which needs a font size the export does not carry for a standalone
      // variable. Emit the raw source value rather than inventing a divisor,
      // and list it as UNCONVERTED.
      return {
        ...plain(
          `${num(raw)}${BUILD_UNIT_SUFFIX[u.sourceUnit] ?? ""}`,
          `UNCONVERTED: ${u.conversionStrategy} -> ${u.buildUnit} needs an associated font size the export does not carry (${b.confidence} confidence); raw ${u.sourceUnit ?? "value"} emitted`,
        ),
        unconverted: {
          strategy: u.conversionStrategy,
          buildUnit: u.buildUnit ?? null,
          confidence: b.confidence ?? "none",
          sourceUnit: u.sourceUnit ?? null,
        },
      };
    }
    default:
      return fail(`unhandled variable type ${v.type} on ${webName(v)}`);
  }
}

const plain = (value, note = null) => ({
  value,
  note,
  aliasTarget: null,
  unresolvedAlias: false,
  terminal: null,
  unconverted: null,
  untrusted: null,
});
