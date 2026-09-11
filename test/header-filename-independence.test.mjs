// P-0.3.4: generated headers print the document name, never the export's
// artifact filename, so a suffixed download (e.g. a browser's "(1)" or a
// deliberate rename) never changes generated output. Two in-memory copies of
// the same export that differ ONLY in `artifactFilename` must produce
// byte-identical `tokensCss`, `themeCss`, `report`, and `exclusionsJson`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { generate } from "../src/index.mjs";
import { consumerConfig, consumerCss, docV9c } from "./fixture.mjs";

const base = docV9c();
const withSuffix = { ...base, artifactFilename: `${base.artifactFilename}-handoff-v6` };
const withoutSuffix = { ...base, artifactFilename: `${base.artifactFilename}-handoff` };

const outA = generate(withSuffix, consumerConfig, { handAuthoredCss: consumerCss() });
const outB = generate(withoutSuffix, consumerConfig, { handAuthoredCss: consumerCss() });

for (const field of ["tokensCss", "themeCss", "report", "exclusionsJson"]) {
  test(`${field} is unaffected by artifactFilename`, () => {
    assert.equal(outA[field], outB[field]);
  });
}
