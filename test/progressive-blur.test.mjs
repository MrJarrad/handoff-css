// P24 — `bindProgressiveBlur` (`src/emit-styles.mjs`). Every `effect/progressive-blur/N`
// style in the real design-system export states `blurType: "PROGRESSIVE"`, a
// `startRadius` and a start/end offset axis, but the plugin's own `cssClass` builder
// reads only `effects[0].boundVariables.radius` (the effect's terminal/end radius,
// always `blur-0` in this design system) — so every N emitted the identical
// `backdrop-filter: blur(var(--blur-0, 0px))` before this bind. See docs/POLICIES.md P24.
//
// The style objects below are lifted VERBATIM (trimmed to the fields `emitStyles`
// reads) from the real design-system-handoff export banked at
// `~/JHD/vault/main/projects/portfolio/evidence/2026-09-28-navigation-build/` —
// `design/handoff/latest/jhd-spec-designsystem-design-system-handoff.json` on
// jhd-design-system branch `chore/ds-regen-v19-2026-09-28` @ `77aaf57`,
// `generatedAt: "2026-09-27T16:53:59.744Z"`, schema 17 — not a synthetic shape.
import { test } from "node:test";
import assert from "node:assert/strict";

import { emitStyles } from "../src/emit-styles.mjs";

// `effect` collection variables the fixture styles bind to, WEB names verbatim
// from the real export.
const variable = (name, id) => ({ id, name, type: "FLOAT", codeSyntax: { WEB: { value: name } } });
const BLUR_0 = variable("--blur-0", "VariableID:2674:10008");
const BLUR_100 = variable("--blur-100", "VariableID:2674:10009");
const BLUR_300 = variable("--blur-300", "VariableID:5014:26747");
const BLUR_800 = variable("--blur-800", "VariableID:5014:26750");
const byId = new Map([BLUR_0, BLUR_100, BLUR_300, BLUR_800].map((v) => [v.id, v]));

const boundAlias = (id) => ({ type: "VARIABLE_ALIAS", id });

/** `effect/progressive-blur/800` — startRadius 80 (bound to blur-800), end
 * radius 0 (bound to blur-0), axis top -> bottom. The real export's own
 * `cssClass` states the broken flat class this bind replaces. */
const progressiveBlur800 = {
  name: "effect/progressive-blur/800",
  leafName: "800",
  properties: {
    effects: [{
      type: "BACKGROUND_BLUR",
      visible: true,
      radius: 0,
      boundVariables: { radius: boundAlias(BLUR_0.id) },
      blurType: "PROGRESSIVE",
      startRadius: 80,
      startOffset: { x: 0.5, y: 0 },
      endOffset: { x: 0.5, y: 1 },
    }],
    boundVariables: { effects: [boundAlias(BLUR_0.id), boundAlias(BLUR_800.id)] },
  },
  rawStyleProperties: [
    { path: "boundVariables.effects[0]", classification: "variable-bound", variableId: BLUR_0.id },
    { path: "boundVariables.effects[1]", classification: "variable-bound", variableId: BLUR_800.id },
    { path: "effects[0].blurType", classification: "raw", value: "PROGRESSIVE" },
    { path: "effects[0].boundVariables.radius", classification: "variable-bound", variableId: BLUR_0.id },
    { path: "effects[0].endOffset.x", classification: "raw", value: 0.5 },
    { path: "effects[0].endOffset.y", classification: "raw", value: 1 },
    { path: "effects[0].radius", classification: "raw", value: 0 },
    { path: "effects[0].startOffset.x", classification: "raw", value: 0.5 },
    { path: "effects[0].startOffset.y", classification: "raw", value: 0 },
    { path: "effects[0].startRadius", classification: "raw", value: 80 },
    { path: "effects[0].type", classification: "raw", value: "BACKGROUND_BLUR" },
    { path: "effects[0].visible", classification: "raw", value: true },
  ],
  cssClass: {
    selector: ".effect-effect-progressive-blur-800",
    declarations: ["backdrop-filter: blur(var(--blur-0, 0px))"],
  },
};

