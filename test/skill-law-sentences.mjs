// THE LAW SENTENCES of `handoff-to-code` — the text every host output must
// carry verbatim. A skill's words ARE its interface: an agent obeys what the
// file says, so a sentence that survives in one host and not another is a
// behavioural difference, not a formatting one.
//
// This list is shared on purpose. The discipline plugin's own
// `hooks/scripts/handoff-to-code-mirror.test.mjs` imports it, so the package
// and the plugin assert the same sentences from one source instead of two
// drifting copies of the assertion.
//
// A sentence in this list must lie OUTSIDE every `{{placeholder}}` in
// `skills/handoff-to-code/SKILL.md`: a per-host sentence cannot be law.
export const LAW_SENTENCES = [
  // The contract itself.
  "The handoff pair is the contract: every node, token, copy string and annotation in it is built — never Figma pixels, never inferred values.",
  "A value the pair does not state is not yours to supply.",

  // Step 1 — the pair is one design-system state.
  "A mismatch is a **stale-pair defect**: stop and ask for a re-export.",

  // Step 2 — warnings are decisions, never things to build around.
  "A warning you build *around* is drift.",

  // Step 3 — the name is the export's name.
  "### 3. Map every binding to `codeSyntax.WEB` — an unmapped binding is a defect",
  "**`codeSyntax.WEB` is the name.**",
  "**An alias is not the name.**",
  "**No emitted token is a defect, not a guess.**",
  "Do not inline the value the export happens to show, and do not invent a token name for it.",

  // Step 4 — mechanism.
  "A right number produced by the wrong mechanism is a defect.",
  "`col-span(N/M)` maps directly. Widths computed from column maths are a defect even when they measure right.",

  // Step 5 — copy.
  "**`⚠ placeholder` is a defect, not a guess.**",
  "**The newest pair wins over any prior record.**",

  // Step 6 — the deviation table.
  "| element | Figma binding | token used | value | status | ruling ref |",
  "**match**",
  "**resolved-to-export**",
  "**unflagged-viewport**",
  "**hand-authored-override**",
  "Ask only when the export binds no token where one is expected, or building\n  the export's value breaks something — never over plain value drift.",
  "An empty `ruling ref` on a non-match row is an unauthorised deviation.",
];

/** The generator warning codes the skill must keep naming. */
export const LAW_WARNING_CODES = [
  "VIEWPORT_UNFLAGGED",
  "VIEWPORT_OUTSIDE_GROUPS",
  "VIEWPORT_CLASS_WITHOUT_FRACTION",
  "VIEWPORT_FRACTION_DISAGREES",
  "BUILD_CELL_CONTRADICTORY",
];

/** Sentences survive line wrapping, so every comparison is made single-spaced. */
export const flat = (text) => text.replace(/\s+/g, " ");

/** Does `text` carry `sentence` verbatim, ignoring where the lines break? */
export const carries = (text, sentence) => flat(text).includes(flat(sentence));
