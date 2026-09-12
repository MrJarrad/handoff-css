// Schema 12's `cssCustomPropertySheets` — the export's own `:root` / theme
// blocks, one per collection x mode, already rendered as CSS.
//
// They are INFORMATIONAL here and are never emitted. This package's whole
// reason to exist is that the consumer's policies (colour format, ratio form,
// motion unit, cell trust, hand-authored-wins) decide what a token reads as;
// re-publishing the plugin's own sheet alongside would put two stylesheets in
// the repo that disagree, which is the exact failure mode the generator
// removes.
//
// What the sheets ARE good for is a second opinion: for every variable the
// export states a value for, the export's value and this generator's value can
// be compared directly. A disagreement is a finding — sometimes about the
// export (`--delay-0: [object Object]` in the 2026-09-12 v12 export), sometimes
// a policy this consumer applies on purpose (house colour format, quoted
// STRINGs, `3 / 2` rather than `3:2`). Neither is silently resolved.
import { cmp, resolveValue } from "./resolve.mjs";
import { webName } from "./schema.mjs";

const DECLARATION = /^\s*(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]+?)\s*$/;

/**
 * @returns {Array<{ name, collection, mode, selector, sheet, generated }>}
 *   one row per variable whose sheet value differs from the value this run
 *   resolved for the SAME variable in the SAME mode. Empty for an export that
 *   publishes no sheets (schema 8-11).
 */
export function sheetFindings(doc, byId, cfg) {
  const out = [];
  for (const sheet of doc.cssCustomPropertySheets ?? []) {
    const collection = doc.collections.find((c) => c.name === sheet.collectionName);
    if (!collection) continue;
    for (const declaration of sheet.declarations ?? []) {
      const m = DECLARATION.exec(declaration);
      if (!m) continue;
      const [, name, sheetValue] = m;
      const v = collection.variables.find((x) => webName(x) === name);
      const mv = v?.modes.find((x) => x.modeId === sheet.modeId);
      if (!mv || mv.effective === false) continue;
      const generated = resolveValue(v, mv, byId, cfg, collection).value;
      if (generated === sheetValue) continue;
      out.push({
        name,
        collection: collection.name,
        mode: sheet.modeName,
        selector: sheet.selector,
        sheet: sheetValue,
        generated,
      });
    }
  }
  return out.sort((a, b) => cmp(a.name + a.mode, b.name + b.mode));
}
