# Spec Delta

## ADDED Requirements

### Requirement: First-run scan completes via inventory or scan filters

The system SHALL start and complete a scan on the first Scan invocation after page load in every scan mode (scan filters on/off), with the same outcome as a second invocation under identical inventory and badge data. With scan filters not taking precedence, the run SHALL always execute the inventory scan path (inventory fetch, then badges-database eligibility). Stored settings SHALL round-trip across sessions so settings saved on a previous day are still in effect on the first scan of the next day, including the cold-bot-cache first click that refetches the bot list before scanning.

#### Scenario: First scan succeeds with scan filters

- **WHEN** a user with active scan filters clicks Scan once
- **THEN** the filtered badges are processed, owned-card details are fetched, bot matching runs, and results or a terminal status (e.g. no matches) are shown without requiring a second click

#### Scenario: First scan succeeds in inventory mode

- **WHEN** a user clicks Scan once with a reachable inventory and badges database
- **THEN** the inventory is read, tradable counts are computed, badge eligibility is derived from tradable copies, and matching completes without requiring a second click

#### Scenario: No silent stall on fetch failure

- **WHEN** the inventory fetch or the badges database fetch fails during a scan
- **THEN** the scan terminates with a visible error status suggesting a retry, and never hangs indefinitely requiring the user to click Scan again

#### Scenario: Settings are honored on first scan of the day

- **WHEN** a user saved settings on a previous day and clicks Scan for the first time after page load with a cold or expired bot cache
- **THEN** the run executes the inventory scan path (or the scan-filters path when filters take precedence), and the saved settings still read as they were saved

#### Scenario: Missing setting keys receive real defaults without clobbering stored values

- **WHEN** stored settings lack keys introduced by a newer version
- **THEN** missing keys are filled with their defined defaults and already-stored values are preserved unchanged

## REMOVED Requirements

### Requirement: First-run scan completes without requiring a retry

**Reason**: The badge-page scan mode is removed, so the first-run guarantee now covers only the scan-filters and inventory modes; the requirement's badge-mode scenario and its "degraded path" failure clause describe removed behavior.

**Migration**: Replaced by "First-run scan completes via inventory or scan filters" above, which keeps the same first-run guarantee over the surviving modes and tightens failure behavior to a visible, retryable abort.

### Requirement: Scan degrades gracefully without tradability data

**Reason**: The badge-page fallback this requirement defined no longer exists — the inventory scan is the only non-filter path, so a failed tradability lookup can no longer degrade to badge pages.

**Migration**: When tradability data is unavailable the scan aborts with a visible error and a retry suggestion. The per-card fallback to badge-page `owned` counts for games missing from the tradability lookup remains within the eligibility builder and stays covered by the matching specs; only the badge-page *scan* path is gone.
