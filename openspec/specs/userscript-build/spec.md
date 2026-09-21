# userscript-build

## Purpose

Guarantees contributors and CI can always regenerate the distributable userscript file from source and verify logic changes with a fast unit-test suite.

## Requirements

### Requirement: Build produces the single distributable

The system SHALL provide a single build command that regenerates `dist/ASF-STM.user.js` from the TypeScript sources (userscript body plus `src/lib/*.ts`, with template contents consumed as module imports rather than expanded placeholders), and SHALL fail with a non-zero exit and a clear message when any source, template, or declared version is missing or unusable. No builder script and no `{{PLACEHOLDER}}` mechanism SHALL remain in the pipeline.

#### Scenario: Clean build emits the distributable

- **WHEN** a contributor runs the documented build command from a clean `dist/` state
- **THEN** `dist/ASF-STM.user.js` exists, contains the current version string, is a single self-contained userscript, and contains no unreplaced `{{PLACEHOLDER}}` tokens

#### Scenario: Missing source fails loudly

- **WHEN** a TypeScript source, template module, or the declared version is missing or unusable
- **THEN** the build exits non-zero and names the missing input instead of writing a corrupt artifact

#### Scenario: Debug support ships in the single file

- **WHEN** the build completes
- **THEN** the single distributable contains both normal and debug behavior behind a runtime debug switch, with no separate debug artifact and no debug-only line-stripping step

#### Scenario: TypeScript sources compile into the bundle

- **WHEN** the build completes
- **THEN** the distributable contains the compiled output of the TypeScript userscript and lib sources with behavior identical to the tested sources, and typechecking passes with no errors

#### Scenario: Converted output matches previous behavior

- **WHEN** the build runs from the converted TypeScript source and its output is compared against a reference build from the previous pipeline at the same source revision
- **THEN** scanning, matching, and offer behavior are identical (excluding only the intended single-file/debug-switch change), confirming no conversion regression

### Requirement: Unit tests verify tradability logic without a browser

The system SHALL ship a unit-test suite that verifies the tradability helpers and scan-eligibility mapping with plain fixtures (no browser, no network, no new runtime dependencies) and SHALL be runnable with a single documented command that CI also executes, with test transformation provided by the Oxc pipeline.

#### Scenario: Tradability suite runs with one command

- **WHEN** a contributor runs `pnpm test`
- **THEN** all tests execute and the command exits non-zero on any failure, covering tradable/held flag variants, dated trade holds, settings merge and scan-plan resolution, foil and non-card exclusion, asset-to-description counting, and the owned-count fallback

#### Scenario: CI runs tests and verifies build outputs

- **WHEN** CI runs on push or pull request
- **THEN** it executes the unit tests and the build via the Oxc runner, and fails the run if any test fails or the `dist` file is missing or still contains unreplaced placeholders
