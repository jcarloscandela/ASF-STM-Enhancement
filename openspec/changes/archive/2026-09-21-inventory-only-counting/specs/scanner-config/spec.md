# Spec Delta

## ADDED Requirements

### Requirement: Scan path resolves to the inventory scan by default

The system SHALL resolve each run to exactly one scan path — scan filters when enabled with at least one active filter, otherwise the inventory scan — so the executed path always matches the saved setting. The inventory scan SHALL be the unconditional default: it runs whenever scan filters do not take precedence, and no setting can divert a run to badge pages.

#### Scenario: Active scan filters take precedence

- **WHEN** scan filters are enabled with at least one active filter
- **THEN** the run executes the scan-filters path

#### Scenario: Inventory scan is the unconditional default

- **WHEN** scan filters are off, have no active filter, or are not configured
- **THEN** the run executes the inventory scan path, regardless of any other stored setting

#### Scenario: No badge-page path remains

- **WHEN** a scan runs with scan filters not taking precedence
- **THEN** the resolved scan plan offers only the inventory path and never a badge-page crawl

## REMOVED Requirements

### Requirement: Scan path resolves deterministically from settings

**Reason**: The three-way dispatch (filters / inventory / badge) no longer exists. The badge-page scan mode and the persisted `inventoryScan` flag are removed, so the old requirement's scenarios ("Inventory flag selects inventory scan", "Default is badge-page scan") describe behavior that is gone.

**Migration**: Replaced by "Scan path resolves to the inventory scan by default" above: scan filters keep their precedence, and the inventory scan is the unconditional default path.
