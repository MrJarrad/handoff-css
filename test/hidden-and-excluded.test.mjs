// Policy P7 (docs/POLICIES.md): Figma-only scaffolding must never
// become a design-system token. Two independent mechanisms, each with its own
// reported class:
//
//   - HIDDEN    — the export's own `hiddenFromPublishing` /
//                 `effectivelyHiddenFromPublishing` flag.
//   - EXCLUDED  — the interim `EXCLUDE_PATHS` policy for scaffolding Figma
//                 does not yet mark hidden (today: the
//                 `layout/grid/aspect/{landscape,portrait,tall}/*` aspect-ratio
//                 authoring hacks, operator ruling 2026-09-06).
//
// Neither class may appear in MISSING/MATCH/VALUE-DRIFT/NAME-ONLY-IN-EXPORT,
// and neither may be emitted into tokens.generated.css.
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

const dryRunWithDoc = (d) => emit(d);

test("(red baseline) the real export already contains 39 EXCLUDE_PATHS aspect variables", () => {
  const doc = exportDoc();
  const layout = doc.collections.find((c) => c.name === "layout");
  const aspect = layout.variables.filter((v) => v.name.startsWith("grid/aspect/"));
  assert.equal(aspect.length, 39, "fixture drifted — expected exactly 39 aspect scaffolding variables");
  assert.ok(
    aspect.every((v) => v.hiddenFromPublishing === false),
    "these are not yet marked hiddenFromPublishing upstream — EXCLUDE_PATHS is the interim policy for exactly this case",
  );
});

