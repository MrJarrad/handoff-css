// Value rendering (policies P4, P5, P9) plus the two determinism primitives
// every other module needs: `num` (float32 noise rounded off) and `cmp`.
// See docs/POLICIES.md.
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

/** Render an alias chain's terminal value the way the token itself would read. */
const terminalNote = (v, mode, terminal, byId, cfg) => {
  if (v.type === "FLOAT" && mode.build?.status === "resolved") return mode.build.css;
  if (v.type === "COLOR" && typeof terminal === "string") return color(terminal, cfg);
  // P9: a COMPOSE_COLOR terminal is the expression object, not a hex string —
  // render it the same symbolic way composeColor's own note does rather than
  // stringifying the object.
  if (v.type === "COLOR" && terminal && typeof terminal === "object" && terminal.type === "VARIABLE_EXPRESSION") {
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
  const args = raw.expressionArguments;
  const [colorArg, opacityArg] = args ?? [];
  if (
    raw.expressionFunction !== "COMPOSE_COLOR" ||
    !Array.isArray(args) ||
    args.length !== 2 ||
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
    return { colorName, note: `${colorName}, ${num(opacityArg)}%` };
  }
  const opacityTarget = byId.get(opacityArg.id);
  if (!opacityTarget) fail(`${webName(v)}: COMPOSE_COLOR opacity argument ${opacityArg.id} not in export`);
  if (opacityTarget.type !== "FLOAT") {
    fail(`${webName(v)}: COMPOSE_COLOR arg 2 (${webName(opacityTarget)}) is ${opacityTarget.type}, expected FLOAT`);
  }
  const opacityName = webName(opacityTarget);
  return { colorName, note: `${colorName}, ${opacityName}` };
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
 */
function composeColor(v, mode, byId) {
  const raw = mode.raw;
  const { note } = composeColorArgs(v, raw, byId);
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
export function resolveValue(v, mode, byId, cfg) {
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
      value: v.type === "COLOR" ? color(terminal, cfg) : String(terminal),
      note: `alias target ${hop?.variableName ?? "?"} not in export — terminal value inlined`,
      aliasTarget: null,
      unresolvedAlias: true,
      terminal,
    };
  }

  const raw = mode.raw;
  switch (v.type) {
    case "COLOR":
      if (raw && typeof raw === "object" && raw.type === "VARIABLE_EXPRESSION") {
        return composeColor(v, mode, byId);
      }
      return plain(color(raw, cfg));
    case "STRING":
      return plain(JSON.stringify(String(raw)));
    case "TIMING":
      return plain(`${num(raw)}s`);
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
});
