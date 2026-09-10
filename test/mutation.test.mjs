// Blast radius, and the failures that must stay hard.
//
// A golden snapshot proves the generator produces what was committed. It does
// NOT prove that a change to the export moves the right line, that a wrong
// value cannot slip through, or that a superseded schema is refused — a broken
// generator with a re-committed snapshot passes a golden test happily. These
// are the properties that catch that:
//
//   1. one changed raw value changes exactly one emitted line
//   2. an export that disagrees with itself stops the run
//   3. a schema version this config was not written against is refused
//   4. only GLOBAL hand-authored declarations suppress emission (P2 scope)
//   5. the base seeds from the narrowest default-variant mode (P6)
//   6. the Tailwind bridge tracks NAMES; only same-name keys track values
//
// Moved here from jhd-design-system, where they were the generator-internal
// half of its golden test. That repo keeps the parts that are about its own
// shipped CSS.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { config, doc as exportDoc, expected, handAuthoredCss, read } from "./fixture.mjs";

const emit = (d) => generate(d, config, { handAuthoredCss: handAuthoredCss() });

const webVar = (d, collection, name) => {
  const c = d.collections.find((x) => x.name === collection);
  assert.ok(c, `fixture drifted — no ${collection} collection`);
  const v = c.variables.find((x) => x.codeSyntax.WEB.value === name);
  assert.ok(v, `fixture drifted — ${name} is not in ${collection}`);
  return v;
};

/** Assert exactly one line moved, and that it moved from `from` to `to`. */
const oneChangedLine = (before, after, from, to) => {
  const a = before.split("\n");
  const b = after.split("\n");
  assert.equal(a.length, b.length, "line count must not change");
  const changed = a.map((l, i) => [l, b[i]]).filter(([x, y]) => x !== y);
  assert.equal(changed.length, 1, `expected 1 changed line, got ${changed.length}`);
  assert.equal(changed[0][0], from);
  assert.equal(changed[0][1], to);
};

test("mutating one raw value in the export changes exactly that one line", () => {
  const doc = exportDoc();
  const target = webVar(doc, "core", "--dimension-1400");

  // Move the value the way a real re-export would: the schema publishes the
  // final build cell alongside the raw, and the generator emits `build.css`
  // rather than re-deriving it (P4).
  const mode = target.modes[0];
  assert.equal(mode.raw, 64);
  assert.equal(mode.build.value, 4);
  mode.raw = 65;
  mode.build.raw = 65;
  mode.build.value = 65 / 16;
  mode.build.css = "4.0625rem";

  oneChangedLine(
    expected("tokens.generated.css"),
    emit(doc).tokensCss,
    "  --dimension-1400: 4rem; /* 64px */",
    "  --dimension-1400: 4.0625rem; /* 65px */",
  );
});

test("the export disagreeing with itself is a hard failure, not a silent pick", () => {
  const doc = exportDoc();
  webVar(doc, "core", "--dimension-1400").modes[0].build.raw = 999; // raw stays 64
  assert.throws(() => emit(doc), /build\.raw 999 disagrees with raw 64/);
});

test("a schemaVersion this config was not written against is rejected", () => {
  const doc = exportDoc();
  doc.schemaVersion = 5;
  assert.throws(() => emit(doc), /unsupported schemaVersion 5/);
});

test("only global hand-authored declarations suppress generation (scope-aware P2)", () => {
  const { tokensCss } = generate(exportDoc(), config, {
    handAuthoredCss: read("scoped-declarations.css"),
  });
  const declared = (name) => new RegExp(`^\\s*${name}\\s*:`, "m").test(tokensCss);

  // Top-level `:root` and `@theme` win everywhere — the generator stands down.
  assert.equal(declared("--dimension-1000"), false, ":root declaration must suppress");
  assert.equal(declared("--dimension-1100"), false, "@theme declaration must suppress");

  // Conditional or scoped declarations only apply sometimes, so they cannot
  // supersede the token globally and must not suppress it.
  assert.equal(declared("--dimension-1200"), true, ".dark declaration must not suppress");
  assert.equal(declared("--dimension-1300"), true, "@media declaration must not suppress");
  assert.equal(declared("--dimension-1400"), true, "@utility declaration must not suppress");
  assert.equal(declared("--dimension-1500"), true, "@supports declaration must not suppress");
});