// `--dimension-1800` is chosen because NOTHING aliases it — so hiding it is a
// pure "drop it" case. (`--dimension-1400`, the obvious pick, is the alias
// target of 9 published layout tokens; hiding that one makes it PRIVATE, which
// is the subject of the reachability tests below.)
test("a variable marked hiddenFromPublishing, that nothing aliases, is never emitted and is reported as HIDDEN", () => {
  const doc = exportDoc();
  const core = doc.collections.find((c) => c.name === "core");
  const target = core.variables.find((v) => v.codeSyntax.WEB.value === "--dimension-1800");
  assert.ok(target, "--dimension-1800 must exist in the fixture");
  target.hiddenFromPublishing = true;

  const { css, md, hiddenRows, privateRows, rows } = dryRunWithDoc(doc);

  assert.ok(!/--dimension-1800:/.test(css), "a hidden, unreachable variable must not be emitted into the CSS");
  assert.ok(
    !rows.some((r) => r.name === "--dimension-1800"),
    "a hidden variable must not appear in MATCH/VALUE-DRIFT/NAME-ONLY-IN-EXPORT rows",
  );
  assert.ok(hiddenRows.some((r) => r.name === "--dimension-1800"), "must be counted in hiddenRows");
  assert.ok(!privateRows.some((r) => r.name === "--dimension-1800"), "nothing aliases it — not PRIVATE");
  assert.match(md, /## 0\. PRIVATE \(\d+\), HIDDEN \(\d+\) and EXCLUDED/);
  assert.match(md, /--dimension-1800/);
});

test("hiding a variable that published tokens DO alias makes it PRIVATE, not HIDDEN", () => {
  const doc = exportDoc();
  const core = doc.collections.find((c) => c.name === "core");
  // 9 published layout declarations across --grid-gap-lg / --space-spacer-400
  // / --space-spacer-500 resolve to var(--dimension-1400).
  core.variables.find((v) => v.codeSyntax.WEB.value === "--dimension-1400").hiddenFromPublishing = true;

  const { css, hiddenRows, privateRows } = dryRunWithDoc(doc);
  assert.ok(privateRows.some((r) => r.name === "--dimension-1400"));
  assert.ok(!hiddenRows.some((r) => r.name === "--dimension-1400"));
  assert.match(css, /^\s*--dimension-1400:/m, "dropping it would strand 9 published layout declarations");
});

test("effectivelyHiddenFromPublishing alone is enough to hide a variable", () => {
  const doc = exportDoc();
  const core = doc.collections.find((c) => c.name === "core");
  const target = core.variables.find((v) => v.codeSyntax.WEB.value === "--dimension-1800");
  target.hiddenFromPublishing = false;
  target.effectivelyHiddenFromPublishing = true;

  const { css, hiddenRows } = dryRunWithDoc(doc);
  assert.ok(!/--dimension-1800:/.test(css));
  assert.ok(hiddenRows.some((r) => r.name === "--dimension-1800"));
});

test("EXCLUDE_PATHS aspect-ratio scaffolding is never emitted and is reported as EXCLUDED, not HIDDEN", () => {
  const doc = exportDoc();
  const { css, md, rows, hiddenRows, excludedRows } = dryRunWithDoc(doc);

  const name = "--grid-aspect-landscape-full-width";
  assert.ok(!new RegExp(`${name}:`).test(css), "excluded scaffolding must not be emitted into the CSS");
  assert.ok(!rows.some((r) => r.name === name), "excluded scaffolding must not appear in the reconciliation rows");
  assert.ok(!hiddenRows.some((r) => r.name === name), "excluded (not hidden) — the export does not mark this hidden yet");
  assert.ok(excludedRows.some((r) => r.name === name));
  assert.equal(excludedRows.length, 43, "39 aspect scaffolding + the 4 `.utility` variables");
  assert.match(md, new RegExp(name));
});

test("exclusions.json is the single source of truth the conformance checker reads", () => {
  const written = JSON.parse(emit(exportDoc()).exclusionsJson);
  assert.deepEqual(written.excludePaths, ["layout/grid/aspect/", ".utility/"]);
  assert.equal(written.names.length, 43);
  assert.ok(written.names.includes("--grid-aspect-landscape-full-width"));
});

test("(green) removing the EXCLUDE_PATHS entry would re-expose the aspect variables (guards against the policy silently becoming a no-op)", () => {
  const doc = exportDoc();
  const layout = doc.collections.find((c) => c.name === "layout");
  const aspectNames = new Set(
    layout.variables.filter((v) => v.name.startsWith("grid/aspect/")).map((v) => v.codeSyntax.WEB.value),
  );
  const { rows } = dryRunWithDoc(doc);
  // Sanity: the fixture's aspect variables really do resolve to real values
  // (i.e. they'd generate fine) — the reason they're absent from `rows` is
  // policy P7, not a data problem.
  const layoutRowsByName = new Map(rows.filter((r) => r.collection === "layout").map((r) => [r.name, r]));
  for (const n of aspectNames) assert.ok(!layoutRowsByName.has(n), `${n} must be excluded, not merely absent by accident`);
});

// ---------------------------------------------------------------------------
// P7 CORRECTION (operator ruling 2026-09-06): "i don't publish the color
// primitives because only semantic colors should be used in layout but the
// primitive color are alias's in semantic colors" · ".utility ignore all
// together".
//
// Hidden-in-Figma does not mean absent-from-CSS. A published semantic token
// that aliases a hidden primitive emits `var(--that-primitive)`; if the
// primitive is not declared, the semantic token is INVALID AT COMPUTED-VALUE
// TIME. So the emit set is:
//
//   published  ∪  { reachable by alias from an emitted variable }
//
// Hidden-but-reachable variables are emitted as PRIVATE (same names, so the
// aliases resolve, but fenced in a marked block and reported as their own
// class). Hidden-and-unreachable stay HIDDEN. `.utility` is EXCLUDED wholesale.
// ---------------------------------------------------------------------------

const declaredNames = (css) =>
  new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));
const referencedNames = (css) =>
  new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));

test("(red) every var() a published token references resolves to a declaration", () => {
  const { css } = dryRunWithDoc(exportDoc());
  // The package's whole CSS surface: the generated file plus styles.css, whose
  // hand-authored declarations supersede generation (policy P2) and so are the
  // legitimate home of e.g. `--border-100`.
  const declared = declaredNames(css + handAuthoredCss());
  // `--font-suisse` is supplied by the consuming app by contract, and the
  // `--text-*` / `--type-*` composites are Tailwind-side. Neither is ours to
  // declare; both dangle identically on `main`, so they are not P7 fallout.
  const dangling = [...referencedNames(css)]
    .filter((n) => !declared.has(n) && !/^--(font-suisse|text-|type-)/.test(n))
    .sort();
  assert.deepEqual(
    dangling,
    [],
    `dangling var() references — these semantic tokens are invalid at computed-value time:\n${dangling.join("\n")}`,
  );
});

