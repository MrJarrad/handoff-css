// Policy P9 (docs/POLICIES.md): schema 7 / handoff 8 resolves
// COMPOSE_COLOR expressions itself — every COMPOSE_COLOR mode now carries a
// `build` cell (`build.status: "resolved"`, `build.css` a relative-colour-
// syntax string) exactly like a FLOAT's. Under P4's contract
// (`build.status === "resolved"` -> emit `build.css` verbatim), the generator
// must emit the export's own string as-is and must NOT re-derive a
// `color-mix()` or any other value — that was the OLD (schema 6) behaviour,
// which this branch retargets away from. This test pins the emitted string
// against the real export's own `--background-material-inverse-thinnest`
// (light mode) and red/green-tests the schema-6-shaped hard failure that P9
// now guards: an unresolved compose cell.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { config, doc as exportDoc, handAuthoredCss } from "./fixture.mjs";

// The seam is `generate` — the package's public entry — so these tests exercise
// the code path a consumer runs, with no filesystem in the way. `css` and `md`
// keep the names the assertions below have always used.
const emit = (d) => {
  const out = generate(d, config, { handAuthoredCss: handAuthoredCss() });
  return { ...out, css: out.tokensCss, md: out.report };
};

const dryRun = (d = exportDoc()) => emit(d);

test("the real export contains a RESOLVED COMPOSE_COLOR build cell for --background-material-inverse-thinnest, light mode: black @ opacity-50", () => {
  const doc = exportDoc();
  const color = doc.collections.find((c) => c.name === "color");
  const target = color.variables.find(
    (v) => v.codeSyntax.WEB.value === "--background-material-inverse-thinnest",
  );
  assert.ok(target, "fixture drifted — variable renamed or removed");
  const light = target.modes.find((m) => m.modeName === "light");
  assert.equal(light.raw.type, "VARIABLE_EXPRESSION");
  assert.equal(light.raw.expressionFunction, "COMPOSE_COLOR");
  assert.equal(light.raw.expressionArguments.length, 2);
  assert.equal(light.build.status, "resolved", "schema 7 must publish a resolved build cell");
  assert.equal(
    light.build.css,
    "rgb(from var(--color-core-black) r g b / var(--opacity-50))",
    "fixture drifted — the export's own resolved string changed",
  );
});

test("a COMPOSE_COLOR value emits the export's build.css VERBATIM, not a generator-computed color-mix()", () => {
  const { css } = dryRun();
  // The export's own string — this is the whole point of the retarget: the
  // generator must not re-derive it.
  assert.match(
    css,
    /--background-material-inverse-thinnest: rgb\(from var\(--color-core-black\) r g b \/ var\(--opacity-50\)\);/,
    "expected the export's build.css verbatim, keeping --color-core-black and --opacity-50 live via var()",
  );
  // The OLD (schema 6) generator computed this string itself — asserting its
  // absence pins that the retarget actually happened, not just that some
  // colour-ish string is present.
  assert.ok(
    !css.includes("color-mix(in srgb, var(--color-core-black)"),
    "must not emit a generator-computed color-mix() — schema 7 states the value",
  );
});

test("a downstream alias of a COMPOSE_COLOR token still resolves via var(), and its terminal comment is symbolic (not '[object Object]')", () => {
  const { css } = dryRun();
  assert.match(
    css,
    /--background-input-primary: var\(--background-material-inverse-thinnest\); \/\* COMPOSE_COLOR\(--color-core-black, --opacity-50\) \*\//,
  );
  assert.ok(!css.includes("[object Object]"), "terminal comment must not stringify the raw expression object");
});

test("an UNRESOLVED compose cell is a hard failure, never a silent re-derive", () => {
  const doc = exportDoc();
  const color = doc.collections.find((c) => c.name === "color");
  const target = color.variables.find(
    (v) => v.codeSyntax.WEB.value === "--background-material-inverse-thinnest",
  );
  const light = target.modes.find((m) => m.modeName === "light");
  light.build.status = "unresolved";
  delete light.build.css;

  assert.throws(
    () => dryRun(doc),
    /COMPOSE_COLOR build\.status is "unresolved", not "resolved"/,
    "an unresolved compose cell must hard-fail, not fall back to a generator-computed value",
  );
});

test("a build.raw that disagrees with the mode's own raw is a hard failure, mirroring the FLOAT check", () => {
  const doc = exportDoc();
  const color = doc.collections.find((c) => c.name === "color");
  const target = color.variables.find(
    (v) => v.codeSyntax.WEB.value === "--background-material-inverse-thinnest",
  );
  const light = target.modes.find((m) => m.modeName === "light");
  light.build.raw = { type: "VARIABLE_EXPRESSION", expressionFunction: "COMPOSE_COLOR", expressionArguments: [] };

  assert.throws(() => dryRun(doc), /build\.raw disagrees with raw for COMPOSE_COLOR/);
});
