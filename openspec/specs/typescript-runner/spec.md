# typescript-runner

## Purpose

Consolidates TypeScript execution on Oxc so contributors run the build script, tests, and watch workflows through a single fast runner family alongside the existing Oxc lint and format tools.

## Requirements

### Requirement: TypeScript sources execute through the Oxc runner

The system SHALL execute TypeScript entry points (`scripts/build.ts`, test files, and any documented dev entry) through the Oxc TypeScript runner (`oxnode` CLI or `node --import @oxc-node/core/register`) instead of requiring a separate `tsx` installation for the default workflow.

#### Scenario: Build script runs without tsx installed

- **WHEN** a contributor runs the documented build command on a clean install that contains only the Oxc runner packages
- **THEN** `scripts/build.ts` executes successfully and produces both distributables without resolving `tsx` from `node_modules` or `PATH`

#### Scenario: Tests run through the Oxc transform path

- **WHEN** a contributor runs the documented test command
- **THEN** all unit tests execute and pass via the Oxc transform pipeline with the same include pattern (`test/**/*.test.ts`) and non-zero exit on failure

### Requirement: Runner honors project module and tsconfig conventions

The system SHALL resolve module format from file extension, nearest `package.json`, and `tsconfig.json`, SHALL transform supported extensions (`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.mts`, `.cjs`, `.cts`), SHALL NOT transform files under `node_modules` by default, and SHALL strip types without type-checking so that `tsc --noEmit` remains the separate type gate.

#### Scenario: ESM build script and CJS/ESM interop resolve correctly

- **WHEN** the runner loads `scripts/build.ts` (ESM, `"type": "module"`) and its `node:` imports
- **THEN** execution succeeds without module-format errors and Node flags (e.g. `--watch`) pass through

#### Scenario: Type errors do not block execution but fail typecheck

- **WHEN** a TypeScript type error is present in `src/lib/` or `scripts/`
- **THEN** the Oxc runner still executes (types stripped) while `pnpm typecheck` fails, preserving the existing separation between running and checking

### Requirement: Runner supports watch mode and source maps for debugging

The system SHALL support `oxnode --watch` (or equivalent register-hook watch invocation) for the documented dev loop and SHALL emit source maps so stack traces map back to the original TypeScript sources.

#### Scenario: Watch mode reruns on save

- **WHEN** a contributor starts the documented watch command and edits `scripts/build.ts` or `src/lib/*.ts`
- **THEN** the runner re-executes without a manual restart

#### Scenario: Stack trace points at TypeScript source

- **WHEN** `scripts/build.ts` throws (e.g. missing placeholder failure)
- **THEN** the reported stack references the `.ts` file and line, not only transpiled output
