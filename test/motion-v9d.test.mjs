// P19 — MOTION. Operator rulings 2026-09-12 rows 1–4
// (`projects/portfolio/decisions/2026-09-12-motion-token-naming.md`): easings
// are named by curve family, durations are a primitive ramp whose NAME IS ITS
// MILLISECONDS, and delays are their own ramp that aliases the duration steps
// so the two can never drift.
//
// The expected values below are LITERALS, read off the export's own curve and
// timing cells once and written down — never `raw * 1000` recomputed here,
// which would agree with the code by construction whatever the code did.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { resolveValue, timing } from "../src/resolve.mjs";
import { indexById } from "../src/schema.mjs";
import { consumerConfig040, consumerCss, docV9d, preset } from "./fixture.mjs";

const out = generate(docV9d(), consumerConfig040, { handAuthoredCss: consumerCss() });

/** Every declaration in the generated token stylesheet, by name. */
const declarations = (css) => {
  const found = new Map();
  for (const line of css.split("\n")) {
    const m = /^\s*(--[a-z0-9-]+):\s*([^;]+);/.exec(line);
    if (m && !found.has(m[1])) found.set(m[1], m[2].trim());
  }
  return found;
};

const tokens = declarations(out.tokensCss);

// --- durations -------------------------------------------------------------

// Ruling row 2: "should the name reflect the time?" -> yes. This interim export
// still names the steps by INDEX (`duration/300` is 375 ms), which is the
// operator's Figma rename, not the generator's — P1 reads `codeSyntax.WEB`
// verbatim either way. What 0.4.0 owes is the VALUE in milliseconds.
const DURATIONS = [
  ["--duration-0", "0ms"],
  ["--duration-100", "100ms"],
  ["--duration-200", "200ms"],
  ["--duration-300", "375ms"], // ruling row 3 — an in-between step, kept
  ["--duration-400", "400ms"],
  ["--duration-500", "500ms"],
  ["--duration-600", "600ms"],
  ["--duration-700", "750ms"], // ruling row 3 — the other in-between step
  ["--duration-800", "900ms"],
  ["--duration-900", "1000ms"],
  ["--duration-1000", "1200ms"],
];

for (const [name, value] of DURATIONS) {
  test(`${name} is published in milliseconds as ${value}`, () => {
    assert.equal(tokens.get(name), value);
  });
}

// --- delays ----------------------------------------------------------------

const DELAYS = [
  ["--delay-0", "0ms"],
  ["--delay-100", "100ms"],
  ["--delay-200", "375ms"],
  ["--delay-300", "500ms"],
  ["--delay-400", "750ms"],
];

for (const [name, value] of DELAYS) {
  test(`${name} is published in milliseconds as ${value}`, () => {
    assert.equal(tokens.get(name), value);
  });
}

test("every delay step's value is also a published duration step's value (ruling row 4: they may not drift)", () => {
  const durations = new Set(DURATIONS.map(([, v]) => v));
  for (const [name, value] of DELAYS) {
    assert.ok(durations.has(value), `${name} (${value}) is not any duration step's value`);
  }
});

test("not one TIMING token is left in seconds", () => {
  const seconds = [...tokens].filter(([n, v]) => /^--(?:duration|delay)-/.test(n) && /\ds$/.test(v));
  assert.deepEqual(seconds, []);
});

// --- easings ---------------------------------------------------------------

// Ruling row 1: the curve is the token; role names would be an alias layer, never
// a second curve. Values read off `easingFunctionCubicBezier` in the export.
const EASINGS = [
  ["--easing-circ-in-out", "cubic-bezier(0.85, 0, 0.15, 1)"],
  ["--easing-ease-expo-out", "cubic-bezier(0, 0, 0.2, 1)"],
  ["--easing-expo-out", "cubic-bezier(0.2, 1, 0.22, 1)"],
  ["--easing-power2-out", "cubic-bezier(0.215, 0.61, 0.355, 1)"],
];

for (const [name, value] of EASINGS) {
  test(`${name} is published as ${value}`, () => {
    assert.equal(tokens.get(name), value);
  });
}

test("a LINEAR curve resolves to the CSS keyword `linear`, not cubic-bezier(0, 0, 1, 1)", () => {
  // This consumer hand-authors `--easing-linear: cubic-bezier(0, 0, 1, 1)` and
  // says why (styles.css ~955: the keyword is equivalent but not byte-equal, a
  // VALUE-DRIFT row awaiting its own ruling), so P2 suppresses the generated
  // one. The GENERATOR's answer is still the keyword, which is what P19 owes.
  const doc = docV9d();
  const motion = doc.collections.find((c) => c.name === "motion");
  const linear = motion.variables.find((v) => v.name === "easing/linear");
  const r = resolveValue(linear, linear.modes[0], indexById(doc), consumerConfig040);
  assert.equal(r.value, "linear");
  assert.equal(tokens.has("--easing-linear"), false, "P2 — the hand-authored declaration wins");
  assert.equal(out.rows.find((row) => row.name === "--easing-linear").status, "VALUE-DRIFT");
});

