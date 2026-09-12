// P13 — CELL TRUST. A build cell that contradicts itself does not get to state
// the value. The fixture is the real schema-8 export
// (`fixtures/jhd-v8-2026-09-10/export.json`), whose `device/*` cells are
// `conversionStrategy: "identity"` with `rawValue !== convertedValue`: the
// export publishes `css: "100vw"` for a 2156px fixed cap and `css: "100vh"` for
// a 20%-of-screen sample. Nothing here recomputes an expectation from the
// generator's own logic — every number below is read off the fixture
// (`unitHint.rawValue` / `sourceUnit`) or off the variable's own description.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerCss, docV8, preset } from "./fixture.mjs";

const out = generate(docV8(), preset, { handAuthoredCss: consumerCss() });

/** Every declared value of one custom property, in source order. */
const values = (css, name) =>
  [...css.matchAll(new RegExp(`^\\s*${name}: ([^;]+);`, "gm"))].map((m) => m[1]);

const codes = (code) => out.warnings.filter((w) => w.code === code);

test("a contradictory cell never emits its own css — the raw source value stands", () => {
  // The fixture states rawValue 2156, sourceUnit "px" in all ten modes, while
  // every one of its build cells says `css: "100vw"`.
  const declared = values(out.tokensCss, "--device-container-max-width");
  assert.deepEqual([...new Set(declared)], ["2156px"]);
  // `:root` (the base mode also lands unconditionally) plus one per layout mode.
  assert.equal(declared.length, 11);
  assert.ok(!out.tokensCss.includes("--device-container-max-width: 100vw"));
});

test("a stated fraction still wins over the contradictory cell", () => {
  // Read off the fixture's descriptions: "20% of screen height",
  // "70% of screen height", "100% of screen height", "100% of screen width".
  assert.deepEqual(values(out.tokensCss, "--device-screen-height-100"), ["20dvh"]);
  assert.deepEqual(values(out.tokensCss, "--device-screen-height-500"), ["70dvh"]);
  assert.deepEqual(values(out.tokensCss, "--device-screen-height-full"), ["100dvh"]);
  assert.deepEqual(values(out.tokensCss, "--device-width"), ["100vw"]);
});

test("every contradictory cell in the export is counted and named", () => {
  const w = codes("BUILD_CELL_CONTRADICTORY");
  // 100 cells: ten `device/*` variables x ten layout modes. A fixed plugin
  // export takes this number to zero.
  assert.equal(w.length, 100);
  const one = w.find((x) => x.name === "--device-container-max-width");
  assert.ok(one, "the contradictory cells are named by token");
  assert.match(one.detail, /identity/);
  assert.match(one.detail, /2156/); // rawValue
  assert.match(one.detail, /100/); // convertedValue
  assert.ok(one.mode, "each warning names the mode it was found in");
});

test("a viewport class with no stated fraction is a hint, and changes nothing", () => {
  const w = codes("VIEWPORT_CLASS_WITHOUT_FRACTION");
  assert.ok(w.length > 0);
  // `grid/col-span/col-span-1` carries `strategy: "viewport-width"` at the
  // `flush` variant with no description and no `responsive` field.
  assert.ok(w.some((x) => x.name === "--grid-col-span-1"));

  // Held to the same output as a run with no class honoured at all. Isolated
  // to the viewport classes: 0.4.2 honours `fluid-clamp`/`fixed` too, and
  // `--text-title-letter-spacing-100` is a genuinely honoured `fixed` rule
  // there — a real behavioural difference, not the hint this test is about.
  const viewportOnly = generate(docV8(),
    { ...preset, responsive: { honourClasses: ["viewport-height", "viewport-width"] } },
    { handAuthoredCss: consumerCss() });
  const pinned = generate(docV8(), { ...preset, responsive: { honourClasses: [] } },
                          { handAuthoredCss: consumerCss() });
  for (const name of ["--grid-col-span-1", "--text-title-letter-spacing-100"]) {
    assert.deepEqual(values(viewportOnly.tokensCss, name), values(pinned.tokensCss, name));
  }
});

test("the report lists every untrusted cell with its raw/converted pair", () => {
  const section = out.report.slice(
    out.report.indexOf("## 10. Responsive classes"),
    out.report.indexOf("## Appendix A —"),
  );
  assert.match(section, /Untrusted build cells \(100\)/);
  assert.match(section, /`--device-container-max-width`/);
  assert.match(section, /2156/);
});

test("a cell whose css unit disagrees with its buildUnit is untrusted too", () => {
  const doc = docV8();
  const c = doc.collections.find((x) => x.name === "text-primitives");
  const v = c.variables.find((x) => x.name === "size/300");
  assert.ok(v, "fixture carries text-primitives size/300");
  for (const m of v.modes) {
    m.unitHint = { ...m.unitHint, rawValue: 24, sourceUnit: "px", buildUnit: "rem", convertedValue: 1.5, conversionStrategy: "divide-by-root-font-size" };
    m.raw = 24;
    m.build = { status: "resolved", raw: 24, value: 1.5, unit: "px", css: "1.5px", conversionStrategy: "divide-by-root-font-size", confidence: "high", source: "scope" };
  }
  const mutated = generate(doc, preset, { handAuthoredCss: consumerCss() });
  assert.deepEqual([...new Set(values(mutated.tokensCss, "--size-300"))], ["24px"]);
  assert.ok(mutated.warnings.some((w) => w.code === "BUILD_CELL_UNIT_MISMATCH" && w.name === "--size-300"));
});

test("an untrusted cell with no raw source value is a hard failure", () => {
  const doc = docV8();
  const layout = doc.collections.find((c) => c.name === "layout");
  const v = layout.variables.find((x) => x.name === "device/container-max-width");
  // A cell that is untrusted on the unit clause (`css: "100vw"`, `buildUnit:
  // "px"`) and carries no `rawValue` to fall back on: there is no value the
  // export states about this mode, so there is nothing to emit.
  for (const m of v.modes) {
    m.unitHint = { ...m.unitHint, buildUnit: "px", rawValue: undefined, convertedValue: undefined };
    m.build = { ...m.build, unit: "px", css: "100vw" };
  }
  assert.throws(
    () => generate(doc, preset, { handAuthoredCss: consumerCss() }),
    /device-container-max-width.*no `rawValue`|no `rawValue`/s,
  );
});
