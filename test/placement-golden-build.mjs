// Rebuilds fixtures/color-engine/placement-fitted.json.gz from the engine as it stands:
//   node test/placement-golden-build.mjs
// The cases are the JHD design-system export's own ramp colours; the outputs are what nearestStep returns
// with the ends fitToSystem reads from that export. Review the diff of the golden before committing it.
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { nearestStep } from "../src/color-engine/ramp.mjs";
import { fitToSystem } from "../src/color-engine/fit.mjs";
import { buildProfile } from "../src/profile.mjs";
import { colourRamps } from "../src/ramp.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = JSON.parse(gunzipSync(readFileSync(path.join(root, "fixtures", "jhd-v19-2026-10-29", "design-system-handoff.json.gz"))).toString("utf8"));
const ramps = colourRamps(doc, buildProfile(doc));
const fit = fitToSystem(ramps.map((r) => ({ name: r.name, steps: r.steps })));
const ends = { lightMin: fit.lightness.min, lightMax: fit.lightness.max };
const cases = ramps.flatMap((r) => r.steps.map((s) => [s.hex, nearestStep(s.hex, fit.steps, ends)]));
const golden = { source: "fixtures/jhd-v19-2026-10-29/design-system-handoff.json.gz, fitted ends", steps: fit.steps, lightness: fit.lightness, cases };
writeFileSync(path.join(root, "fixtures", "color-engine", "placement-fitted.json.gz"), gzipSync(JSON.stringify(golden)));
console.log(`${cases.length} cases written`);