/** `effect/progressive-blur/0` — start === end === 0, so the export binds only
 * ONE variable (`boundVariables.effects` has a single entry, the same one
 * `effects[0].boundVariables.radius` names) — the degenerate case where start
 * and end share a token. */
const progressiveBlur0 = {
  name: "effect/progressive-blur/0",
  leafName: "0",
  properties: {
    effects: [{
      type: "BACKGROUND_BLUR",
      visible: true,
      radius: 0,
      boundVariables: { radius: boundAlias(BLUR_0.id) },
      blurType: "PROGRESSIVE",
      startRadius: 0,
      startOffset: { x: 0.5, y: 0 },
      endOffset: { x: 0.5, y: 1 },
    }],
    boundVariables: { effects: [boundAlias(BLUR_0.id)] },
  },
  rawStyleProperties: [
    { path: "boundVariables.effects[0]", classification: "variable-bound", variableId: BLUR_0.id },
    { path: "effects[0].blurType", classification: "raw", value: "PROGRESSIVE" },
    { path: "effects[0].boundVariables.radius", classification: "variable-bound", variableId: BLUR_0.id },
    { path: "effects[0].radius", classification: "raw", value: 0 },
    { path: "effects[0].startRadius", classification: "raw", value: 0 },
    { path: "effects[0].type", classification: "raw", value: "BACKGROUND_BLUR" },
    { path: "effects[0].visible", classification: "raw", value: true },
  ],
  cssClass: {
    selector: ".effect-effect-progressive-blur-0",
    declarations: ["backdrop-filter: blur(var(--blur-0, 0px))"],
  },
};

/** `effect/blur/300` — LAYER_BLUR, `blurType: "NORMAL"`, a plain `filter:`
 * declaration. Verbatim from the real export. */
const layerBlur300 = {
  name: "effect/blur/300",
  leafName: "300",
  properties: {
    effects: [{
      type: "LAYER_BLUR",
      visible: true,
      radius: 30,
      boundVariables: { radius: boundAlias(BLUR_300.id) },
      blurType: "NORMAL",
    }],
    boundVariables: { effects: [boundAlias(BLUR_300.id)] },
  },
  rawStyleProperties: [
    { path: "boundVariables.effects[0]", classification: "variable-bound", variableId: BLUR_300.id },
    { path: "effects[0].blurType", classification: "raw", value: "NORMAL" },
    { path: "effects[0].boundVariables.radius", classification: "variable-bound", variableId: BLUR_300.id },
    { path: "effects[0].radius", classification: "raw", value: 30 },
    { path: "effects[0].type", classification: "raw", value: "LAYER_BLUR" },
    { path: "effects[0].visible", classification: "raw", value: true },
  ],
  cssClass: {
    selector: ".effect-effect-blur-300",
    declarations: ["filter: blur(var(--blur-300, 30px))"],
  },
};

/** `effect/material-blur/300` — BACKGROUND_BLUR, `blurType: "NORMAL"` (the
 * uniform material blur, NOT progressive) — the case that proves the guard is
 * `blurType`, not "does this declaration say backdrop-filter". */
const materialBlur300 = {
  name: "effect/material-blur/300",
  leafName: "300",
  properties: {
    effects: [{
      type: "BACKGROUND_BLUR",
      visible: true,
      radius: 30,
      boundVariables: { radius: boundAlias(BLUR_300.id) },
      blurType: "NORMAL",
    }],
    boundVariables: { effects: [boundAlias(BLUR_300.id)] },
  },
  rawStyleProperties: [
    { path: "boundVariables.effects[0]", classification: "variable-bound", variableId: BLUR_300.id },
    { path: "effects[0].blurType", classification: "raw", value: "NORMAL" },
    { path: "effects[0].boundVariables.radius", classification: "variable-bound", variableId: BLUR_300.id },
    { path: "effects[0].radius", classification: "raw", value: 30 },
    { path: "effects[0].type", classification: "raw", value: "BACKGROUND_BLUR" },
    { path: "effects[0].visible", classification: "raw", value: true },
  ],
  cssClass: {
    selector: ".effect-effect-material-blur-300",
    declarations: ["backdrop-filter: blur(var(--blur-300, 30px))"],
  },
};

