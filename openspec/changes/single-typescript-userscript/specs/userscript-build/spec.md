# Spec Delta

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Build always produces both distributables
**Reason**: The pipeline now emits a single distributable with debug behavior behind a runtime switch, so the release/debug variant split no longer exists.
**Migration**: Run the documented build command and ship `dist/ASF-STM.user.js`; remove references to `dist/ASF-STM.debug.js` and the `// DEBUG` line convention.
