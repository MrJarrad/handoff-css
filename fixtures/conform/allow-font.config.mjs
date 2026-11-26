// A consumer's whole `handoff.config.mjs` with the `conform` block added: `conform --config`
// validates the config it reads, so a fragment is refused. `--font-suisse` is the font face
// this package asks consumers to supply, so no export will ever declare it.
import preset from "../../presets/jhd.config.mjs";

export default {
  ...preset,
  conform: { allowNames: ["--font-suisse"] },
};