const cfg = {
  styles: { emit: "utility" },
  paths: { handAuthored: "styles.css" },
  header: { regenerateCommand: "handoff-css" },
};
const run = (styles) => emitStyles(
  {
    styles: { TEXT: [], EFFECT: styles, GRID: [], PAINT: [] },
    documentName: "test fixture",
    schema: "design-system-handoff",
    schemaVersion: 17,
    generatedAt: "2026-09-27T16:53:59.744Z",
    fingerprint: { designSystemStateHash: "test" },
  },
  byId,
  new Map(),
  new Set(),
  cfg,
);

// --- PROGRESSIVE is rebound -------------------------------------------------

test("effect/progressive-blur/800 rebinds to backdrop-filter: blur(<startRadius token>) + a mask-image gradient", () => {
  const out = run([progressiveBlur800]);
  const row = out.rows.find((r) => r.selector === ".effect-effect-progressive-blur-800");
  assert.equal(row.status, "GENERATED");
  assert.deepEqual(row.declarations, [
    "backdrop-filter: blur(var(--blur-800, 80px))",
    "mask-image: linear-gradient(to bottom, black, transparent)",
  ]);
  assert.ok(out.css.includes(
    `@utility effect-effect-progressive-blur-800 {
  backdrop-filter: blur(var(--blur-800, 80px));
  mask-image: linear-gradient(to bottom, black, transparent);
}`,
  ), out.css);
  const finding = out.warnings.find((w) => w.code === "STYLE_CLASS_PROGRESSIVE_BLUR_BOUND");
  assert.ok(finding, "expected a STYLE_CLASS_PROGRESSIVE_BLUR_BOUND finding");
  assert.equal(finding.name, ".effect-effect-progressive-blur-800");
});

test("effect/progressive-blur/0 (start === end === 0) binds start to the SAME token as end — blur(var(--blur-0, 0px))", () => {
  const out = run([progressiveBlur0]);
  const row = out.rows.find((r) => r.selector === ".effect-effect-progressive-blur-0");
  assert.deepEqual(row.declarations, [
    "backdrop-filter: blur(var(--blur-0, 0px))",
    "mask-image: linear-gradient(to bottom, black, transparent)",
  ]);
});

test("a second run over the same input is byte-identical (deterministic)", () => {
  const a = run([progressiveBlur800, progressiveBlur0]);
  const b = run([progressiveBlur800, progressiveBlur0]);
  assert.equal(a.css, b.css);
});

// --- NORMAL (non-progressive) blur is unchanged -----------------------------

test("effect/blur/300 (LAYER_BLUR, blurType NORMAL) is emitted verbatim, byte-identical to the export's own cssClass", () => {
  const out = run([layerBlur300]);
  const row = out.rows.find((r) => r.selector === ".effect-effect-blur-300");
  assert.deepEqual(row.declarations, ["filter: blur(var(--blur-300, 30px))"]);
  assert.ok(!out.warnings.some((w) => w.code.startsWith("STYLE_CLASS_PROGRESSIVE_BLUR")));
});

test("effect/material-blur/300 (BACKGROUND_BLUR, blurType NORMAL — a `backdrop-filter` declaration) is emitted verbatim", () => {
  // The guard the fix depends on: `blurType`, not "the declaration says
  // backdrop-filter" — a uniform material blur also emits backdrop-filter and
  // must NOT be touched.
  const out = run([materialBlur300]);
  const row = out.rows.find((r) => r.selector === ".effect-effect-material-blur-300");
  assert.deepEqual(row.declarations, ["backdrop-filter: blur(var(--blur-300, 30px))"]);
  assert.ok(!out.warnings.some((w) => w.code.startsWith("STYLE_CLASS_PROGRESSIVE_BLUR")));
});

test("normal and progressive blurs side by side — only the PROGRESSIVE ones change", () => {
  const before = run([layerBlur300, materialBlur300]);
  const after = run([layerBlur300, materialBlur300, progressiveBlur800]);
  const normalDecls = (out) => out.rows
    .filter((r) => r.selector !== ".effect-effect-progressive-blur-800")
    .map((r) => r.declarations);
  assert.deepEqual(normalDecls(before), normalDecls(after));
});
