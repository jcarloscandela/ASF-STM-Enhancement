# Spec Delta

## MODIFIED Requirements

### Requirement: Build always produces both distributables

The system SHALL provide a single build command that regenerates both `dist/ASF-STM.user.js` (release, debug lines stripped) and `dist/ASF-STM.debug.js` (debug lines kept) from `src/` plus `src/templates/` by executing `scripts/build.ts` through the Oxc TypeScript runner, producing output equivalent to the previous `tsx` execution, and SHALL fail with a non-zero exit and a clear message when any template file or placeholder is missing or unreplaced.

#### Scenario: Clean build emits both files

- **WHEN** a contributor runs the documented build command from a clean `dist/` state
- **THEN** both `dist/ASF-STM.user.js` and `dist/ASF-STM.debug.js` exist, contain the current version string, and contain no unreplaced `{{PLACEHOLDER}}` tokens

#### Scenario: Missing template fails loudly

- **WHEN** a template file under `src/templates/` is missing or a placeholder in `src/ASF-STM.js` has no matching template
- **THEN** the build exits non-zero and names the missing file or placeholder instead of writing a corrupt artifact

#### Scenario: Release and debug variants differ only by debug lines

- **WHEN** the build completes
- **THEN** the release file contains no debug-marked lines while the debug file retains their code content, with all templates expanded identically in both

#### Scenario: TypeScript libs are compiled into the bundle

- **WHEN** the build completes
- **THEN** both distributables contain the compiled output of the TypeScript lib sources with identical behavior to the previous JavaScript libs, and `tsc` typechecking passes with no errors

#### Scenario: Oxc build output matches previous runner output

- **WHEN** the build runs via the Oxc runner and its outputs are diffed against a reference build from the previous runner at the same source revision
- **THEN** `dist/ASF-STM.user.js` and `dist/ASF-STM.debug.js` are identical (excluding only intended version-string changes), confirming no transform regression

### Requirement: Unit tests verify tradability logic without a browser

The system SHALL ship a unit-test suite that verifies the tradability helpers and scan-eligibility mapping with plain fixtures (no browser, no network, no new runtime dependencies) and SHALL be runnable with a single documented command that CI also executes, with test transformation provided by the Oxc pipeline.

#### Scenario: Tradability suite runs with one command

- **WHEN** a contributor runs the documented test command
- **THEN** all tests execute and the command exits non-zero on any failure, covering tradable/held flag variants, foil and non-card exclusion, asset-to-description counting, and the owned-count fallback

#### Scenario: CI runs tests and verifies build outputs

- **WHEN** CI runs on push or pull request
- **THEN** it executes the unit tests and the build via the Oxc runner, and fails the run if any test fails or either `dist` file is missing or still contains unreplaced placeholders
