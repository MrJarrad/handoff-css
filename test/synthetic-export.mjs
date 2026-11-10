// A synthetic design system that shares no names, separators, step numbers or mode names with the house
// export. Shared by the profile and resolve tests, so nothing in src/ can pass by knowing the house.
let n = 0;
export const variable = (name, type, modes, extra = {}) => {
  const id = `VariableID:s:${(n += 1)}`;
  const parts = name.split("/");
  return {
    id, name, group: parts.slice(0, -1), leafName: parts.at(-1), type,
    description: "", scopes: ["ALL_SCOPES"],
    codeSyntax: { WEB: { value: `--${parts.join("-").toLowerCase()}`, source: "derived" } },
    modes, ...extra,
  };
};
/** One mode cell; `literal` is what the export resolved it to (a COLOR hex8, or a FLOAT number). */
export const cell = (modeId, raw, literal = typeof raw === "string" ? raw : undefined) => ({
  modeId, modeName: modeId, raw,
  build: typeof literal === "number" ? { status: "resolved", raw: literal, confidence: "high", source: "type" }
    : { status: "resolved", raw, ...(literal ? { literal } : {}), confidence: "high", source: "type" },
});
export const collection = (name, modes, variables, defaultModeId) => ({ id: name, name, modes, defaultModeId, variables, hiddenFromPublishing: false });

const hex = (s) => `#00${(s + 20).toString(16).padStart(2, "0")}${(s + 20).toString(16).padStart(2, "0")}FF`;

export function synthetic() {
  n = 0;
  const base = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((s) => variable(`Hue/Teal/${s}`, "COLOR", [{ ...cell("f1", hex(s), hex(s)), modeName: "base" }]));
  const space = ["xxs", "xs", "sm", "md", "lg"].map((s, i) => variable(`Space/${s}`, "FLOAT", [{ ...cell("f1", 4 * (i + 1)), modeName: "base" }]));
  const find = (name) => [...base, ...space].find((v) => v.name === name);
  const alias = (name, modeId, mode) => {
    const target = find(name);
    return { ...cell(modeId, { type: "VARIABLE_ALIAS", id: target.id }, target.modes[0].build.literal ?? target.modes[0].build.raw), modeName: mode };
  };
  const roles = (group, skip) =>
    ["main", "quiet", "accent", "danger"].filter((r) => r !== skip).map((r) =>
      variable(`${group}/${r}`, "COLOR", [alias("Hue/Teal/20", "d1", "Day"), alias("Hue/Teal/80", "n1", "Night")]));
  const sem = [...roles("Surface"), ...roles("Ink", "danger"), ...roles("Edge")];
  const bp = variable("Page/gutter", "FLOAT", [alias("Space/sm", "b1", "S"), alias("Space/lg", "b2", "L")]);
  return {
    schema: "design-system-handoff", schemaVersion: 19, documentName: "Acme Kit", exportVersion: 3, contentHash: "a".repeat(64),
    fingerprint: { designSystemStateHash: "b".repeat(64) },
    breakpoints: { entries: [] },
    styles: { PAINT: [], TEXT: [], EFFECT: [], GRID: [] },
    cssCustomPropertySheets: [],
    collections: [
      collection("Foundations", [{ id: "f1", name: "base" }], [...base, ...space], "f1"),
      collection("Semantic", [{ id: "d1", name: "Day" }, { id: "n1", name: "Night" }], sem, "d1"),
      collection("Breakpoints", [{ id: "b1", name: "S" }, { id: "b2", name: "L" }], [bp], "b1"),
    ],
    mode: { collections: [
      { collectionName: "Semantic", mappings: [
        { modeId: "d1", modeName: "Day", isTheme: true, theme: "day", source: "theme-name", confidence: "high" },
        { modeId: "n1", modeName: "Night", isTheme: true, theme: "night", source: "theme-name", confidence: "high" } ] },
      { collectionName: "Breakpoints", mappings: [
        { modeId: "b1", modeName: "S", isTheme: false, isResponsiveLayout: true, source: "explicit-name", confidence: "high" },
        { modeId: "b2", modeName: "L", isTheme: false, isResponsiveLayout: false, source: "unresolved", confidence: "none" } ] },
    ] },
  };
}
