// The `conform` block on its own, as a consumer would add it to an existing
// `handoff.config.mjs`: `--font-suisse` is the font face this package asks
// consumers to supply, so no export will ever declare it.
export default {
  conform: { allowNames: ["--font-suisse"] },
};
