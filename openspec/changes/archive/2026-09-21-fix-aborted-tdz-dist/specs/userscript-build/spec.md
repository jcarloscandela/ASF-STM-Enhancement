# Spec Delta

## MODIFIED Requirements

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
