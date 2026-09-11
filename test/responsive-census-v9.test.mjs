// P15/P11 polish, locked as a failing test. Schema 9's memo (changes.schema[9]
// in the companion doc) claims two things about the export itself, not about
// this package's generator: every variable carrying a `viewport-*`
// responsiveBehavior rule lives under a `device/` path, and every
// `viewportFraction` the export emits is already a whole percent (fractions
// are snapped to the nearest 1% before they reach us). Both are properties of
// a WELL-FORMED export — if a future export regresses either one, this test
// is what catches it, not a silent per-token drift in generated CSS.
import { test } from "node:test";
import assert from "node:assert/strict";

import { docV9 } from "./fixture.mjs";

const VIEWPORT_STRATEGIES = new Set(["viewport-width", "viewport-height"]);
const isWholePercent = (fraction) => Math.abs(fraction * 100 - Math.round(fraction * 100)) < 1e-9;

test("every viewport-* responsiveBehavior rule in v9 is on a device/ variable with a whole-percent fraction", () => {
  const doc = docV9();
  const offenders = { notUnderDevice: [], notWholePercent: [] };

  for (const collection of doc.collections) {
    for (const v of collection.variables) {
      const rules = v.responsiveBehavior?.rules ?? [];
      for (const rule of rules) {
        if (!VIEWPORT_STRATEGIES.has(rule.strategy)) continue;
        if (!v.name.startsWith("device/")) {
          offenders.notUnderDevice.push(`${collection.name}/${v.name}`);
        }
        if (typeof rule.viewportFraction !== "number" || !isWholePercent(rule.viewportFraction)) {
          offenders.notWholePercent.push(`${collection.name}/${v.name} = ${rule.viewportFraction}`);
        }
      }
    }
  }

  assert.deepEqual(offenders.notUnderDevice, [], "viewport-* rule outside device/");
  assert.deepEqual(offenders.notWholePercent, [], "viewportFraction not a whole percent");
});
