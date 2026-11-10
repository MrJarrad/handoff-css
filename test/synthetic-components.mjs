// Two differently-structured design systems as layer exports (schema `design-handoff`), sharing no
// component names, separators, property names or tiering with the house export or with each other.
// A: flat PascalCase, two variant axes, no nesting, tokens bound to a semantic collection.
// B: slash categories, boolean-driven variants, three tiers of nesting, tokens bound to a primitive collection.
let n = 0;
const id = () => `${(n += 1)}:${n}`;
const node = (type, name, children = [], extra = {}) => ({ id: id(), name, type, children, ...extra });
const bind = (collectionName, variableName) => ({ tokenBindings: { fill: { variableName, collectionName } } });
const inst = (setName, props = {}, extra = {}) =>
  node("INSTANCE", setName, [], {
    component: { sourceId: `src:${setName}`, sourceName: `${setName}/x=y`, setName, props: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { type: typeof v === "boolean" ? "BOOLEAN" : "VARIANT", value: v, overridden: true }])) },
    ...extra,
  });
const set = (name, defs, children = []) => node("COMPONENT_SET", name, [node("COMPONENT", "v=1", children)], { componentPropertyDefinitions: defs });
const doc = (documentName, layerTree) => ({ schema: "design-handoff", schemaVersion: 18, documentName, contentHash: `hash-${documentName}`, layerTree });

export function flatSystem() {
  n = 0;
  const button = set("Button", { "variant#1:1": { type: "VARIANT", defaultValue: "solid", variantOptions: ["solid", "outline"] }, "size#1:2": { type: "VARIANT", defaultValue: "md", variantOptions: ["sm", "md", "lg"] }, "label#1:3": { type: "TEXT", defaultValue: "Go" } }, [node("FRAME", "bg", [], bind("semantic", "surface/brand"))]);
  const card = set("Card", { "variant#2:1": { type: "VARIANT", defaultValue: "plain", variantOptions: ["plain", "raised"] } }, [node("FRAME", "bg", [], bind("semantic", "surface/neutral"))]);
  const tag = node("COMPONENT", "Tag", [node("FRAME", "bg", [], bind("semantic", "surface/neutral"))], { componentPropertyDefinitions: { "tone#3:1": { type: "VARIANT", defaultValue: "info", variantOptions: ["info", "warn"] } } });
  const page = node("FRAME", "Page", [inst("Button", { variant: "outline", size: "md" }), inst("Card", { variant: "plain" }), inst("Tag", { tone: "info" })]);
  return doc("flat-system", [button, card, tag, page]);
}

export function tieredSystem() {
  n = 100;
  const input = set("Atoms/Input", { "hasIcon#1:1": { type: "BOOLEAN", defaultValue: false }, "isDisabled#1:2": { type: "BOOLEAN", defaultValue: false } }, [node("FRAME", "box", [], bind("primitive", "gray/200"))]);
  const label = set("Atoms/Label", { "isRequired#2:1": { type: "BOOLEAN", defaultValue: false } }, [node("TEXT", "t", [], bind("primitive", "gray/900"))]);
  const field = set("Molecules/FormField", { "hasHint#3:1": { type: "BOOLEAN", defaultValue: true } }, [inst("Atoms/Input"), inst("Atoms/Label")]);
  const header = set("Organisms/Header", { "isSticky#4:1": { type: "BOOLEAN", defaultValue: false } }, [inst("Molecules/FormField"), node("FRAME", "bar", [], bind("primitive", "gray/100"))]);
  const page = node("FRAME", "Screen", [inst("Organisms/Header", { isSticky: true })]);
  return doc("tiered-system", [input, label, field, header, page]);
}
