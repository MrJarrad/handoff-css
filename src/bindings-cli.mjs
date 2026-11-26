// `handoff-css bindings` — the filesystem boundary around `src/bindings.mjs`.
//   bindings --export <layer export json|json.gz|zip>… --variable <name|--css-name>… [--ds-export <export>] [--out <dir>] [--json]
// With --out: bindings.md, bindings.json, and the frame images found in a zip under frames/.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { assertConfig, sourceOf } from "./config.mjs";
import { bindingMap, renderBindingsMarkdown } from "./bindings.mjs";
import { readZip, zipTextFiles, readExports } from "./zip.mjs";

const USAGE = `handoff-css bindings --export <layer export .json|.json.gz|.zip>… --variable <name|--css-name>… [--ds-export <json|json.gz|zip>] [--out <dir>] [--json] [--config <mjs>]\n`;
const IMAGE = /\.(png|jpe?g|webp)$/i;
const appleDouble = (name) => name.startsWith("__MACOSX/") || /(^|\/)\._/.test(name);
const stem = (name) => path.posix.basename(name).replace(/\.[^.]+$/, "");

const values = (args, flag) => args.flatMap((a, i) => (a === flag && args[i + 1] !== undefined && !(args[i + 1].startsWith("--") && flag !== "--variable") ? [args[i + 1]] : []));

/** The image in a zip for one exported frame: the file named for the screenshot, else one carrying the node id. */
export function frameImage(images, frame) {
  if (!frame.screenshot) return null;
  const ids = [frame.nodeId, frame.nodeId.replace(/:/g, "-"), frame.nodeId.replace(/:/g, "_")];
  return images.find((e) => stem(e.name) === frame.screenshot) ?? images.find((e) => ids.some((id) => stem(e.name).includes(id))) ?? null;
}

export async function bindingsCommand(args, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  const one = (flag) => { const at = args.indexOf(flag); return at === -1 || args[at + 1]?.startsWith("--") ? undefined : args[at + 1]; };
  const exportPaths = values(args, "--export");
  const variables = values(args, "--variable");
  if (!exportPaths.length || !variables.length) {
    stderr.write(USAGE);
    return 1;
  }
  try {
    // `--config` only names the source in the output; it is validated and gated like every other config.
    let source = null;
    if (one("--config")) {
      const config = (await import(pathToFileURL(abs(one("--config"))).href)).default;
      assertConfig(config);
      source = sourceOf(config);
    }
    const docs = [];
    const images = [];
    for (const p of exportPaths) {
      const file = abs(p);
      if (/\.zip$/i.test(file)) {
        const found = zipTextFiles(file, p).filter((f) => f.name.endsWith(".json")).map((f) => JSON.parse(f.text)).filter((d) => d?.schema === "design-handoff");
        if (!found.length) throw new Error(`handoff-css: ${p}: no layer export (.json, schema design-handoff) in the zip`);
        docs.push(...found);
        images.push(...readZip(readFileSync(file), p).filter((e) => IMAGE.test(e.name) && !appleDouble(e.name)));
      } else {
        const doc = JSON.parse(/\.gz$/i.test(file) ? gunzipSync(readFileSync(file)).toString("utf8") : readFileSync(file, "utf8"));
        if (doc?.schema !== "design-handoff") throw new Error(`handoff-css: ${p}: not a layer export (schema ${JSON.stringify(doc?.schema)}, expected "design-handoff")`);
        docs.push(doc);
      }
    }
    const dsPath = one("--ds-export");
    let ds = null;
    if (dsPath) {
      const f = abs(dsPath);
      const dsDocs = /\.gz$/i.test(f) ? [JSON.parse(gunzipSync(readFileSync(f)).toString("utf8"))] : readExports(f);
      if (dsDocs.length !== 1) throw new Error(`handoff-css: ${dsPath}: ${dsDocs.length} exports; bindings reads exactly one`);
      ds = dsDocs[0];
    }
    const map = bindingMap(docs, { variables, ds });
    const outDir = one("--out") ? abs(one("--out")) : null;
    const extracted = new Map();
    const imageFor = (frame) => {
      const hit = frameImage(images, frame);
      if (!hit) return null;
      if (!outDir) return `${frame.name} (image in the zip: ${hit.name}; pass --out to extract it)`;
      const rel = `frames/${path.posix.basename(hit.name)}`;
      extracted.set(rel, hit.data);
      return `[${frame.name}](${rel})`;
    };
    const md = renderBindingsMarkdown(map, { imageFor, exportNames: exportPaths.map((p) => path.basename(p)), source });
    const json = `${JSON.stringify(map, null, 2)}\n`;
    if (outDir) {
      mkdirSync(path.join(outDir, "frames"), { recursive: true });
      writeFileSync(path.join(outDir, "bindings.md"), md);
      writeFileSync(path.join(outDir, "bindings.json"), json);
      for (const [rel, data] of extracted) writeFileSync(path.join(outDir, rel), data);
      const n = map.variables.reduce((s, v) => s + v.consumers.length, 0);
      stdout.write(`handoff-css (bindings): ${map.variables.length} variable(s), ${n} consumer${n === 1 ? "" : "s"}; ${extracted.size} frame image(s); wrote bindings.md, bindings.json to ${outDir}\n`);
    } else stdout.write(args.includes("--json") ? json : md);
    return 0;
  } catch (err) {
    stderr.write(`${err.message}\n`);
    return 1;
  }
}
