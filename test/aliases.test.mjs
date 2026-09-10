// Policy P12 — the alias block. The house names `--screen-height-*` and
// `--height-screen-*` were eighteen hand-authored lines in the consumer's
// `styles.css`; they are now expanded from the emitted token leaves, so a leaf
// added or renamed in Figma cannot silently lose its alias.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { doc as exportDoc, handAuthoredCss, preset } from "./fixture.mjs";

/** `styles.css` minus the eighteen lines the consumer deletes to adopt this. */
const consumerCss = () =>
  handAuthoredCss()
    .split("\n")
    .filter((l) => !/^\s*--(?:screen-height|height-screen)-[a-z0-9]+:/.test(l))
    .join("\n");

const emit = (cfg = preset, css = consumerCss()) =>
  generate(exportDoc(), cfg, { handAuthoredCss: css });

const aliasSection = (css) => {
  const start = css.indexOf("/* --- aliases");
  assert.ok(start > 0, "an aliases block must be emitted");
  return css.slice(start);
};

test("both house patterns expand over the emitted leaves — 16 aliases, in one :root block", () => {
  const out = emit();
  assert.equal(out.aliasRows.length, 16);

  const section = aliasSection(out.tokensCss);
  const lines = section.split("\n").filter((l) => l.trim().startsWith("--"));
  assert.equal(lines.length, 16);
  assert.equal((section.match(/:root \{/g) ?? []).length, 1);

  // The second pattern targets the FIRST pattern's output, so a two-hop house
  // convention stays a pair of one-line config rules.
  assert.match(section, /\n {2}--screen-height-full: var\(--device-screen-height-full\);/);
  assert.match(section, /\n {2}--height-screen-full: var\(--screen-height-full\);/);
  for (const leaf of ["100", "200", "300", "400", "500", "600", "700", "full"]) {
    assert.match(section, new RegExp(`--screen-height-${leaf}: var\\(--device-screen-height-${leaf}\\);`));
    assert.match(section, new RegExp(`--height-screen-${leaf}: var\\(--screen-height-${leaf}\\);`));
  }
});

test("the aliases land after the collections, so every target is already declared", () => {
  const { tokensCss } = emit();
  assert.ok(tokensCss.indexOf("/* --- aliases") > tokensCss.lastIndexOf("/* --- text-primitives"));
});

test("§10 of the report lists every alias with its target and pattern", () => {
  const { report } = emit();
  assert.match(report, /\*\*Aliases \(16\)\*\*/);
  assert.match(report,
    /\| `--height-screen-full` \| `--screen-height-full` \| `--height-screen-\*` \|/);
});

test("an alias colliding with a hand-authored declaration is a hard failure", () => {
  // This is the UNMODIFIED fixture stylesheet: it still hand-authors
  // `--screen-height-100: 20dvh`. Emitting an alias of the same name would
  // leave one of the two declarations silently dead.
  assert.throws(() => emit(preset, handAuthoredCss()),
    /alias `--screen-height-100` \(from `--screen-height-\*`\) collides with a hand-authored declaration in src\/styles\.css/);
});

test("an alias colliding with a generated token is a hard failure", () => {
  const cfg = { ...preset, aliases: { "--device-screen-height-*": "--device-screen-height-*" } };
  assert.throws(() => emit(cfg),
    /alias `--device-screen-height-100` .* collides with a generated token of the same name/);
});

test("two patterns producing one name is a hard failure, not a last-one-wins", () => {
  const cfg = {
    ...preset,
    aliases: {
      "--screen-height-*": "--device-screen-height-*",
      "--screen-height-": "--device-screen-height-*",
    },
  };
  assert.throws(() => emit(cfg), /must end with exactly one `\*`/);
});

test("a pattern that matches nothing is a hard failure — that is the drift this catches", () => {
  const cfg = { ...preset, aliases: { "--screen-height-*": "--device-screen-heght-*" } };
  assert.throws(() => emit(cfg), /alias `--screen-height-\*` matches no emitted token/);
});

test("a pattern with no `*`, or more than one, is refused", () => {
  for (const aliases of [
    { "--screen-height-full": "--device-screen-height-full" },
    { "--screen-*-height-*": "--device-screen-height-*" },
    { "--screen-height-*": "--device-*-height-*" },
    { "--*-height": "--device-screen-height-*" },
  ]) {
    assert.throws(() => emit({ ...preset, aliases }), /must end with exactly one `\*`/);
  }
});

test("no `aliases` config means no alias block, and no change to the stylesheet", () => {
  const cfg = { ...preset, aliases: {} };
  const out = emit(cfg);
  assert.equal(out.aliasRows.length, 0);
  assert.doesNotMatch(out.tokensCss, /--- aliases/);
  assert.match(out.report, /\*\*Aliases \(0\)\*\*/);
});
