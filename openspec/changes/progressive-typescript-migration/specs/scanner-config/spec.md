# Spec Delta

## Purpose

Guarantees user settings survive upgrades and corruption: stored values win, missing keys get real defaults, and invalid data falls back safely without losing the scan path.

## ADDED Requirements

### Requirement: Stored settings merge safely over typed defaults

The system SHALL merge persisted settings over the built-in defaults such that stored values win (including explicit `false`/`0`), missing keys receive a fresh copy of their default, unknown stored keys are preserved, and a missing or corrupt stored object yields the defaults.

#### Scenario: Stored true survives reload

- **WHEN** `inventoryScan` was saved as `true` and the page reloads
- **THEN** the loaded settings still read `inventoryScan` as `true`

#### Scenario: New keys backfill without clobbering

- **WHEN** stored settings lack keys introduced by a newer version
- **THEN** those keys are filled with their defined defaults and already-stored values are unchanged

#### Scenario: Corrupt storage falls back to defaults

- **WHEN** the stored settings blob is missing or unparseable
- **THEN** the system uses the defaults and the scan still starts

#### Scenario: Wrong-typed values fall back per key

- **WHEN** a stored value has an unusable type (e.g. a string where a number is required)
- **THEN** that key falls back to its default while the remaining stored keys are preserved

### Requirement: Scan path resolves deterministically from settings

The system SHALL resolve each run to exactly one scan path — scan filters when enabled with at least one active filter, otherwise the inventory scan when its flag is on, otherwise the badge-page scan — so the executed path always matches the saved setting.

#### Scenario: Active scan filters take precedence

- **WHEN** scan filters are enabled with at least one active filter
- **THEN** the run executes the scan-filters path

#### Scenario: Inventory flag selects inventory scan

- **WHEN** scan filters are off or have no active filter and the inventory-scan flag is on
- **THEN** the run executes the inventory scan path

#### Scenario: Default is badge-page scan

- **WHEN** scan filters and the inventory-scan flag are both off
- **THEN** the run executes the badge-page scan path
