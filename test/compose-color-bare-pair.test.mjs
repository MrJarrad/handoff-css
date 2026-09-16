// P9 — the 2026-09-16 14:05 export (`fixtures/jhd-v17c-2026-09-16`) changed
// COMPOSE_COLOR's on-wire `raw` shape from the wrapped `VARIABLE_EXPRESSION`
// form (`{ type: "VARIABLE_EXPRESSION", expressionFunction: "COMPOSE_COLOR",
// expressionArguments: [colorArg, opacityArg] }`) to a bare alias pair (`{
// color: colorArg, opacity: opacityArg }`, no `type`/`expressionFunction`
// wrapper) — same two VARIABLE_ALIAS arguments, same variables. The
// design-system-handoff plugin's own COMPOSE_COLOR detector does not
// recognise the new shape yet, so every bare-pair mode's `build.status`
// reports `"unresolved"` even though both arguments resolve cleanly.
//
// This is Figma's own API changing shape between exports of the SAME design
// system state family, not a new authoring pattern in the file: v17
// (2026-09-13) carries the wrapped shape for `color/border/action/primary`
// bttf mode with argument ids `VariableID:8:273` / `VariableID:4702:191371`;
// v17c (2026-09-16) carries the bare pair for the SAME variable, SAME mode,
// SAME two argument ids — see the diagnosis note in this file's PR.
//
// generate() must accept both shapes and emit byte-identical CSS for the
// unchanged variables — never a generator-computed color-mix(), never a
// hard failure, and never silently dropping the bare-pair form's build cell
// (which genuinely IS unresolved for other reasons) into the WRONG bucket.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { composeColorAliasPair } from "../src/resolve.mjs";
import { consumerConfig042, consumerCssV13, docV17, docV17c } from "./fixture.mjs";

const emit = (doc) => generate(doc, consumerConfig042, { handAuthoredCss: consumerCssV13() }).tokensCss;

test("v17c's full generate() completes — the bare-pair COMPOSE_COLOR shape is not a hard failure", () => {
  assert.doesNotThrow(() => emit(docV17c()));
});

test("v17's wrapped and v17c's bare-pair raw shapes for the SAME variable/mode carry the SAME two argument ids", () => {
  const findMode = (doc) => {
    for (const c of doc.collections) {
      for (const v of c.variables) {
        if (v.codeSyntax?.WEB?.value !== "--border-action-primary") continue;
        return v.modes.find((m) => m.modeName === "bttf");
      }
    }
  };
  const wrapped = findMode(docV17());
  const barePair = findMode(docV17c());
  assert.equal(wrapped.raw.type, "VARIABLE_EXPRESSION");
  assert.equal(wrapped.raw.expressionFunction, "COMPOSE_COLOR");
  assert.equal(barePair.raw.type, undefined, "fixture drifted — v17c no longer carries the bare-pair shape");
  assert.deepEqual(wrapped.raw.expressionArguments, [barePair.raw.color, barePair.raw.opacity]);
  // The plugin's own detector does not recognise the bare-pair shape: this
  // pins the export-side symptom the generator has to work around.
  assert.equal(barePair.build.status, "unresolved", "fixture drifted — plugin now resolves the bare-pair shape");
});

test("composeColorAliasPair recognises both raw shapes and returns null for anything else", () => {
  assert.deepEqual(
    composeColorAliasPair({
      type: "VARIABLE_EXPRESSION",
      expressionFunction: "COMPOSE_COLOR",
      expressionArguments: ["a", "b"],
    }),
    ["a", "b"],
  );
  assert.deepEqual(composeColorAliasPair({ color: "a", opacity: "b" }), ["a", "b"]);
  assert.equal(composeColorAliasPair({ type: "VARIABLE_ALIAS", id: "x" }), null);
  assert.equal(composeColorAliasPair("#000000FF"), null);
  assert.equal(composeColorAliasPair(null), null);
});

test("a bare-pair COMPOSE_COLOR emits the exact rgb(from …) string the wrapped shape emits for the same arguments", () => {
  const v17Css = emit(docV17());
  const v17cCss = emit(docV17c());
  // --background-action-primary / --border-action-primary both compose
  // --color-palette-lightning-yellow-400 @ --opacity-50 in both exports —
  // v17 via the wrapped shape (bttf mode, resolved build), v17c via the bare
  // pair (bttf mode, "unresolved" build that this generator now resolves
  // itself). Byte-identical CSS proves the two shapes are one behaviour.
  const line = "--border-action-primary: rgb(from var(--color-palette-lightning-yellow-400) r g b / var(--opacity-50)); /* COMPOSE_COLOR(--color-palette-lightning-yellow-400, --opacity-50) */";
  assert.ok(v17Css.includes(line), "v17 (wrapped shape) fixture drifted off the pinned string");
  assert.ok(v17cCss.includes(line), "v17c (bare-pair shape) must emit the identical string");
});

test("a downstream alias of a bare-pair COMPOSE_COLOR token still resolves via var(), with a symbolic (not '[object Object]') terminal comment", () => {
  const css = emit(docV17c());
  assert.match(
    css,
    /--border-action-primary: var\(--background-material-inverse-thinnest\); \/\* COMPOSE_COLOR\(--color-core-black, --opacity-50\) \*\//,
  );
  assert.ok(!css.includes("[object Object]"), "terminal comment must not stringify the bare-pair raw object");
});

test("an unrecognised object raw shape (neither wrapped nor bare-pair) is still a hard failure, never silently inlined", () => {
  const doc = docV17c();
  for (const c of doc.collections) {
    for (const v of c.variables) {
      if (v.codeSyntax?.WEB?.value !== "--border-action-primary") continue;
      const mode = v.modes.find((m) => m.modeName === "bttf");
      mode.raw = { color: { type: "VARIABLE_ALIAS", id: mode.raw.color.id } }; // opacity missing
    }
  }
  assert.throws(() => emit(doc), /unrecognised COLOR value|unrecognised VARIABLE_EXPRESSION shape/);
});
