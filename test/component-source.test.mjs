// `handoff-css components --src`: component structure read from code (props, variants, composition),
// compared with the component profile built from layer exports. Fixtures are synthetic source text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { dispatch } from "../src/cli.mjs";
import { scanComponentSource, compareComponents } from "../src/component-source.mjs";
import { buildComponentProfile } from "../src/component-profile.mjs";
import { flatSystem } from "./synthetic-components.mjs";

const BUTTON = `
import * as React from "react"
export type Tone = "info" | "warn"
export type Size =
  | "sm"
  | "md" // the default
  | "lg"

/** Button. */
function Button({
  className,
  variant = "solid",
  size = "md",
  disabled = false,
  asChild,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "style"> & {
  variant?: "solid" | "outline"
  size?: Size
  disabled?: boolean
  asChild?: boolean
  label?: React.ReactNode; tone: Tone
}) {
  return <button {...props}><Icon /><Label>{children}</Label></button>
}

function Icon() { return <svg /> }
export function Label({ text }: { text: string }) { return <span>{text}</span> }
export { Button }
`;

const files = [{ path: "src/button.tsx", text: BUTTON }];
const byName = (scan, name) => scan.components.find((c) => c.name === name);
const prop = (c, name) => c.props.find((p) => p.name === name);

test("scan reads a component's props with optionality, default and variant options", () => {
  const button = byName(scanComponentSource(files), "Button");
  assert.deepEqual(button.props.map((p) => p.name).sort(), ["asChild", "children", "className", "disabled", "label", "size", "tone", "variant"]);
  assert.deepEqual(prop(button, "variant"), { name: "variant", optional: true, type: '"solid" | "outline"', options: ["solid", "outline"], default: "solid" });
  assert.equal(prop(button, "tone").optional, false);
});

test("variant options follow a named union alias, comments set aside", () => {
  const size = prop(byName(scanComponentSource(files), "Button"), "size");
  assert.deepEqual(size.options, ["sm", "md", "lg"]);
  assert.equal(size.default, "md");
});

test("a boolean prop's options are false and true; spread-in element props are listed as extends, not props", () => {
  const button = byName(scanComponentSource(files), "Button");
  assert.deepEqual(prop(button, "disabled").options, ["false", "true"]);
  assert.equal(prop(button, "disabled").default, "false");
  assert.deepEqual(button.extends, ['Omit<React.ComponentProps<"button">, "style">']);
});

test("composition lists the scanned components a component renders, never itself or unknown tags", () => {
  const scan = scanComponentSource(files);
  assert.deepEqual(byName(scan, "Button").renders, ["Icon", "Label"]);
  assert.equal(byName(scan, "Button").acceptsChildren, true);
  assert.equal(byName(scan, "Label").acceptsChildren, false);
  assert.deepEqual(byName(scan, "Label").renders, []);
});

test("each component carries file and line; non-component files are ignored", () => {
  const scan = scanComponentSource([...files, { path: "src/util.ts", text: "export function Helper() {}" }, { path: "src/x.css", text: ".a{}" }]);
  assert.equal(byName(scan, "Helper"), undefined);
  assert.deepEqual([byName(scan, "Button").file, byName(scan, "Button").line], ["src/button.tsx", BUTTON.split("\n").findIndex((l) => l.startsWith("function Button")) + 1]);
});

test("a props type declared by name (type alias or interface) supplies the props", () => {
  const scan = scanComponentSource([{ path: "a.tsx", text: `
type CardProps = { variant?: "plain" | "raised"; title: string }
interface TagProps { tone?: "info" | "warn" }
export function Card({ variant = "plain", title }: CardProps) { return <div>{title}</div> }
export const Tag = ({ tone }: TagProps) => <b>{tone}</b>
` }]);
  assert.deepEqual(prop(byName(scan, "Card"), "variant").options, ["plain", "raised"]);
  assert.equal(prop(byName(scan, "Card"), "title").optional, false);
  assert.deepEqual(prop(byName(scan, "Tag"), "tone").options, ["info", "warn"]);
});

// --- compare --------------------------------------------------------------------------------

const profile = () => buildComponentProfile(flatSystem());
const compare = (text) => compareComponents(profile(), scanComponentSource([{ path: "c.tsx", text }]));

const CODE = `
export function Button({ variant = "solid", size = "md" }: { variant?: "solid" | "ghost"; size?: "sm" | "md" | "lg" }) { return <button /> }
export function Card({ variant }: { variant?: "plain" | "raised" }) { return <div /> }
export function Banner() { return <div /> }
`;

