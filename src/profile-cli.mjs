// `handoff-css profile` — the filesystem boundary around `src/profile.mjs`.
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { buildProfile, renderProfileMarkdown } from "./profile.mjs";
import { assertValidExport } from "./validate-export.mjs";
import { readExports } from "./zip.mjs";

const USAGE = `handoff-css profile --export <json|json.gz|zip> [--out <dir>] [--check]\n`;
export const PROFILE_FILES = { json: "system-profile.json", md: "system-profile.md" };

export async function profileCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  const one = (flag) => {
    const at = args.indexOf(flag);
    return at === -1 || args[at + 1]?.startsWith("--") ? undefined : args[at + 1];
  };
  const exportPath = one("--export");
  if (!exportPath) {
    stderr.write(USAGE);
    return 1;
  }
  const check = args.includes("--check");
  const outDir = abs(one("--out") ?? ".");

  try {
    const file = abs(exportPath);
    const docs = /\.gz$/i.test(file) ? [JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"))] : readExports(file);
    if (docs.length !== 1) throw new Error(`${exportPath}: ${docs.length} exports; profile reads exactly one`);
    assertValidExport(docs[0]);
    const profile = buildProfile(docs[0]);
    const outputs = {
      [PROFILE_FILES.json]: `${JSON.stringify(profile, null, 2)}\n`,
      [PROFILE_FILES.md]: `${renderProfileMarkdown(profile)}`,
    };
    if (check) {
      const drift = Object.entries(outputs).filter(([name, text]) => {
        const f = path.join(outDir, name);
        return !existsSync(f) || readFileSync(f, "utf8") !== text;
      });
      if (drift.length) {
        stderr.write(`handoff-css (profile check): out of date: ${drift.map(([n]) => n).join(", ")}\n`);
        return 1;
      }
      stdout.write("handoff-css (profile check): up to date\n");
      return 0;
    }
    mkdirSync(outDir, { recursive: true });
    for (const [name, text] of Object.entries(outputs)) writeFileSync(path.join(outDir, name), text);
    stdout.write(`handoff-css (profile): wrote ${Object.keys(outputs).join(", ")} to ${outDir}\n`);
    return 0;
  } catch (err) {
    stderr.write(`${err.message}\n`);
    return 1;
  }
}
