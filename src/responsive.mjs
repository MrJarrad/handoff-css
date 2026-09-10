// Policy P11 — RESPONSIVE CLASSES. How a dimensional variable becomes CSS:
// once on the base scope in viewport units, once as the export's own `clamp()`,
// once as a single value, or per-mode in `@media` blocks. See docs/POLICIES.md.
//
// This module only CLASSIFIES and FORMATS. Where a declaration lands is
// `modes.mjs`; which declarations exist at all is `emit-tokens.mjs`.
import { fail, num } from "./resolve.mjs";
import { webName } from "./schema.mjs";

/**
 * The six classes. The first two are viewport-relative and are properties of
 * the VARIABLE (a fraction of the screen is not a per-breakpoint fact); the
 * last four are properties of one `layoutVariant` RULE, which is how the
 * export publishes them — `col-span-1` is `mode-stepped` at the default
 * variant and `fluid-clamp` at `flush`.
 */
export const CLASSES = [
  "viewport-width",
  "viewport-height",
  "fluid-clamp",
  "mode-stepped",
  "fixed",
  "sample-only",
];

/** Classes whose handling differs from the per-mode default path. */
const CHANGES_OUTPUT = new Set(["viewport-width", "viewport-height", "fluid-clamp", "fixed"]);

/** Is this class allowed to change what is emitted? `responsive.honourClasses`. */
export const honours = (cfg, cls) =>
  cls != null && CHANGES_OUTPUT.has(cls) && cfg.responsive.honourClasses.includes(cls);

/**
 * The description convention, a FIRST-CLASS input rather than a fallback: it
 * is the only place a Figma designer can currently state "this variable is a
 * fraction of the screen", because Figma variables carry no viewport
 * semantics. Anchored and exact — a description that merely mentions a
 * percentage ("about 20% of screen height on mobile") does not match, and a
 * variable the generator cannot classify is reported, never guessed at.
 */
const DESCRIPTION = /^(\d+(?:\.\d+)?)% of screen (height|width)$/;

const axisClass = (axis) => (axis === "height" ? "viewport-height" : "viewport-width");
const axisUnit = (axis, cfg) => (axis === "height" ? cfg.viewport.heightUnit : cfg.viewport.widthUnit);

/**
 * An explicit `responsive` block on the variable, the preferred signal and the
 * one the 2026-09-10 memo asks the Figma plugin for (plan Workstream C). Not
 * present in any schema-7 export, so this path is exercised by
 * `test/responsive.test.mjs` against a synthetic variable until schema 9 lands.
 *
 * Two shapes are read, because the memo may come back with either:
 *   `{ kind: "viewport", viewport: { axis, fraction } }`  — the memo's ask
 *   `{ kind | strategy: "<one of CLASSES>" }`             — a bare class name
 * Anything else on a `responsive` block is a hard failure: a block the
 * generator half-understands is worse than no block, since the half it skips
 * is silently replaced by the default path.
 */
function fromField(v, cfg) {
  const block = v.responsive;
  if (block == null) return null;
  const stated = block.kind ?? block.strategy;

  if (stated === "viewport") {
    const axis = block.viewport?.axis;
    const fraction = block.viewport?.fraction;
    if (axis !== "height" && axis !== "width") {
      fail(`${webName(v)}: responsive.viewport.axis is ${JSON.stringify(axis)}, expected "height" or "width"`);
    }
    if (typeof fraction !== "number" || !Number.isFinite(fraction)) {
      fail(`${webName(v)}: responsive.viewport.fraction is ${JSON.stringify(fraction)}, expected a number`);
    }
    return { cls: axisClass(axis), source: "field", value: `${num(fraction * 100)}${axisUnit(axis, cfg)}` };
  }

  if (stated === "viewport-height" || stated === "viewport-width") {
    fail(`${webName(v)}: responsive.kind "${stated}" carries no fraction — use { kind: "viewport", viewport: { axis, fraction } }`);
  }
  if (CLASSES.includes(stated)) return { cls: stated, source: "field", value: null };
  fail(`${webName(v)}: unrecognised responsive block ${JSON.stringify(block)}`);
}

/**
 * The description convention. Gated by `viewport.descriptionFallback` so a
 * consumer can pin the pre-0.2.0 output exactly (that is what
 * `test/fixture.mjs`'s pinned config does).
 */
function fromDescription(v, cfg) {
  if (!cfg.viewport.descriptionFallback) return null;
  const m = DESCRIPTION.exec(String(v.description ?? "").trim());
  if (!m) return null;
  const [, percent, axis] = m;
  return { cls: axisClass(axis), source: "description", value: `${percent}${axisUnit(axis, cfg)}` };
}

/** `layoutVariant` -> { cls, css } from the export's own `responsiveBehavior`. */
function ruleClasses(v) {
  const rules = new Map();
  for (const r of v.responsiveBehavior?.rules ?? []) {
    if (!CLASSES.includes(r.strategy)) continue; // a class this version does not know: default path
    rules.set(r.layoutVariant ?? "default", { cls: r.strategy, css: r.css ?? null });
  }
  return rules;
}

/**
 * Classify one variable.
 *
 * Precedence: an explicit `responsive` field, then the description convention,
 * then the export's `responsiveBehavior` strategy, then the per-mode default.
 * The description beats `responsiveBehavior` deliberately — every
 * `device/screen-height/*` variable is `mode-stepped` there (it IS stepped, as
 * four per-breakpoint samples) while its description states the fraction those
 * samples are samples OF. Only the fraction can be emitted as one declaration
 * that holds at every viewport, so the more specific statement wins.
 *
 * The generator does not second-guess a stated fraction. A description of
 * "20% of screen width" on a full-bleed variable yields `20vw` — a wrong token
 * from a wrong description, correctable in Figma in one edit, and visible in
 * the report's §10 source column. Inventing a plausibility check here would
 * make the export stop being the contract.
 *
 * @returns {{ cls: string|null, source: "field"|"description"|"export"|"default",
 *             value: string|null, rules: Map<string, {cls: string, css: string|null}>,
 *             override: string|null, warning: string|null }}
 */
export function classify(v, cfg) {
  const rules = ruleClasses(v);
  const viewport = fromField(v, cfg) ?? fromDescription(v, cfg);
  const isViewport = viewport != null && viewport.cls.startsWith("viewport-");

  if (viewport && !isViewport) {
    // An explicit field naming a non-viewport class states the class for the
    // WHOLE variable, so it applies at every layout variant — `override` — and
    // supersedes the export's own per-variant strategies. Any `css` the export
    // published for a variant is still the value used, since the field names a
    // class and never a value.
    return { ...viewport, rules, override: viewport.cls, warning: null };
  }
  if (isViewport) return { ...viewport, rules, override: null, warning: null };

  const fromExport = rules.get("default") ?? [...rules.values()][0] ?? null;
  const unflagged = (cfg.viewport.groups ?? []).some((g) => String(v.name ?? "").startsWith(g));

  return {
    cls: fromExport?.cls ?? null,
    source: fromExport ? "export" : "default",
    value: null,
    rules,
    override: null,
    // A variable in a group the consumer declared viewport-relative, with
    // neither a field nor a matching description, keeps its px samples — and
    // says so, rather than being quietly guessed into `vw`/`dvh`.
    warning: unflagged ? "VIEWPORT_UNFLAGGED" : null,
  };
}
