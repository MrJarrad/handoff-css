#!/usr/bin/env node
// Thin wrapper: every decision lives in `src/cli.mjs` so the CLI is testable
// without spawning a process.
import { dispatch } from "../src/cli.mjs";

process.exitCode = await dispatch(process.argv.slice(2));
