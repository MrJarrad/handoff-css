// P19 — MOTION, as the design system authors it from export v11. Operator
// rulings 2026-09-12 rows 1–4 (`2026-09-12-motion-token-naming.md`), whose
// closing paragraph records the ramps as authored:
//
//   "duration/0..2000 in 100 ms steps plus 375 and 750; delay/0..1000 in
//    100 ms steps plus 50, 375, 750; easings as ruled"
//
// The names below are enumerated from that paragraph and the curve values from
// the ruling's row 1 table — a source outside this repo. Nothing here
// recomputes `raw * 1000`, which would agree with the code by construction.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { delayAliasFindings } from "../src/motion.mjs";
import { resolveValue, timing } from "../src/resolve.mjs";
import { indexById } from "../src/schema.mjs";
import { consumerConfig040, consumerCss, consumerCss040, docV10, preset } from "./fixture.mjs";

const out = generate(docV10(), consumerConfig040, { handAuthoredCss: consumerCss() });

// The same run against the stylesheet as it ships AFTER adopting 0.4.0 — see
// `consumerCss040`'s note in `fixture.mjs`. `--duration-1600` is the one motion
// line the adoption deletes: styles.css ~928 calls it "not yet a Figma step",
// and it is one now.
const adopted = generate(docV10(), consumerConfig040, { handAuthoredCss: consumerCss040() });

const declarations = (css) => {
  const found = new Map();
  for (const line of css.split("\n")) {
    const m = /^\s*(--[a-z0-9-]+):\s*([^;]+);/.exec(line);
    if (m && !found.has(m[1])) found.set(m[1], m[2].trim());
  }
  return found;
};

const tokens = declarations(adopted.tokensCss);

// --- the duration ramp -----------------------------------------------------

// "duration/0..2000 in 100 ms steps plus 375 and 750". Ruling row 2 makes the
// NAME the milliseconds, so each expected value is its own name — which is the
// whole point of the rename, and is checkable by reading either one.
const DURATION_MS = [0, 100, 200, 300, 375, 400, 500, 600, 700, 750, 800, 900,
  1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000];

test("the duration ramp is exactly the 23 steps the ruling records — 0-2000 by 100, plus 375 and 750", () => {
  const emitted = [...tokens.keys()].filter((n) => /^--duration-\d+$/.test(n))
    .map((n) => Number(n.slice("--duration-".length))).sort((a, b) => a - b);
  assert.deepEqual(emitted, DURATION_MS);
});

for (const ms of DURATION_MS) {
  test(`--duration-${ms} is ${ms}ms — the name and the value state the same number`, () => {
    assert.equal(tokens.get(`--duration-${ms}`), `${ms}ms`);
  });
}

test("--duration-1600 is now a Figma step, so the consumer's stale 1.6s copy is a VALUE-DRIFT row to delete", () => {
  const before = declarations(out.tokensCss);
  assert.equal(before.has("--duration-1600"), false, "P2 — suppressed while the hand-authored copy stands");
  assert.equal(out.rows.find((r) => r.name === "--duration-1600").status, "VALUE-DRIFT");
  assert.equal(tokens.get("--duration-1600"), "1600ms", "emitted once the copy is deleted");
});

test("--duration-250 stays hand-authored: there is still no duration/250 in Figma to supersede it", () => {
  assert.equal(DURATION_MS.includes(250), false);
  assert.equal(tokens.has("--duration-250"), false);
  assert.equal(out.rows.some((r) => r.name === "--duration-250"), false);
});

// --- the delay ramp --------------------------------------------------------

// "delay/0..1000 in 100 ms steps plus 50, 375, 750".
const DELAY_MS = [0, 50, 100, 200, 300, 375, 400, 500, 600, 700, 750, 800, 900, 1000];

test("the delay ramp is exactly the 14 steps the ruling records — 0-1000 by 100, plus 50, 375 and 750", () => {
  const emitted = [...tokens.keys()].filter((n) => /^--delay-\d+$/.test(n))
    .map((n) => Number(n.slice("--delay-".length))).sort((a, b) => a - b);
  assert.deepEqual(emitted, DELAY_MS);
});

for (const ms of DELAY_MS) {
  test(`--delay-${ms} is ${ms}ms — the name and the value state the same number`, () => {
    assert.equal(tokens.get(`--delay-${ms}`), `${ms}ms`);
  });
}

test("not one TIMING token is left in seconds", () => {
  assert.deepEqual([...tokens].filter(([n, v]) => /^--(?:duration|delay)-/.test(n) && /\ds$/.test(v)), []);
});

// --- delays vs durations: ruling row 4 ------------------------------------

