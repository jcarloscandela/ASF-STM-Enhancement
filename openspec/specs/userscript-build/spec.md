# userscript-build

## Purpose

Guarantees contributors and CI can always regenerate both distributable userscript files from source and verify logic changes with a fast unit-test suite.

## Requirements

### Requirement: Build always produces both distributables

The system SHALL provide a single `pnpm build` command that regenerates both `dist/ASF-STM.user.js` (release, debug lines stripped) and `dist/ASF-STM.debug.js` (debug lines kept) from `src/` plus `src/templates/` using the Node/TypeScript builder, and SHALL fail with a non-zero exit and a clear message when any template file or placeholder is missing or unreplaced.

#### Scenario: Clean build emits both files

- **WHEN** a contributor runs `pnpm build` from a clean `dist/` state
- **THEN** both `dist/ASF-STM.user.js` and `dist/ASF-STM.debug.js` exist, contain the current version string, and contain no unreplaced `{{PLACEHOLDER}}` tokens

#### Scenario: Missing template fails loudly

- **WHEN** a template file under `src/templates/` is missing or a placeholder in the userscript source has no matching template
- **THEN** the build exits non-zero and names the missing file or placeholder instead of writing a corrupt artifact

#### Scenario: Release and debug variants differ only by debug lines

- **WHEN** the build completes
- **THEN** the release file contains no debug-marked lines while the debug file retains their code content, with all templates expanded identically in both

#### Scenario: TypeScript libs are compiled into the bundle

- **WHEN** the build completes
- **THEN** both distributables contain the compiled output of the TypeScript lib sources with identical behavior to the previous JavaScript libs, and `tsc` typechecking passes with no errors

### Requirement: Unit tests verify tradability logic without a browser

The system SHALL ship a unit-test suite run with `pnpm test` (vitest) that verifies the tradability helpers, settings helpers, and scan-eligibility mapping with plain fixtures (no browser, no network, no new runtime dependencies beyond dev tooling) and SHALL be executed by CI together with the typecheck, lint, and build.

#### Scenario: Tradability suite runs with one command

- **WHEN** a contributor runs `pnpm test`
- **THEN** all tests execute and the command exits non-zero on any failure, covering tradable/held flag variants, dated trade holds, settings merge and scan-plan resolution, foil and non-card exclusion, asset-to-description counting, and the owned-count fallback

#### Scenario: CI runs tests and verifies build outputs

- **WHEN** CI runs on push or pull request
- **THEN** it executes the typecheck, lint, unit tests, and the build, and fails the run if any of them fails or if either `dist` file is missing or still contains unreplaced placeholders
