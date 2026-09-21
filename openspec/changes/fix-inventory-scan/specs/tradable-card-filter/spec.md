# Spec Delta

## MODIFIED Requirements

### Requirement: First-run scan completes via inventory or scan filters

The system SHALL start and complete a scan on the first Scan invocation after page load in every scan mode (scan filters on/off), with the same outcome as a second invocation under identical inventory and badge data. With scan filters not taking precedence, the run SHALL always execute the inventory scan path: a paged inventory fetch (fixed page size with `start_assetid` pagination, paced by the configured inventory scan delay), then badges-database eligibility from the owned+tradable counting pass, then the badge-detail stage. Stored settings SHALL round-trip across sessions so settings saved on a previous day are still in effect on the first scan of the next day, including the cold-bot-cache first click that refetches the bot list before scanning.

#### Scenario: First scan succeeds with scan filters

- **WHEN** a user with active scan filters clicks Scan once
- **THEN** the filtered badges are processed, owned-card details are fetched, bot matching runs, and results or a terminal status (e.g. no matches) are shown without requiring a second click

#### Scenario: First scan succeeds in inventory mode

- **WHEN** a user clicks Scan once with a reachable inventory and badges database
- **THEN** the inventory is paged to completion (including when later pages carry card descriptions again), owned and tradable counts are computed per card, badge eligibility is derived from the owned distribution with the tradable-presence gate, and matching completes without requiring a second click

#### Scenario: Missing setting keys receive real defaults without clobbering stored values

- **WHEN** stored settings lack keys introduced by a newer version
- **THEN** missing keys are filled with their defined defaults and already-stored values are preserved unchanged

#### Scenario: Large inventories page until exhaustion

- **WHEN** the inventory spans multiple pages (more than one page of 2000 items)
- **THEN** the fetch continues across pages via pagination until the final page, and cards present only on later pages are counted

#### Scenario: No silent stall on fetch failure

- **WHEN** the inventory fetch or the badges database fetch fails during a scan
- **THEN** the scan terminates with a visible error status suggesting a retry, and never hangs indefinitely requiring the user to click Scan again

#### Scenario: Settings are honored on first scan of the day

- **WHEN** a user saved settings on a previous day and clicks Scan for the first time after page load with a cold or expired bot cache
- **THEN** the run executes the inventory scan path (or the scan-filters path when filters take precedence), and the saved settings still read as they were saved
