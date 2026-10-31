// HT-40 — MEDIA MATCH. A Design Handoff export (schema v15+) lists every image and
// video fill as `media[]`; it never carries the files. The real files are dropped into
// one folder, each named after its Figma layer. This pairs each file to its entries and
// reports what is missing. Pure: entries and file names in, result out —
// `src/media-cli.mjs` is the filesystem boundary.

/** "Hero Image.jpg" / "hero-image.webp" / "HERO_IMAGE" → "hero-image". */
export const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stem = (file) => file.replace(/\.[^.]*$/, "");

/**
 * Entries that share a layer name are one image reused only when they share a hash;
 * otherwise a file named after that layer cannot say which it is, so the group is
 * ambiguous and is paired to nothing (rename a layer in Figma). Video has no hash, so
 * two videos with one name are always ambiguous.
 *
 * @param {{ media: object[], files: string[] }} input  the export's `media[]` and the dropped file names
 * @returns {{ matched: {entry: object, file: string}[], missing: object[], ambiguous: {layerName: string, entries: object[]}[], extra: string[] }}
 */
export function matchMedia({ media, files }) {
  const bySlug = new Map();
  for (const file of files) if (!bySlug.has(slug(stem(file)))) bySlug.set(slug(stem(file)), file);
  const groups = Map.groupBy(media, (entry) => slug(entry.layerName));
  const matched = [];
  const missing = [];
  const ambiguous = [];
  const used = new Set();
  for (const [key, entries] of groups) {
    const file = bySlug.get(key);
    if (file) used.add(file);
    const oneImage = entries.every((entry) => entry.hash != null && entry.hash === entries[0].hash);
    if (entries.length > 1 && !oneImage) ambiguous.push({ layerName: entries[0].layerName, entries });
    else if (file) matched.push(...entries.map((entry) => ({ entry, file })));
    else missing.push(...entries);
  }
  return { matched, missing, ambiguous, extra: files.filter((file) => !used.has(file)) };
}
