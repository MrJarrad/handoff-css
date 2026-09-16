// Type ramp policy v3 — `styles.TEXT[].typeRamp.policyVersion` "2" -> "3" adds
// ONE field: `textDecorationDetail`, the underline/strikethrough geometry
// `buildTextDecorationDetail` (design-system-handoff plugin) states beside
// `textDecoration`. The generator makes NO new decision for it: schema 12's
// P21 contract already emits `cssClass.declarations` verbatim, and the
// plugin already folds `textDecorationDetail.build.css` into that array, so
// a v3 style's class is exactly as byte-verbatim as a v2 style's. This file
// is the schema acceptance (a v2 enum used to hard-fail every v3 style) and
// the proof that emission needed no new code.
//
// Style-class emission is exercised through `emitStyles` directly rather
// than the top-level `generate()`: this fixture's `color` collection carries
// an UNRELATED, pre-existing generator gap (a COMPOSE_COLOR variable whose
// `raw` is `{color, opacity}` rather than the `VARIABLE_EXPRESSION` shape
// `resolve.mjs#composeColorArgs` expects — `emitTokens` throws on it before
// a style class is ever reached). That gap is filed separately; it is not
// this ticket's typeRamp/textDecorationDetail change and `emitStyles` never
// touches COLOR/FLOAT token resolution, so it is untouched by it.
//
// See docs/POLICIES.md P21, schema/design-system-handoff.v12plus.schema.json.
import { test } from "node:test";
import assert from "node:assert/strict";

import { emitStyles } from "../src/emit-styles.mjs";
import { readHandAuthored } from "../src/hand-authored.mjs";
import { assertSchema } from "../src/schema.mjs";
import { indexById } from "../src/schema.mjs";
import { validateExport, VALIDATED_SCHEMA_VERSIONS } from "../src/validate-export.mjs";
import { docV17c, preset } from "./fixture.mjs";

const doc = docV17c();
const byId = indexById(doc);
const { classes: handClasses, utilities: handUtilities } = readHandAuthored("");

const emit = (d) => emitStyles(d, indexById(d), handClasses, handUtilities, preset);

test("the fixture is the 2026-09-16 14:05 export at schema 17, type ramp policy v3", () => {
  assert.equal(doc.schema, "design-system-handoff");
  assert.equal(doc.schemaVersion, 17);
  assert.equal(doc.policies.typeRamp.version, "3");
  assert.equal(doc.generatedAt, "2026-09-16T14:05:41.614Z");
});

test("every TEXT style in the export states policyVersion 3", () => {
  const wrong = doc.styles.TEXT.filter((s) => s.typeRamp.policyVersion !== "3");
  assert.deepEqual(wrong.map((s) => s.name), []);
  assert.ok(doc.styles.TEXT.length > 0);
});

test("schema 17 validates the v3 export — policyVersion 3 is no longer a schema error", () => {
  const res = validateExport(doc);
  assert.equal(res.ok, true, JSON.stringify(res.errors ?? []).slice(0, 1200));
  assert.ok(VALIDATED_SCHEMA_VERSIONS.includes(17));
});

test("a v2 export (schema 17, jhd-v17-2026-09-13) still validates — the enum widened, it did not move", async () => {
  const { docV17 } = await import("./fixture.mjs");
  const res = validateExport(docV17());
  assert.equal(res.ok, true, JSON.stringify(res.errors ?? []).slice(0, 800));
});

test("a policyVersion outside {2,3} is still refused", () => {
  const mutated = structuredClone(doc);
  mutated.styles.TEXT[0].typeRamp.policyVersion = "9";
  const res = validateExport(mutated);
  assert.equal(res.ok, false);
});

test("the house preset accepts the v3 export unchanged", () => {
  assert.doesNotThrow(() => assertSchema(doc, preset));
});

