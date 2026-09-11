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

/**
 * P15 — the rounding ruling (memo `2026-09-10-handoff-viewport-tokens-brief`,
 * Addendum 2, 2026-09-11): "the export never states a value that was not input
 * into Figma". A DERIVED fraction (value ÷ screen reference) is the one
 * exception, so the consumer rounds it back to the whole percent the designer
 * typed — 244/812 = 0.300493 → `30dvh`, 568/812 → `70dvh`, 731/812 → `90dvh`.
 *
 * The tolerance is RELATIVE to the percent, not absolute on the fraction: every
 * fraction is within 0.005 of SOME whole percent (0.005 is half the gap between
 * two of them), so an absolute reading can never fail and the ruling's "if no
 * whole percent is within 0.005, keep three decimals and flag the variable"
 * would be unreachable. Relative is the only reading under which every number
 * the ruling states lands where it says: 0.300493 rounds (0.16% off 30%),
 * 0.3125 does not (0.8% off 31%).
 */
export const VIEWPORT_FRACTION_TOLERANCE = 0.005;

/**
 * fraction -> the percent to emit. `rounded: false` means no whole percent was
 * within tolerance, so three decimals are kept and the caller raises
 * `VIEWPORT_FRACTION_UNROUNDED` — the generator states the export's own number
 * and says out loud that it did not come from a round input.
 */
export function percentFromFraction(fraction) {
  const percent = fraction * 100;
  const whole = Math.round(percent);
  if (whole >= 1 && Math.abs(percent - whole) <= VIEWPORT_FRACTION_TOLERANCE * percent) {
    return { value: String(whole), rounded: true };
  }
  return { value: num(Math.round(percent * 1000) / 1000), rounded: false };
}

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
    const pct = percentFromFraction(fraction);
    return {
      cls: axisClass(axis),
      source: "field",
      value: `${pct.value}${axisUnit(axis, cfg)}`,
      fraction,
      rounded: pct.rounded,
    };
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
 * The other answer the same rules can give (0.3.1). `ruleFraction` above asks
 * "does the export state a fraction of the screen?"; this asks "does the
 * export state there is NO fraction, because the value is the same at every
 * breakpoint?" — every published rule saying `fixed`, which is the memo's
 * (`2026-09-10-handoff-viewport-tokens-brief`, addendum 1) "`fixed` -> one
 * value".
 *
 * EVERY rule, not the default one: a variable that is `fixed` at the default
 * variant and `fluid-clamp` at `flush` is not one value, and the per-variant
 * path in `emit-tokens.mjs` already handles that correctly. A variable with no
 * rules at all states nothing and is not this.
 */
const allRulesFixed = (rules) =>
  rules.size > 0 && [...rules.values()].every((r) => r.cls === "fixed");