test("compare counts matched components, prop gaps and code-only components", () => {
  const r = compare(CODE);
  // Design has Button (variant, size, label), Card (variant), Tag (tone); code has Button, Card, Banner.
  assert.deepEqual(r.counts.components, { design: 3, matched: 2, designOnly: 1, codeOnly: 1 });
  assert.deepEqual(r.codeOnly.map((c) => c.name), ["Banner"]);
  assert.deepEqual(r.designOnly.map((c) => c.name), ["Tag"]);
  assert.deepEqual(r.counts.props, { design: 4, matched: 2, valueGaps: 1, propGaps: 1 });
});

test("a design property with no same-named code prop is a prop gap; differing variant options are a value gap", () => {
  const r = compare(CODE);
  const button = r.matched.find((c) => c.name === "Button");
  assert.deepEqual(button.props.find((p) => p.name === "label"), { name: "label", status: "prop-gap", design: { type: "TEXT", options: null }, code: null });
  const variant = button.props.find((p) => p.name === "variant");
  assert.equal(variant.status, "value-gap");
  assert.deepEqual([variant.missingInCode, variant.onlyInCode], [["outline"], ["ghost"]]);
  assert.equal(button.props.find((p) => p.name === "size").status, "matched");
});

test("names match once case and separators are set aside; the Figma id suffix and kebab case are set aside on properties", () => {
  const doc = flatSystem();
  const set = doc.layerTree.find((n) => n.name === "Button");
  set.name = ".Action-Button";
  set.componentPropertyDefinitions = { "has-icon-start#9:9": { type: "BOOLEAN", defaultValue: false } };
  const scan = scanComponentSource([{ path: "a.tsx", text: "export function ActionButton({ hasIconStart }: { hasIconStart?: boolean }) { return <b /> }" }]);
  const r = compareComponents(buildComponentProfile(doc), scan);
  const row = r.matched.find((c) => c.name === ".Action-Button");
  assert.equal(row.code.name, "ActionButton");
  assert.equal(row.props[0].status, "matched");
});

test("composition: a design nest the code does not render is listed", () => {
  const doc = flatSystem();
  const card = doc.layerTree.find((n) => n.name === "Card");
  card.children[0].children.push({ id: "z:1", name: "Tag", type: "INSTANCE", children: [], component: { sourceId: "src:Tag", sourceName: "Tag/x", setName: "Tag", props: {} } });
  const withTag = (cardBody) => compareComponents(buildComponentProfile(doc), scanComponentSource([{ path: "a.tsx", text: `export function Tag() { return <b /> }\nexport function Card() { return ${cardBody} }` }]));
  assert.deepEqual(withTag("<div />").matched.find((c) => c.name === "Card").composition, { designNests: ["Tag"], missingInCode: ["Tag"], onlyInCode: [] });
  assert.deepEqual(withTag("<Tag />").matched.find((c) => c.name === "Card").composition, { designNests: ["Tag"], missingInCode: [], onlyInCode: [] });
});

// --- CLI ----------------------------------------------------------------------------------------

function run(args, cwd) {
  let out = "", err = "";
  const stdout = { write: (s) => (out += s) }, stderr = { write: (s) => (err += s) };
  return dispatch(["components", ...args], { cwd, stdout, stderr }).then((code) => ({ code, out, err }));
}

test("--src writes component-code-compare files beside the profile; without --src nothing new is written", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hcss-src-"));
  mkdirSync(path.join(dir, "src"));
  writeFileSync(path.join(dir, "src", "c.tsx"), CODE);
  writeFileSync(path.join(dir, "flat.json"), JSON.stringify(flatSystem()));
  const plain = await run(["--export", "flat.json", "--out", "plain"], dir);
  assert.equal(plain.code, 0);
  assert.equal(existsSync(path.join(dir, "plain", "component-code-compare.json")), false);
  const r = await run(["--export", "flat.json", "--src", "src", "--out", "out"], dir);
  assert.equal(r.code, 0, r.err);
  const json = JSON.parse(readFileSync(path.join(dir, "out", "component-code-compare.json"), "utf8"));
  assert.equal(json.counts.components.matched, 2);
  assert.match(readFileSync(path.join(dir, "out", "component-code-compare.md"), "utf8"), /Banner/);
  assert.match(r.out, /2 matched/);
  assert.equal(readFileSync(path.join(dir, "out", "component-profile.json"), "utf8"), readFileSync(path.join(dir, "plain", "component-profile.json"), "utf8"));
});