// Row 4: each delay step is "an alias of the matching `motion/duration` step so
// values can never drift". THIS EXPORT DOES NOT AUTHOR THAT — every delay
// carries its own literal — so the generator reports it rather than quietly
// rewriting eleven variables into `var(--duration-…)` on a value match.
test("not one delay step in this export is a Figma alias, though 664 aliases exist elsewhere in it", () => {
  const motion = docV10().collections.find((c) => c.name === "motion");
  const delays = motion.variables.filter((v) => v.name.startsWith("delay/"));
  assert.equal(delays.length, 14);
  assert.equal(delays.some((v) => v.modes.some((m) => m.alias)), false);
  const allAliases = docV10().collections.flatMap((c) => c.variables).flatMap((v) => v.modes).filter((m) => m.alias);
  assert.equal(allAliases.length, 664);
});

test("every delay step holding a duration step's value as its own literal is reported as DELAY_NOT_ALIASED", () => {
  const findings = out.warnings.filter((w) => w.code === "DELAY_NOT_ALIASED");
  // Every delay value except 50 has a duration step of the same value; `50`
  // has no `duration/50` to alias, so it is correctly not a finding.
  assert.deepEqual(findings.map((f) => f.name).sort(),
    DELAY_MS.filter((ms) => ms !== 50).map((ms) => `--delay-${ms}`).sort());
  assert.equal(findings.some((f) => f.name === "--delay-50"), false);
});

test("the finding names the duration step to re-point at, so the fix is one edit in Figma", () => {
  const f = out.warnings.find((w) => w.name === "--delay-375");
  assert.equal(f.code, "DELAY_NOT_ALIASED");
  assert.match(f.detail, /same value as `--duration-375`/);
  assert.match(f.detail, /can never drift/);
  assert.match(f.detail, /does not pair the two itself/);
});

test("the finding changes NO value: a reported delay is still emitted verbatim", () => {
  for (const ms of DELAY_MS) assert.equal(tokens.get(`--delay-${ms}`), `${ms}ms`);
});

test("a delay Figma DOES author as an alias emits var(--duration-…) and raises no finding", () => {
  const doc = docV10();
  const motion = doc.collections.find((c) => c.name === "motion");
  const duration = motion.variables.find((v) => v.name === "duration/375");
  const delay = motion.variables.find((v) => v.name === "delay/375");
  delay.modes[0].alias = {
    rawAlias: { type: "VARIABLE_ALIAS", id: duration.id },
    chain: [{ variableId: duration.id, variableName: "duration/375" }],
    terminalValue: 0.375,
    status: "resolved",
  };
  const aliased = generate(doc, consumerConfig040, { handAuthoredCss: consumerCss() });
  assert.equal(declarations(aliased.tokensCss).get("--delay-375"), "var(--duration-375)");
  assert.equal(aliased.warnings.some((w) => w.name === "--delay-375"), false);
  const r = resolveValue(delay, delay.modes[0], indexById(doc), consumerConfig040, motion);
  assert.equal(r.note, "375ms", "the terminal comment reads in milliseconds too");
});

test("an alias target outside the export inlines its terminal in milliseconds, so the token still works", () => {
  const doc = docV10();
  const motion = doc.collections.find((c) => c.name === "motion");
  const delay = motion.variables.find((v) => v.name === "delay/375");
  delay.modes[0].alias = {
    chain: [{ variableId: "VariableID:0:0", variableName: "duration/375" }],
    terminalValue: 0.375,
  };
  const r = resolveValue(delay, delay.modes[0], indexById(doc), consumerConfig040, motion);
  assert.equal(r.value, "375ms");
  assert.equal(r.unresolvedAlias, true);
});

test("`delayAliasOf: null` switches the check off without touching a value", () => {
  const off = generate(docV10(), { ...consumerConfig040, motion: { timingUnit: "ms", delayAliasOf: null } },
    { handAuthoredCss: consumerCss() });
  assert.equal(off.warnings.some((w) => w.code === "DELAY_NOT_ALIASED"), false);
  assert.equal(declarations(off.tokensCss).get("--delay-375"), "375ms");
});

test("a delay whose value matches no duration step is never reported", () => {
  const doc = docV10();
  const motion = doc.collections.find((c) => c.name === "motion");
  motion.variables.find((v) => v.name === "delay/400").modes[0].raw = 0.425;
  assert.equal(delayAliasFindings(doc, preset).some((f) => f.name === "--delay-400"), false);
});

// --- the easings -----------------------------------------------------------