test("every easing the export publishes is either emitted or a reported hand-authored row — none is dropped", () => {
  const motion = docV9d().collections.find((c) => c.name === "motion");
  const expected = motion.variables.filter((v) => v.type === "EASING").map((v) => v.codeSyntax.WEB.value).sort();
  const accounted = expected.filter((n) => tokens.has(n) || out.rows.some((r) => r.name === n));
  assert.deepEqual(accounted, expected);
  assert.deepEqual([...tokens.keys()].filter((n) => n.startsWith("--easing-")).sort(),
    expected.filter((n) => n !== "--easing-linear"));
});

// --- the unit itself -------------------------------------------------------

test("timing() renders Figma's stored seconds in the unit the config names", () => {
  assert.equal(timing(0.375, { motion: { timingUnit: "ms" } }), "375ms");
  assert.equal(timing(0.375, { motion: { timingUnit: "s" } }), "0.375s");
});

test("float32 representation noise is rounded off in SECONDS, before the scale", () => {
  // 0.10000000149011612 * 1000 is 100.00000149011612, which six decimal places
  // would preserve as `100.000001ms`.
  assert.equal(timing(0.10000000149011612, { motion: { timingUnit: "ms" } }), "100ms");
  assert.equal(timing(1.2000000476837158, { motion: { timingUnit: "ms" } }), "1200ms");
  assert.equal(timing(0.8999999761581421, { motion: { timingUnit: "ms" } }), "900ms");
});

test("a non-finite TIMING value is a hard failure, not NaNms", () => {
  assert.throws(() => timing(undefined, { motion: { timingUnit: "ms" } }), /non-finite TIMING/);
});

test("the pre-0.4.0 form is still reachable, so a consumer on seconds is not forced to move", () => {
  const secs = generate(docV9d(), { ...consumerConfig040, motion: { timingUnit: "s" } },
    { handAuthoredCss: consumerCss() });
  assert.equal(declarations(secs.tokensCss).get("--duration-300"), "0.375s");
});

test("the shipped house preset publishes milliseconds", () => {
  assert.equal(preset.motion.timingUnit, "ms");
});

// --- a delay that aliases its duration step (ruling row 4) -----------------

/**
 * Figma authors the delay ramp as aliases of the duration ramp. The export
 * carries that as an ordinary alias hop, so nothing in the generator pairs the
 * two by name — which is the point: a name-matching heuristic would silently
 * overwrite the day a delay step legitimately differs.
 */
const withAliasedDelay = ({ resolvable = true } = {}) => {
  const doc = docV9d();
  const motion = doc.collections.find((c) => c.name === "motion");
  const duration = motion.variables.find((v) => v.name === "duration/300"); // 375 ms
  const delay = motion.variables.find((v) => v.name === "delay/200");
  delay.modes[0].alias = {
    rawAlias: { type: "VARIABLE_ALIAS", id: resolvable ? duration.id : "VariableID:0:0" },
    chain: [{ variableId: resolvable ? duration.id : "VariableID:0:0", variableName: "duration/300" }],
    terminalValue: 0.375,
    status: "resolved",
  };
  return doc;
};

test("a delay whose Figma value is an alias of a duration step emits var(--duration-…), not a second copy of the number", () => {
  const aliased = generate(withAliasedDelay(), consumerConfig040, { handAuthoredCss: consumerCss() });
  assert.equal(declarations(aliased.tokensCss).get("--delay-200"), "var(--duration-300)");
});

test("the alias's terminal-value comment reads in milliseconds too, never Figma's raw seconds", () => {
  const doc = withAliasedDelay();
  const motion = doc.collections.find((c) => c.name === "motion");
  const delay = motion.variables.find((v) => v.name === "delay/200");
  const r = resolveValue(delay, delay.modes[0], indexById(doc), consumerConfig040);
  assert.equal(r.value, "var(--duration-300)");
  assert.equal(r.note, "375ms");
});

test("an alias target outside the export inlines its terminal in milliseconds, so the token still works", () => {
  const doc = withAliasedDelay({ resolvable: false });
  const motion = doc.collections.find((c) => c.name === "motion");
  const delay = motion.variables.find((v) => v.name === "delay/200");
  const r = resolveValue(delay, delay.modes[0], indexById(doc), consumerConfig040);
  assert.equal(r.value, "375ms");
  assert.equal(r.unresolvedAlias, true);
});

// --- the Tailwind bridge ---------------------------------------------------

test("the Tailwind bridge still hops onto the motion tokens rather than restating a value (P8)", () => {
  for (const [name, ns] of [["--duration-300", "--transition-duration-300"], ["--delay-200", "--transition-delay-200"],
                            ["--easing-power2-out", "--ease-power2-out"]]) {
    assert.match(out.themeCss, new RegExp(`${ns}: var\\(${name}\\);`), `${ns} must hop onto ${name}`);
  }
});