test("P6: the unconditional base seeds from the narrowest default-variant mode, not the collection default", () => {
  const doc = exportDoc();
  const layout = doc.collections.find((c) => c.name === config.layout.collection);
  const defaultMode = layout.modes.find((m) => m.id === layout.defaultModeId);
  assert.notEqual(
    defaultMode.name,
    "sm",
    "fixture assumption: the collection's own defaultModeId is NOT its narrowest mode — otherwise this test cannot tell the two rules apart",
  );

  const byId = new Map();
  for (const c of doc.collections) for (const v of c.variables) byId.set(v.id, v);
  const padding = webVar(doc, config.layout.collection, "--grid-padding-default");
  const targetName = (modeName) => {
    const mode = padding.modes.find((m) => m.modeName === modeName);
    return byId.get(mode.alias.chain[0].variableId).codeSyntax.WEB.value;
  };
  const narrowTarget = targetName("sm");
  const defaultTarget = targetName(defaultMode.name);
  assert.notEqual(narrowTarget, defaultTarget, "fixture assumption: the two modes alias different dimensions");

  // The unconditional block — the one with no @media wrapper at all — must
  // carry the narrowest mode's alias target. `baseMode: "collection-default"`
  // (the superseded rule) would carry the default's instead. Scope to the
  // layout collection's own section, since `:root` also appears elsewhere.
  const section = emit(doc).tokensCss.split(new RegExp(`\\n/\\* --- ${config.layout.collection} `))[1];
  assert.ok(section, "a layout collection section must exist");
  const rootBlock = section.match(/\n:root \{\n([\s\S]*?)\n\}/);
  assert.ok(rootBlock, "an unconditional :root block must exist in the layout section");
  assert.ok(
    rootBlock[1].includes(`--grid-padding-default: var(${narrowTarget})`),
    `unconditional :root must carry the narrowest mode's alias target (${narrowTarget}), not the collection default's (${defaultTarget})`,
  );
});

test("the Tailwind bridge tracks NAMES; only same-name keys track values", () => {
  // Two properties in one test because they are the same design decision seen
  // from both sides. For an aliased key (colour) the bridge is a pure name map
  // — a value change must not touch it, or it would be duplicating the token
  // file. For a same-name key (radius) the bridge carries the literal on
  // purpose (P8.2), so a value change SHOULD move exactly one line.
  const base = expected("theme.generated.css");

  // (a) aliased key — a colour value change is invisible to the bridge.
  const colourDoc = exportDoc();
  const bg = webVar(colourDoc, "color", "--background-default-primary");
  const bgMode = bg.modes[0];
  if (bgMode.alias) delete bgMode.alias;
  bgMode.raw = "#123456ff";
  assert.equal(emit(colourDoc).themeCss, base, "a colour value change must not touch the name bridge");

  // (b) same-name key — the radius literal moves, and only it.
  const radiusDoc = exportDoc();
  const r600 = webVar(radiusDoc, "core", "--radius-600");
  Object.assign(r600.modes[0], { raw: 9 });
  Object.assign(r600.modes[0].build, { raw: 9, value: 9 / 16, css: "0.5625rem" });
  oneChangedLine(
    base,
    emit(radiusDoc).themeCss,
    "  --radius-600: 0.5rem; /* literal, not var(--radius-600): same-name cycle (P8.2) */",
    "  --radius-600: 0.5625rem; /* literal, not var(--radius-600): same-name cycle (P8.2) */",
  );

  // (c) a WEB-name change moves exactly one line. `--radius-650` is chosen so
  // it sorts into `--radius-600`'s own slot (600 < 650 < 700); a rename that
  // also re-sorts would move two lines for a reason that is not the rename.
  const renameDoc = exportDoc();
  webVar(renameDoc, "core", "--radius-600").codeSyntax.WEB.value = "--radius-650";
  oneChangedLine(
    base,
    emit(renameDoc).themeCss,
    "  --radius-600: 0.5rem; /* literal, not var(--radius-600): same-name cycle (P8.2) */",
    "  --radius-650: 0.5rem; /* literal, not var(--radius-650): same-name cycle (P8.2) */",
  );
});