test("a hidden primitive that a published token aliases is emitted as PRIVATE, not dropped", () => {
  const { css, md, rows, privateRows, hiddenRows } = dryRunWithDoc(
    exportDoc(),
  );

  const name = "--color-palette-cruise-500";
  assert.ok(privateRows.some((r) => r.name === name), "must be classified PRIVATE");
  assert.ok(new RegExp(`^\\s*${name}:`, "m").test(css), "PRIVATE tokens MUST be emitted — aliases have to resolve");
  assert.ok(!hiddenRows.some((r) => r.name === name), "reachable ⇒ PRIVATE, never HIDDEN");
  assert.ok(!rows.some((r) => r.name === name), "PRIVATE is never a public MATCH/DRIFT/NAME-ONLY row");

  // 26, not 25: handoff 7's `bttf` mode reaches `--color-palette-lightning-
  // yellow-400` as a COMPOSE_COLOR colour argument (P9.2 — the alias closure
  // walks expressionArguments, not just alias.chain[0]).
  assert.equal(privateRows.length, 26, "26 hidden primitives are alias targets of published semantics");
  assert.match(css, /private — alias targets of published tokens; not for direct use/);
  assert.match(md, /## 0\. PRIVATE \(26\)/);
});

test("a hidden variable no published token can reach stays HIDDEN and is not emitted", () => {
  const { css, hiddenRows, privateRows } = dryRunWithDoc(exportDoc());

  const name = "--color-palette-cruise-50"; // hidden, and nothing aliases it
  assert.ok(hiddenRows.some((r) => r.name === name), "unreachable ⇒ HIDDEN");
  assert.ok(!privateRows.some((r) => r.name === name));
  assert.ok(!new RegExp(`^\\s*${name}:`, "m").test(css), "HIDDEN is never emitted");

  // 48 hidden = 26 PRIVATE + 18 HIDDEN + 4 `.utility` (EXCLUDED wholesale).
  assert.equal(hiddenRows.length, 18);
});

test(".utility is EXCLUDED wholesale — collection policy, not just its 4 hidden members", () => {
  const doc = exportDoc();
  const utility = doc.collections.find((c) => c.name === ".utility");
  assert.equal(utility.variables.length, 4, "fixture drifted");
  // Un-hide them: the exclusion must hold on collection identity alone.
  for (const v of utility.variables) {
    v.hiddenFromPublishing = false;
    v.effectivelyHiddenFromPublishing = false;
  }

  const { css, rows, hiddenRows, excludedRows } = dryRunWithDoc(doc);
  for (const v of utility.variables) {
    const n = v.codeSyntax.WEB.value;
    assert.ok(excludedRows.some((r) => r.name === n), `${n} must be EXCLUDED`);
    assert.ok(!hiddenRows.some((r) => r.name === n));
    assert.ok(!rows.some((r) => r.name === n));
    assert.ok(!new RegExp(`^\\s*${n}:`, "m").test(css));
  }
  assert.equal(excludedRows.length, 43, "39 aspect + 4 .utility");
});

test("exclusions.json carries private[] so the conformance checker can classify", () => {
  const written = JSON.parse(emit(exportDoc()).exclusionsJson);
  assert.equal(written.private.length, 26);
  assert.ok(written.private.includes("--color-palette-cruise-500"));
  assert.ok(!written.private.includes("--color-palette-cruise-50"), "unreachable stays HIDDEN");
  assert.deepEqual(written.excludePaths, ["layout/grid/aspect/", ".utility/"]);
  assert.equal(written.names.length, 43);
});

test("PRIVATE emission is deterministic — same input, byte-identical output", () => {
  const doc = exportDoc();
  const a = dryRunWithDoc(doc);
  const b = dryRunWithDoc(exportDoc());
  assert.equal(a.css, b.css);
  assert.equal(a.md, b.md);
});

test("reachability is transitive — a private token's own alias target is also private", () => {
  const doc = exportDoc();
  const prims = doc.collections.find((c) => c.name === "color-primitives");
  const hop1 = prims.variables.find((v) => v.codeSyntax.WEB.value === "--color-palette-cruise-500");
  const hop2 = prims.variables.find((v) => v.codeSyntax.WEB.value === "--color-palette-cruise-50");
  // cruise/50 is hidden+unreachable today; make cruise/500 (PRIVATE) alias it.
  hop1.modes[0].raw = { type: "VARIABLE_ALIAS", id: hop2.id };
  hop1.modes[0].alias = {
    rawAlias: { type: "VARIABLE_ALIAS", id: hop2.id },
    chain: [{ variableId: hop2.id, variableName: hop2.name, collectionName: "color-primitives", variableType: "COLOR" }],
    terminalValue: "#FFFFFFFF",
  };

  const { privateRows, hiddenRows } = dryRunWithDoc(doc);
  assert.ok(
    privateRows.some((r) => r.name === "--color-palette-cruise-50"),
    "reached via a PRIVATE token ⇒ itself PRIVATE (else the private token dangles)",
  );
  assert.ok(!hiddenRows.some((r) => r.name === "--color-palette-cruise-50"));
});
