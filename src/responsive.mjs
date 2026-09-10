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

/**
 * Whether this class emits anything other than the per-mode default path.
 * `mode-stepped` and `sample-only` ARE that path, so honouring them is a
 * no-op — which is why an empty `honourClasses` pins pre-0.2.0 output exactly.
 */
export const changesOutput = (cls) =>
  cls === "viewport-width" || cls === "viewport-height" || cls === "fluid-clamp" || cls === "fixed";

/**
 * P13 — the two classes whose whole content is a FRACTION of the screen. The
 * class NAME is not a value: `viewport-width` says "some fraction of the
 * viewport", and only a `responsive.viewport.fraction` or the description
 * convention says which. A rule that names one without a fraction is a hint
 * about intent, and a hint never changes output — see `emit-tokens.mjs`.
 */
export const isViewportClass = (cls) => cls === "viewport-width" || cls === "viewport-height";

/** Is this class allowed to change what is emitted? `responsive.honourClasses`. */
export const honours = (cfg, cls) =>
  cls != null && changesOutput(cls) && cfg.responsive.honourClasses.includes(cls);

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
  return {
    cls: axisClass(axis),
    source: "description",
    value: `${percent}${axisUnit(axis, cfg)}`,
    fraction: Number(percent) / 100,
  };
}

/** `layoutVariant` -> { cls, css, viewportFraction } from the export's own `responsiveBehavior`. */
function ruleClasses(v) {
  const rules = new Map();
  for (const r of v.responsiveBehavior?.rules ?? []) {
    if (!CLASSES.includes(r.strategy)) continue; // a class this version does not know: default path
    const viewportFraction =
      typeof r.viewportFraction === "number" && Number.isFinite(r.viewportFraction) ? r.viewportFraction : null;
    rules.set(r.layoutVariant ?? "default", { cls: r.strategy, css: r.css ?? null, viewportFraction });
  }
  return rules;
}

/**
 * The rule's own `viewportFraction` — the fraction the 2026-09-10 plugin now
 * emits directly on `responsiveBehavior.rules[]` (source of truth: the
 * `device/screen-height/100` "20% of screen height" → `viewportFraction: 0.2`
 * shape). Picked from the `default` variant (or the first rule, same as the
 * export-strategy fallback below), and only honoured when that rule's own
 * `strategy` names a viewport class — a `fixed` rule's stray fraction is not
 * this variable's fraction. A `viewportFraction` of exactly 0 is treated as
 * no signal at all, not "0% of the screen" — a genuinely viewport-relative
 * variable is never zero, so a rule reporting 0 (schema-8 exports do this on
 * mis-tagged non-viewport variables, e.g. a letter-spacing rule the export
 * wrongly strategised as `viewport-width`) is noise the description
 * convention has no wrong value to disagree with either; it stays a hint.
 */
function ruleFraction(rules) {
  const rule = rules.get("default") ?? [...rules.values()][0] ?? null;
  if (rule == null || !isViewportClass(rule.cls) || !rule.viewportFraction) return null;
  return { cls: rule.cls, fraction: rule.viewportFraction };
}

/**
 * Classify one variable.
 *
 * Precedence: an explicit `responsive.viewport.fraction` field, then the
 * description convention, then the export's own `responsiveBehavior[].viewportFraction`
 * (P13, Workstream C's next ask — the 2026-09-10 plugin now emits this), then
 * a bare `responsiveBehavior` strategy with no fraction at all (a hint, never
 * a value — see `emit-tokens.mjs`), then the per-mode default.
 *
 * The description beats a rule's `viewportFraction` deliberately: export 4
 * carried a wrong `screen-height/100` rule fraction (0.222161) alongside a
 * correct "20% of screen height" description. When the two disagree by more
 * than 0.005, the description wins and a `VIEWPORT_FRACTION_DISAGREES`
 * warning names both values — the rule fraction is new and unproven, the
 * description convention stays warning-free on its own.
 *
 * The generator does not second-guess a stated fraction otherwise. A
 * description of "20% of screen width" on a full-bleed variable yields `20vw`
 * — a wrong token from a wrong description, correctable in Figma in one edit,
 * and visible in the report's §10 source column. Inventing a plausibility
 * check here would make the export stop being the contract.
 *
 * @returns {{ cls: string|null, source: "field"|"description"|"rule"|"export"|"default",
 *             value: string|null, rules: Map<string, {cls: string, css: string|null, viewportFraction: number|null}>,
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
  if (isViewport) {
    // P13, disagreement check — only the description path can disagree with
    // the rule's own fraction; an explicit `responsive` field is the
    // operator's deliberate override and is never second-guessed against it.
    let warning = null;
    let fractionDisagree = null;
    if (viewport.source === "description") {
      const rf = ruleFraction(rules);
      if (rf != null && rf.cls === viewport.cls && Math.abs(rf.fraction - viewport.fraction) > 0.005) {
        warning = "VIEWPORT_FRACTION_DISAGREES";
        fractionDisagree = { rule: rf.fraction, description: viewport.fraction };
      }
    }
    return { ...viewport, rules, override: null, warning, fractionDisagree };
  }

  // No field, no description: the export's own `responsiveBehavior[].viewportFraction`
  // (P13, precedence step 3) — a rule that STATES a fraction, not merely names
  // a class.
  const rf = ruleFraction(rules);
  if (rf != null) {
    const axis = rf.cls === "viewport-height" ? "height" : "width";
    return {
      cls: rf.cls,
      source: "rule",
      value: `${num(rf.fraction * 100)}${axisUnit(axis, cfg)}`,
      rules,
      override: null,
      warning: null,
    };
  }

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
