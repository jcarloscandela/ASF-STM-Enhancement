# Spec Delta

## ADDED Requirements

### Requirement: Build embeds compacted dataset with budget check

The system SHALL embed the compacted card dataset (not the raw authoring file) into `dist/ASF-STM.user.js` during `pnpm build` and SHALL fail with a non-zero exit and a clear byte-size message when the compacted dataset or the built file exceeds its budget.

#### Scenario: Rebuilt bundle stays small

- **WHEN** a contributor runs `pnpm build`
- **THEN** the output embeds the compact encoding and reports compacted vs raw byte sizes.

#### Scenario: CI guards bundle size

- **WHEN** CI builds the userscript
- **THEN** it verifies the compacted dataset and built file are within budget alongside the existing placeholder/marker checks.
