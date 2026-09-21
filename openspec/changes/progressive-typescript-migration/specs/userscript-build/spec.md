# Spec Delta

## MODIFIED Requirements

### Requirement: Build always produces both distributables

The system SHALL provide a single `pnpm build` command that regenerates both `dist/ASF-STM.user.js` (release, debug lines stripped) and `dist/ASF-STM.debug.js` (debug lines kept) from `src/` plus `src/templates/` using the Node/TypeScript builder, and SHALL fail with a non-zero exit and a clear message when any template file or placeholder is missing or unreplaced. The builder SHALL discover every `src/lib/*.ts` lib generically (no hardcoded lib list) and inline its compiled output into both distributables, including libs that depend on the declared runtime-validation dependency, while keeping `dist/` single-file with no new runtime network or DOM dependencies.

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
- **THEN** both distributables contain the compiled output of every `src/lib/*.ts` source with behavior identical to the tested lib sources, a newly added lib is picked up with no builder edit, and `tsc` typechecking passes with no errors

#### Scenario: New lib is picked up without builder edits

- **WHEN** a contributor adds a new `src/lib/<name>.ts` file and runs `pnpm build`
- **THEN** the build inlines it into both distributables or fails naming the userscript placeholder it needs, without requiring a change to the builder source

### Requirement: Unit tests verify tradability logic without a browser

The system SHALL ship a unit-test suite run with `pnpm test` (vitest) that verifies the tradability helpers, settings helpers, scan-eligibility mapping, payload validation, and pure matching core with plain fixtures (no browser, no network, no new runtime dependencies beyond the declared validation dependency) and SHALL be executed by CI together with the typecheck, lint, and build.

#### Scenario: Tradability suite runs with one command

- **WHEN** a contributor runs `pnpm test`
- **THEN** all tests execute and the command exits non-zero on any failure, covering tradable/held flag variants, dated trade holds, settings merge and scan-plan resolution, payload validation (valid, malformed, and unknown-field cases), pure matching (even/uneven badges, ANY vs fair bots, balance per game), foil and non-card exclusion, asset-to-description counting, and the owned-count fallback

#### Scenario: CI runs tests and verifies build outputs

- **WHEN** CI runs on push or pull request
- **THEN** it executes the typecheck, lint, unit tests, and the build, and fails the run if any of them fails or if either `dist` file is missing or still contains unreplaced placeholders
