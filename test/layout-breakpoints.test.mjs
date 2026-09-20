// P6.1 — `layout.breakpoints` is a house MIN-WIDTH THRESHOLD policy layered
// on top of the Figma sample width (lock row 31): a `{ family: px }` map
// overrides the emitted `@media (min-width)` threshold and the matching
// `--breakpoint-<family>` token, keyed by `breakpoints.entries[].family`.
// Unset (the default, `{}`) keeps the Figma sample — every existing fixture
// in this package is generated under `breakpoints: {}` (see
// `PRE_0_9_0_BREAKPOINTS` in `test/fixture.mjs`) and stays byte-identical,
// which is what `test/parity*.test.mjs` already proves. This file is the
// mechanism's own red/green: the override changes the emitted width, and
// Figma's own `device/width` sample is never rewritten.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig042, consumerCssV13, docV17c, preset } from "./fixture.mjs";

const doc = docV17c();

/** `lg`'s family in this fixture: modeId `89:1`, sample `widthPx: 1280`. */
const withBreakpoints = (breakpoints) =>
  generate(doc, { ...consumerConfig042, layout: { ...consumerConfig042.layout, breakpoints } },
    { handAuthoredCss: consumerCssV13() });

test("unset layout.breakpoints keeps the Figma sample width — the @media threshold is unchanged", () => {
  const out = withBreakpoints({});
  assert.match(out.tokensCss, /@media \(min-width: 1280px\)/);
  assert.doesNotMatch(out.tokensCss, /@media \(min-width: 1025px\)/);
  assert.match(out.themeCss, /--breakpoint-lg: 80rem;/);
});

test("a policy override changes the emitted @media threshold and --breakpoint-* token", () => {
  const out = withBreakpoints({ lg: 1025 });
  assert.match(out.tokensCss, /@media \(min-width: 1025px\)/);
  assert.doesNotMatch(out.tokensCss, /@media \(min-width: 1280px\)/);
  assert.match(out.themeCss, /--breakpoint-lg: 64\.0625rem;/); // 1025 / 16
});

test("an override never rewrites the Figma sample width the export states — only unaffected families keep 1280/375/768/1920 verbatim, and the report states both numbers", () => {
  const out = withBreakpoints({ lg: 1025 });
  assert.match(out.report, /\| `lg` \| 1025px \| 1280px \| default \|/);
  assert.match(out.report, /\| `sm` \| 375px \| same \| default \|/);
});

test("a family absent from the map is untouched even when siblings are overridden", () => {
  const out = withBreakpoints({ lg: 1025, xl: 1440 });
  assert.match(out.tokensCss, /@media \(min-width: 375px\)/); // sm, unaffected
  assert.match(out.tokensCss, /@media \(min-width: 768px\)/); // md, unaffected
  assert.match(out.tokensCss, /@media \(min-width: 1025px\)/); // lg, overridden
  assert.match(out.tokensCss, /@media \(min-width: 1440px\)/); // xl, overridden
  assert.doesNotMatch(out.tokensCss, /@media \(min-width: 1920px\)/);
});

test("the shipped jhd preset carries the operator's ruling: md 768 / lg 1025 / xl 1440, sm unset", () => {
  assert.deepEqual(preset.layout.breakpoints, { md: 768, lg: 1025, xl: 1440 });
  const out = generate(doc, preset, { handAuthoredCss: consumerCssV13() });
  assert.match(out.tokensCss, /@media \(min-width: 375px\)/); // sm — untouched, sample
  assert.match(out.tokensCss, /@media \(min-width: 768px\)/); // md — restated at its sample
  assert.match(out.tokensCss, /@media \(min-width: 1025px\)/); // lg — 1280 sample -> 1025 policy
  assert.match(out.tokensCss, /@media \(min-width: 1440px\)/); // xl — 1920 sample -> 1440 policy
  assert.doesNotMatch(out.tokensCss, /@media \(min-width: 1280px\)/);
  assert.doesNotMatch(out.tokensCss, /@media \(min-width: 1920px\)/);
});
