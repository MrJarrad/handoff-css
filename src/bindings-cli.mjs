// `handoff-css bindings` — the filesystem boundary around `src/bindings.mjs`.
//   bindings --export <layer export json|json.gz|zip>… --variable <name|--css-name>… [--ds-export <export>] [--out <dir>] [--json]
// With --out: bindings.md, bindings.json, and the frame images under frames/. An image comes from the brief
// (the .md beside a layer .json, or in the same zip: `![name](data:image/...;base64,...)`) matched by the
// screenshot name the .json lists, or from an image file in a zip.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { assertConfig, sourceOf } from "./config.mjs";
import { bindingMap, renderBindingsMarkdown, label } from "./bindings.mjs";
import { readZip, zipTextFiles, readExports } from "./zip.mjs";

const USAGE = `handoff-css bindings --export <layer export .json|.json.gz|.zip>… --variable <name|--css-name>… [--ds-export <json|json.gz|zip>] [--out <dir>] [--json] [--config <mjs>]\n`;
const IMAGE = /\.(png|jpe?g|webp)$/i;
const appleDouble = (name) => name.startsWith("__MACOSX/") || /(^|\/)\._/.test(name);
const stem = (name) => path.posix.basename(name).replace(/\.[^.]+$/, "");

const DATA_URI = /!\[([^\n]*?)\]\(data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)\)/g;
const MAGIC = { png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], jpeg: [0xff, 0xd8, 0xff], webp: [0x52, 0x49, 0x46, 0x46] };
const safeName = (s) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-._]+|-+$/g, "") || "frame";

/**
 * The images a brief carries, by alt text (the screenshot name). Only bytes that start like the
 * format they claim count, so a placeholder or empty payload is no image; a name carried twice is
 * ambiguous and gives none.
 */
export function briefImages(md) {
  const found = new Map();
  for (const [, alt, ext, b64] of md.matchAll(DATA_URI)) {
    const data = Buffer.from(b64, "base64");
    const ok = MAGIC[ext.toLowerCase()].every((b, i) => data[i] === b);
    found.set(alt, found.has(alt) ? null : ok ? { ext: ext.toLowerCase().replace("jpeg", "jpg"), data } : null);
  }
  return found;
}

const values = (args, flag) => args.flatMap((a, i) => (a === flag && args[i + 1] !== undefined && !(args[i + 1].startsWith("--") && flag !== "--variable") ? [args[i + 1]] : []));

/**
 * The image in a zip for one exported frame: the file named for the screenshot, else one whose
 * name carries the node id as a whole number group (`5527-5397`, not `15527-539712`). Several
 * candidates narrow to the ones beside the frame's own export (`dir`); still more than one is
 * ambiguous and gives none, never a guess.
 */
export function frameImage(images, frame, dir = "") {
  if (!frame.screenshot) return null;
  const only = (list) => {
    if (list.length <= 1) return list[0] ?? null;
    const near = list.filter((e) => path.posix.dirname(e.name) === dir);
    return near.length === 1 ? near[0] : null;
  };
  const named = images.filter((e) => stem(e.name) === frame.screenshot);
  if (named.length) return only(named);
  const ids = [frame.nodeId, frame.nodeId.replace(/:/g, "-"), frame.nodeId.replace(/:/g, "_")].map((id) => new RegExp(`(^|[^0-9])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^0-9])`));
  return only(images.filter((e) => ids.some((re) => re.test(stem(e.name)))));
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
    const dirOf = new Map(); // export label -> the zip folder its JSON sits in
    const briefOf = new Map(); // export label -> the images in the brief beside its JSON
    for (const p of exportPaths) {
      const file = abs(p);
      if (/\.zip$/i.test(file)) {
        const found = [];
        const texts = zipTextFiles(file, p);
        for (const f of texts.filter((e) => e.name.endsWith(".json"))) {
          const d = JSON.parse(f.text);
          if (d?.schema !== "design-handoff") continue;
          found.push(d);
          dirOf.set(label(d), path.posix.dirname(f.name));
          const md = texts.find((e) => e.name === f.name.replace(/\.json$/, ".md"));
          if (md) briefOf.set(label(d), briefImages(md.text));
        }
        if (!found.length) throw new Error(`handoff-css: ${p}: no layer export (.json, schema design-handoff) in the zip`);
        docs.push(...found);
        images.push(...readZip(readFileSync(file), p).filter((e) => IMAGE.test(e.name) && !appleDouble(e.name)));
      } else {
        const doc = JSON.parse(/\.gz$/i.test(file) ? gunzipSync(readFileSync(file)).toString("utf8") : readFileSync(file, "utf8"));
        if (doc?.schema !== "design-handoff") throw new Error(`handoff-css: ${p}: not a layer export (schema ${JSON.stringify(doc?.schema)}, expected "design-handoff")`);
        docs.push(doc);
        // The brief beside the layer export: the same name with .md (or .md.gz) for .json (or .json.gz).
        const stemPath = file.replace(/\.json(\.gz)?$/i, "");
        for (const [ext, read] of [[".md", (f) => readFileSync(f, "utf8")], [".md.gz", (f) => gunzipSync(readFileSync(f)).toString("utf8")]]) {
          if (existsSync(stemPath + ext)) { briefOf.set(label(doc), briefImages(read(stemPath + ext))); break; }
        }
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
    const claimed = new Map(); // zip entry -> where it landed under frames/
    const imageFor = (frame) => {
      // An image file in the zip first (as before), else the brief's own image matched by the name the .json lists.
      const zipHit = frameImage(images, frame, dirOf.get(frame.file));
      const inBrief = zipHit || !frame.screenshot ? null : briefOf.get(frame.file)?.get(frame.screenshot);
      const hit = inBrief ? { key: `${frame.file}\0${frame.screenshot}`, base: `${safeName(frame.screenshot)}.${inBrief.ext}`, data: inBrief.data, from: "the brief" }
        : zipHit ? { key: zipHit.name, base: path.posix.basename(zipHit.name), data: zipHit.data, from: "the zip", flat: zipHit.name } : null;
      if (!hit) return null;
      if (!outDir) return `${frame.name} (image in ${hit.from}${hit.flat ? `: ${hit.flat}` : ""}; pass --out to extract it)`;
      let rel = claimed.get(hit.key);
      if (!rel) {
        // The basename, unless another image already holds it: then a zip entry's whole path, flattened.
        const taken = (r) => [...claimed.values()].includes(r);
        rel = `frames/${hit.base}`;
        if (taken(rel) && hit.flat) rel = `frames/${hit.flat.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "")}`;
        for (let n = 2; taken(rel); n += 1) rel = `frames/${n}-${hit.base}`;
        claimed.set(hit.key, rel);
        extracted.set(rel, hit.data);
      }
      return `[${frame.name}](${rel})`;
    };
    const md = renderBindingsMarkdown(map, { imageFor, exportNames: exportPaths.map((p) => path.basename(p)), source });
    const json = `${JSON.stringify(map, null, 2)}\n`;
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      if (extracted.size) mkdirSync(path.join(outDir, "frames"), { recursive: true });
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
