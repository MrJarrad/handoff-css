// JHD house policy for handoff-css. Nothing in `src/` names a JHD collection,
// selector attribute, theme or path — it all arrives through this object.
export default {
  paths: {
    input: "design/handoff/latest/jhd-spec-designsystem-design-system-handoff.json",
    out: "src/tokens.generated.css",
    theme: "src/theme.generated.css",
    report: "design/generated/ds-from-handoff-report.md",
    handAuthored: "src/styles.css",
    exclusions: "design/generated/exclusions.json",
  },
};
