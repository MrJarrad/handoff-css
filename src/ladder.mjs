// The ladder sanity check. A ladder is a set of colour variables named
// <set>/lighter, <set>/light, <set>/dark, <set>/darker (for example color/content/negative/dark),
// read in every theme mode. Warnings only — a ladder is the design's to judge, so none
// of these fails a run:
//   out-of-order   lightness (OKLCH L, translucent steps flattened over the page) rises
//                  somewhere from lighter to darker; `reversed` when it only ever rises,
//                  `shuffled` otherwise
//   step-collision two steps of one set resolve to the identical colour
//   unreadable     a step's alias chain does not resolve in this export (set skipped)
//   state-sharing  two sets of one role (`color/content/*`) in different states resolve a
//                  step to the identical colour
import { oklch } from "culori";

export const STEPS = "lighter light dark darker".split(" ");
const TIE = 0.0005;

/** `top` over an opaque `under`, in 0..255 channels. */
const flatten = (top, under) => (under ? top.rgb.map((c, i) => c * top.alpha + under.rgb[i] * (1 - top.alpha)) : top.rgb);
const hex = (rgb) => rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
const lightness = ([r, g, b]) => oklch({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 }).l;
const key = (x) => `${hex(x.rgb)}${Math.round(x.alpha * 255).toString(16).padStart(2, "0")}`;

/** @param {{ collections?: object[] }} ds  @param {(name: string, mode: string) => { rgb: number[], alpha: number }} resolve */
export function ladderReport(ds, { resolve, modes, page, ladderCollection = "color" }) {
  const sets = new Map();
  for (const c of ds.collections ?? []) {
    if (c.name !== ladderCollection) continue;
    for (const v of c.variables ?? []) {
      const m = /^(.*)\/(lighter|light|dark|darker)$/.exec(v.name);
      if (m) (sets.get(m[1]) ?? sets.set(m[1], {}).get(m[1]))[m[2]] = v;
    }
  }
  const warnings = [];
  const target = (v, mode) => {
    const m = v.modes.find((x) => x.modeName === mode);
    return m?.raw?.type === "VARIABLE_ALIAS" ? resolve.nameOf(m.raw.id) : null;
  };
  for (const mode of modes) {
    const under = page && resolve.has(page) ? resolve(page, mode) : null;
    const byRole = new Map();
    for (const [set, steps] of sets) {
      let present;
      try {
        present = STEPS.filter((s) => steps[s]).map((step) => {
        const raw = resolve(steps[step].name, mode);
        const rgb = flatten(raw, under);
        return { step, rgb: raw.rgb, alpha: raw.alpha, name: steps[step].name, L: lightness(rgb), alias: target(steps[step], mode) };
        });
      } catch (err) {
        warnings.push({ kind: "unreadable", mode, set, steps: [], detail: err.message.replace(/^contrast: /, "") });
        continue;
      }
      const label = (s) => `${s.step} ${s.alias ?? `#${hex(s.rgb)}`}`;
      // step-collision: every group of steps with the identical colour
      const groups = new Map();
      for (const s of present) (groups.get(key(s)) ?? groups.set(key(s), []).get(key(s))).push(s);
      for (const g of groups.values()) {
        if (g.length > 1) warnings.push({ kind: "step-collision", mode, set, steps: g.map((s) => s.step), detail: `${g.map((s) => s.step).join(" and ")} both resolve to ${g[0].alias ?? `#${hex(g[0].rgb)}`}` });
      }
      // out-of-order
      if (present.length > 1) {
        const rises = present.slice(1).map((s, i) => s.L - present[i].L > TIE);
        if (rises.some(Boolean)) {
          const falls = present.slice(1).map((s, i) => present[i].L - s.L > TIE);
          const shape = falls.some(Boolean) ? "shuffled" : "reversed";
          warnings.push({ kind: "out-of-order", shape, mode, set, steps: present.map((s) => s.step), detail: `lightness runs ${present.map((s) => `${label(s)} ${s.L.toFixed(3)}`).join(" → ")}` });
        }
      }
      const role = set.split("/").slice(0, 2).join("/");
      for (const s of present) {
        const k = key(s);
        const m = byRole.get(role) ?? byRole.set(role, new Map()).get(role);
        (m.get(k) ?? m.set(k, []).get(k)).push({ set, step: s.step, alias: s.alias, rgb: s.rgb });
      }
    }
    for (const [role, colours] of byRole) {
      for (const users of colours.values()) {
        const states = new Set(users.map((u) => u.set));
        if (states.size > 1) {
          const u0 = users[0];
          warnings.push({ kind: "state-sharing", mode, set: role, steps: users.map((u) => `${u.set}/${u.step}`), detail: `${users.map((u) => `${u.set}/${u.step}`).join(" and ")} both resolve to ${u0.alias ?? `#${hex(u0.rgb)}`}` });
        }
      }
    }
  }
  return warnings;
}