// Ruling row 1's table, verbatim: quad-out 0.25,0.46,0.45,0.94 · cubic-out
// 0.215,0.61,0.355,1 · quart-out 0.25,1,0.5,1 · expo-out 0.16,1,0.3,1 ·
// ease-out 0,0,0.2,1 · circ-in-out unchanged · linear authored.
const EASINGS = [
  ["--easing-quad-out", "cubic-bezier(0.25, 0.46, 0.45, 0.94)"],
  ["--easing-cubic-out", "cubic-bezier(0.215, 0.61, 0.355, 1)"],
  ["--easing-quart-out", "cubic-bezier(0.25, 1, 0.5, 1)"],
  ["--easing-expo-out", "cubic-bezier(0.16, 1, 0.3, 1)"],
  ["--easing-ease-out", "cubic-bezier(0, 0, 0.2, 1)"],
  ["--easing-circ-in-out", "cubic-bezier(0.85, 0, 0.15, 1)"],
];

for (const [name, value] of EASINGS) {
  test(`${name} is published as ${value}`, () => {
    assert.equal(tokens.get(name), value);
  });
}

test("the easing set is exactly the seven curve families the ruling names — the role names are retired", () => {
  const motion = docV10().collections.find((c) => c.name === "motion");
  assert.deepEqual(motion.variables.filter((v) => v.type === "EASING").map((v) => v.codeSyntax.WEB.value).sort(),
    ["--easing-circ-in-out", "--easing-cubic-out", "--easing-ease-out", "--easing-expo-out",
     "--easing-linear", "--easing-quad-out", "--easing-quart-out"]);
  for (const retired of ["--easing-power2-out", "--easing-ease-expo-out", "--easing-quart-out-flight", "--easing-expo-out-card"]) {
    assert.equal(out.tokensCss.includes(`${retired}:`), false, `${retired} must be gone`);
  }
});

test("--easing-linear is authored as an explicit 0,0,1,1 bezier, which is byte-equal to the hand-authored one", () => {
  // It was a VALUE-DRIFT row while the export published the `linear` keyword
  // (fixtures/jhd-v8b-2026-09-10/styles.css ~960). Authoring the bezier closes
  // that row: P2 suppresses the generated token and the report now says MATCH.
  const motion = docV10().collections.find((c) => c.name === "motion");
  const linear = motion.variables.find((v) => v.name === "easing/linear");
  assert.equal(linear.modes[0].raw.type, "CUSTOM_CUBIC_BEZIER");
  const r = resolveValue(linear, linear.modes[0], indexById(docV10()), consumerConfig040, motion);
  assert.equal(r.value, "cubic-bezier(0, 0, 1, 1)");
  assert.equal(out.rows.find((row) => row.name === "--easing-linear").status, "MATCH");
});

test("all seven curve families reach the stylesheet once the superseded hand-authored copy goes", () => {
  for (const family of ["quad-out", "cubic-out", "quart-out", "expo-out", "ease-out", "circ-in-out", "linear"]) {
    assert.ok(tokens.has(`--easing-${family}`), `--easing-${family} must be declared`);
  }
});

test("a LINEAR-typed curve would still publish the CSS keyword", () => {
  const doc = docV10();
  const motion = doc.collections.find((c) => c.name === "motion");
  const linear = motion.variables.find((v) => v.name === "easing/linear");
  linear.modes[0].raw = { type: "LINEAR", easingFunctionCubicBezier: { x1: 0, y1: 0, x2: 1, y2: 1 } };
  const r = resolveValue(linear, linear.modes[0], indexById(doc), consumerConfig040, motion);
  assert.equal(r.value, "linear");
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
  assert.equal(timing(1.2999999523162842, { motion: { timingUnit: "ms" } }), "1300ms");
  assert.equal(timing(0.05000000074505806, { motion: { timingUnit: "ms" } }), "50ms");
});

test("a non-finite TIMING value is a hard failure, not NaNms", () => {
  assert.throws(() => timing(undefined, { motion: { timingUnit: "ms" } }), /non-finite TIMING/);
});

test("the pre-0.4.0 form is still reachable, so a consumer on seconds is not forced to move", () => {
  const secs = generate(docV10(), { ...consumerConfig040, motion: { timingUnit: "s", delayAliasOf: null } },
    { handAuthoredCss: consumerCss() });
  assert.equal(declarations(secs.tokensCss).get("--duration-375"), "0.375s");
});

test("the shipped house preset publishes milliseconds and names both motion groups", () => {
  assert.equal(preset.motion.timingUnit, "ms");
  assert.deepEqual(preset.motion.delayAliasOf, { delay: "motion/delay/", duration: "motion/duration/" });
});

// --- the Tailwind bridge ---------------------------------------------------

test("the Tailwind bridge still hops onto the motion tokens rather than restating a value (P8)", () => {
  for (const [name, ns] of [["--duration-375", "--transition-duration-375"],
                            ["--delay-750", "--transition-delay-750"],
                            ["--easing-cubic-out", "--ease-cubic-out"]]) {
    assert.match(out.themeCss, new RegExp(`${ns}: var\\(${name}\\);`), `${ns} must hop onto ${name}`);
  }
});
