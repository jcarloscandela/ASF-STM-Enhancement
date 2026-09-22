# userscript-build

## Purpose

Guarantees contributors and CI can always regenerate the distributable userscript file from source and verify logic changes with a fast unit-test suite.

## Requirements

### Requirement: Build produces the single distributable

The system SHALL provide a single build command that regenerates `dist/ASF-STM.user.js` from the TypeScript sources (userscript body plus `src/lib/*.ts`, with template contents consumed as module imports rather than expanded placeholders), bundling the declared runtime-validation dependency into the single self-contained file with no new runtime network or DOM dependencies, and SHALL fail with a non-zero exit and a clear message when any source, template, or declared version is missing or unusable. No builder script and no `{{PLACEHOLDER}}` mechanism SHALL remain in the pipeline. The rebuilt file SHALL carry this fix with behavior identical to the tested sources and SHALL remain installable via the existing Tampermonkey/GreasyFork flow with no alternative runtime or install mechanism.

#### Scenario: Clean build emits the distributable

- **WHEN** a contributor runs the documented build command from a clean `dist/` state
- **THEN** `dist/ASF-STM.user.js` exists, contains the current version string, is a single self-contained userscript, contains no unreplaced `{{PLACEHOLDER}}` tokens, and no longer throws on the zero-pending scan path

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

#### Scenario: Validation dependency bundles without new runtime deps

- **WHEN** the build completes with the declared validation dependency installed
- **THEN** the single distributable contains its compiled output with no new runtime network or DOM dependencies, and the file remains a single self-contained userscript

### Requirement: Build embeds compacted dataset with budget check

The system SHALL embed the compacted card dataset (not the raw authoring file) into `dist/ASF-STM.user.js` during `pnpm build` and SHALL fail with a non-zero exit and a clear byte-size message when the compacted dataset or the built file exceeds its budget.

#### Scenario: Rebuilt bundle stays small

- **WHEN** a contributor runs `pnpm build`
- **THEN** the output embeds the compact encoding and reports compacted vs raw byte sizes.

#### Scenario: CI guards bundle size

- **WHEN** CI builds the userscript
- **THEN** it verifies the compacted dataset and built file are within budget alongside the existing placeholder/marker checks.

### Requirement: Unit tests verify tradability logic without a browser

The system SHALL ship a unit-test suite run with `pnpm test` (vitest) that verifies the tradability helpers, settings helpers, scan-eligibility mapping, payload validation, and pure matching core with plain fixtures (no browser, no network, no new runtime dependencies beyond the declared validation dependency) and SHALL be executed by CI together with the typecheck, lint, and build.

#### Scenario: Tradability suite runs with one command

- **WHEN** a contributor runs the documented test command
- **THEN** all tests execute and the command exits non-zero on any failure, covering tradable/held flag variants, dated trade holds, settings merge and scan-plan resolution, payload validation (valid, malformed, and unknown-field cases), pure matching (even/uneven badges, ANY vs fair bots, balance per game), foil and non-card exclusion, asset-to-description counting, and the owned-count fallback

#### Scenario: CI runs tests and verifies build outputs

- **WHEN** CI runs on push or pull request
- **THEN** it executes the typecheck, lint, unit tests, and the build, and fails the run if any of them fails or if the `dist` file is missing or still contains unreplaced placeholders
