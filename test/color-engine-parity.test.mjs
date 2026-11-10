// The color engine is a port: over a fixed corpus its ramps must match the engine it was ported from,
// string for string. fixtures/color-engine/golden.json.gz holds that engine's outputs (its commit and
// culori version are recorded in the file). Two changes are deliberate and are checked in
// color-engine.test.mjs instead: nearestStep works by step index (the golden holds 100–900 only, where
// index and hundreds agree) and hue drift is measured round the wheel (the golden's naive max − min
// is compared only where it is under 180°, where the two agree).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";

import * as ramp from "../src/color-engine/ramp.mjs";

const golden = JSON.parse(gunzipSync(readFileSync(new URL("../fixtures/color-engine/golden.json.gz", import.meta.url))));
const culori = createRequire(import.meta.url)("culori/package.json");

const run = {
  generateRamp: ([o]) => ramp.generateRamp(o).map((s) => s.hex).join(" "),
  generateRampMulti: ([o]) => ramp.generateRampMulti(o).map((s) => s.hex).join(" "),
  nearestStep: ([hex, steps]) => ramp.nearestStep(hex, steps),
  placementLightness: ([hex]) => ramp.placementLightness(hex),
  defaultDarkHueShift: ([hex]) => ramp.defaultDarkHueShift(hex),
  auditRamp: ([steps]) => {
    const a = ramp.auditRamp(steps);
    return { evenness: a.evenness, hueDrift: a.hueDrift, rows: a.rows.map((r) => [r.step, r.hex, r.oklch.l, r.oklch.c, r.oklch.h, r.deltaL]) };
  },
};

test("golden was recorded with the culori version this package pins", () => {
  assert.equal(golden.source.culori, culori.version);
});

test("every golden case matches the source engine exactly", () => {
  const diffs = [];
  const counts = {};
  for (const c of golden.cases) {
    counts[c.fn] = (counts[c.fn] ?? 0) + 1;
    const got = run[c.fn](c.args);
    if (c.fn === "auditRamp" && c.out.hueDrift > 180) {
      assert.deepEqual({ ...got, hueDrift: 0 }, { ...c.out, hueDrift: 0 });
      continue;
    }
    try {
      assert.deepEqual(got, c.out);
    } catch {
      diffs.push({ fn: c.fn, args: JSON.stringify(c.args).slice(0, 160), want: c.out, got });
    }
  }
  assert.ok(golden.cases.length > 10000, `corpus is ${golden.cases.length} cases`);
  assert.deepEqual(diffs.slice(0, 5), [], `${diffs.length} of ${golden.cases.length} differ`);
  console.log(`# parity: ${golden.cases.length} cases, 0 differ — ${JSON.stringify(counts)}`);
});
