// The Design System Handoff plugin and design-handoff-script save their
// export as a .zip (the JSON contract, its human-readable .md, and for a brief
// any screenshots). This reads one with node:zlib only: the central directory
// lists every entry, and each is stored (method 0) or deflated (method 8).
// ZIP64 and encrypted entries are refused by name rather than misread.
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

import { fail } from "./resolve.mjs";

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/**
 * @param {Buffer} buf  the whole .zip
 * @param {string} [label]  the file's name, for messages
 * @returns {{ name: string, data: Buffer }[]} every file entry, in archive order
 */
export function readZip(buf, label = "zip") {
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i -= 1) {
    if (buf.readUInt32LE(i) === EOCD) { end = i; break; }
  }
  if (end === -1) fail(`${label}: not a zip file (no end of central directory)`);
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  if (count === 0xffff || at === 0xffffffff) fail(`${label}: ZIP64 archives are not read — re-save it as a plain zip`);

  const entries = [];
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(at) !== CENTRAL) fail(`${label}: central directory entry ${n} is damaged`);
    const flags = buf.readUInt16LE(at + 8);
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const skip = nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLen);
    at += 46 + skip;
    if (name.endsWith("/")) continue;
    if (flags & 1) fail(`${label}: ${name} is encrypted`);
    if (buf.readUInt32LE(local) !== LOCAL) fail(`${label}: ${name} has no local header`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (method === 0) entries.push({ name, data: raw });
    else if (method === 8) entries.push({ name, data: inflateRawSync(raw) });
    else fail(`${label}: ${name} uses compression method ${method}; only stored and deflated entries are read`);
  }
  return entries;
}

/**
 * The text files a handoff zip carries (`.json`, `.md`), each named
 * `<zip> › <entry>` so a finding says where it came from.
 */
// A zip saved by macOS Finder carries AppleDouble metadata (`__MACOSX/…`, `._name`): never content.
const appleDouble = (name) => name.startsWith("__MACOSX/") || /(^|\/)\._/.test(name);

export function zipTextFiles(abs, file = abs) {
  return readZip(readFileSync(abs), file)
    .filter((e) => /\.(json|md)$/i.test(e.name) && !appleDouble(e.name))
    .map((e) => ({ file: `${file} › ${e.name}`, abs: `${abs}/${e.name}`, name: e.name, text: e.data.toString("utf8") }));
}

/**
 * Every Design System Handoff export at a path: the file itself, or each
 * export JSON inside a .zip. A zip holding none is an error, never an empty set.
 */
export function readExports(abs) {
  if (!/\.zip$/i.test(abs)) return [JSON.parse(readFileSync(abs, "utf8"))];
  const docs = exportsInZip(abs).map((f) => f.doc);
  if (docs.length === 0) fail(`${abs}: no Design System Handoff export (.json, schema design-system-handoff) in the zip`);
  return docs;
}

/**
 * The Design System Handoff exports inside a zip, each with its entry, parsed. An entry that is
 * not JSON is named, never a bare parse error.
 */
export function exportsInZip(abs, file = abs) {
  return zipTextFiles(abs, file).filter((f) => f.name.endsWith(".json")).map((f) => {
    try {
      return { ...f, doc: JSON.parse(f.text) };
    } catch (err) {
      return fail(`${f.file}: not JSON — ${err.message}`);
    }
  }).filter((f) => f.doc?.schema === "design-system-handoff");
}