test("title-action-style1/200 and body-action-style1/200 carry a resolved textDecorationDetail with underline geometry", () => {
  for (const name of ["title-action-style1/200", "body-action-style1/200"]) {
    const style = doc.styles.TEXT.find((s) => s.name === name);
    assert.ok(style, name);
    const detail = style.typeRamp.textDecorationDetail;
    assert.equal(detail.status, "raw");
    assert.equal(detail.rawFigma, "UNDERLINE");
    assert.equal(detail.build.status, "resolved");
    assert.deepEqual(detail.build.css, {
      "text-decoration-style": "solid",
      "text-decoration-thickness": "0.1em",
      "text-underline-offset": "0.24em",
      "text-decoration-skip-ink": "auto",
      "text-decoration-color": "currentColor",
    });
  }
});

const out = emit(doc);

test("emitStyles reports GENERATED for title-action-style1/200 and body-action-style1/200, with the underline geometry as-published", () => {
  for (const name of ["title-action-style1/200", "body-action-style1/200"]) {
    const row = out.rows.find((r) => r.style === name);
    assert.ok(row, name);
    assert.equal(row.status, "GENERATED");
    for (const decl of [
      "text-decoration: underline",
      "text-decoration-style: solid",
      "text-decoration-thickness: 0.1em",
      "text-underline-offset: 0.24em",
      "text-decoration-skip-ink: auto",
      "text-decoration-color: currentColor",
    ]) {
      assert.ok(row.declarations.includes(decl), `${name}: missing "${decl}" in ${JSON.stringify(row.declarations)}`);
    }
  }
});

test("the generated stylesheet emits title-action-style1/200's underline geometry verbatim, in the export's order", () => {
  assert.match(out.css, /@utility title-action-style1-200 \{[\s\S]*?\}/);
  const emitted = /@utility title-action-style1-200 \{[\s\S]*?\}/.exec(out.css)[0];
  const order = [
    "text-decoration: underline;",
    "text-decoration-style: solid;",
    "text-decoration-thickness: 0.1em;",
    "text-underline-offset: 0.24em;",
    "text-decoration-skip-ink: auto;",
    "text-decoration-color: currentColor;",
  ];
  let cursor = -1;
  for (const decl of order) {
    const at = emitted.indexOf(decl);
    assert.ok(at > cursor, `"${decl}" out of order or missing:\n${emitted}`);
    cursor = at;
  }
});

test("the generated stylesheet emits body-action-style1/200's underline geometry verbatim", () => {
  assert.match(out.css, /@utility body-action-style1-200 \{[\s\S]*?\}/);
  const emitted = /@utility body-action-style1-200 \{[\s\S]*?\}/.exec(out.css)[0];
  for (const decl of [
    "text-decoration: underline;",
    "text-decoration-style: solid;",
    "text-decoration-thickness: 0.1em;",
    "text-underline-offset: 0.24em;",
    "text-decoration-skip-ink: auto;",
    "text-decoration-color: currentColor;",
  ]) {
    assert.ok(emitted.includes(decl), `missing "${decl}":\n${emitted}`);
  }
});

test("a style whose textDecoration is NONE (build.value null) raises no textDecorationDetail warning and adds no extra declaration", () => {
  const style = doc.styles.TEXT.find((s) => s.name === "title-style1/100");
  assert.ok(style);
  assert.equal(style.typeRamp.textDecorationDetail.build.status, "resolved");
  assert.equal(style.typeRamp.textDecorationDetail.build.value, null);
  const row = out.rows.find((r) => r.style === "title-style1/100");
  assert.ok(row);
  assert.equal(row.declarations.some((d) => d.startsWith("text-decoration")), false);
  const badWarning = out.warnings.some((w) => w.name === row.selector && /textDecorationDetail/.test(w.detail ?? ""));
  assert.equal(badWarning, false);
});

test("emitStyles over the v3 export is deterministic (byte-identical CSS on a second run)", () => {
  const again = emit(doc);
  assert.equal(again.css, out.css);
});