/**
 * Classify one variable.
 *
 * Precedence: an explicit `responsive.viewport.fraction` field, then the
 * description convention, then the export's own `responsiveBehavior[].viewportFraction`
 * (P13, Workstream C's next ask — the 2026-09-10 plugin now emits this), then
 * an all-`fixed` rule set on a declared viewport-group member (0.3.1), then
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
  const { declared, allowed } = viewportGate(v, cfg);
  const stated = fromField(v, cfg) ?? fromDescription(v, cfg);
  const viewport = stated != null && !allowed && isViewportClass(stated.cls) ? null : stated;
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
    // A DERIVED fraction that no whole percent is close to (P15). The
    // description path cannot reach here: a description states the percent, it
    // does not derive it.
    if (viewport.source === "field" && viewport.rounded === false) warning = "VIEWPORT_FRACTION_UNROUNDED";
    if (viewport.source === "description") {
      const rf = ruleFraction(rules);
      if (rf != null && rf.cls === viewport.cls && Math.abs(rf.fraction - viewport.fraction) > VIEWPORT_FRACTION_TOLERANCE) {
        warning = "VIEWPORT_FRACTION_DISAGREES";
        fractionDisagree = { rule: rf.fraction, description: viewport.fraction };
      }
    }
    return { ...viewport, rules, override: null, warning, fractionDisagree };
  }

  // No field, no description: the export's own `responsiveBehavior[].viewportFraction`
  // (P13, precedence step 3) — a rule that STATES a fraction, not merely names
  // a class.
  const rf = allowed ? ruleFraction(rules) : null;
  if (rf != null) {
    const axis = rf.cls === "viewport-height" ? "height" : "width";
    const pct = percentFromFraction(rf.fraction);
    return {
      cls: rf.cls,
      source: "rule",
      value: `${pct.value}${axisUnit(axis, cfg)}`,
      fraction: rf.fraction,
      rules,
      override: null,
      warning: pct.rounded ? null : "VIEWPORT_FRACTION_UNROUNDED",
    };
  }

  // P11's THIRD silencing source — a rule-level `fixed` on a variable the
  // consumer declared viewport-relative. `VIEWPORT_UNFLAGGED` asks "this group
  // is a fraction of the screen; which fraction is this one?", and an export
  // whose every rule states `fixed` has ANSWERED it: none, it is one value at
  // every breakpoint. That is a statement, not silence, so it is honoured and
  // not warned about. `emit-tokens.mjs` still proves the modes agree before
  // collapsing them, and raises `FIXED_VARIES_BY_MODE` when they do not.
  //
  // Gated on `declared`, the same whitelist the warning is gated on: outside
  // every declared group the per-variant `fixed` path is unchanged, because
  // there was no warning to silence there in the first place.
  if (declared && allRulesFixed(rules)) {
    return { cls: "fixed", source: "rule", value: null, allFixed: true, rules, override: null, warning: null };
  }

  const fromExport = rules.get("default") ?? [...rules.values()][0] ?? null;
  const gated = !allowed && (stated != null || ruleFraction(rules) != null);

  return {
    cls: fromExport?.cls ?? null,
    source: fromExport ? "export" : "default",
    value: null,
    rules,
    override: null,
    // Two ways a viewport fraction ends up unused, and both are reported:
    //   VIEWPORT_OUTSIDE_GROUPS  a fraction was STATED for a variable the
    //                            consumer never declared viewport-relative.
    //   VIEWPORT_UNFLAGGED       a variable the consumer DID declare
    //                            viewport-relative stated no fraction.
    // Either way the per-mode px samples are emitted unchanged: the generator
    // never guesses a unit, and never guesses one away silently.
    warning: gated ? "VIEWPORT_OUTSIDE_GROUPS" : declared ? "VIEWPORT_UNFLAGGED" : null,
  };
}

/**
 * P11's gate — may this variable become a viewport unit at all?
 *
 * `viewport.groups` is a WHITELIST, not a warning filter. A `viewportFraction`
 * or a "N% of screen …" description on a variable outside every declared group
 * is a HINT, treated exactly as a bare class is: keep the per-mode samples,
 * report it. The 2026-09-10 schema-8 export states one on ~20 rules that are
 * not fractions of the screen in any design sense — a title letter-spacing, a
 * body font size, an icon radius, a grid column start — and honouring those
 * scales type with the viewport, which no house policy asked for.
 *
 * Two flags, deliberately not one:
 *   `declared` — this variable matches a declared prefix. Drives
 *                `VIEWPORT_UNFLAGGED`: the consumer said this group is
 *                viewport-relative and the export stated no fraction.
 *   `allowed`  — the gate is open for this variable. An EMPTY `groups` list
 *                opts out of the gate entirely (every stated fraction is
 *                honoured, nothing is reported unflagged), which is what a
 *                consumer with no group convention wants.
 */
function viewportGate(v, cfg) {
  const groups = cfg.viewport?.groups ?? [];
  const declared = groups.some((g) => String(v.name ?? "").startsWith(g));
  return { declared, allowed: groups.length === 0 || declared };
}
