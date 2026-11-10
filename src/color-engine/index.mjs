// The color engine: full primitive ramps from one or more anchor colours, a verdict on whether several
// colours make sense as one ramp, a fit to an existing system's ramps, and colour names on request.
// Pure functions; no file or network access.
export { ramp, DEFAULTS } from "./build.mjs";
export { mergeVerdict } from "./merge.mjs";
export { fitToSystem } from "./fit.mjs";
export { auditRamp } from "./ramp.mjs";
