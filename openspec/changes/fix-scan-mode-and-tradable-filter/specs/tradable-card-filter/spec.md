# Spec Delta

## MODIFIED Requirements

### Requirement: First-run scan completes without requiring a retry

The system SHALL start and complete a scan on the first Scan invocation after page load in every scan mode (inventory scan on/off, scan filters on/off), with the same outcome as a second invocation under identical inventory and badge data. The executed scan path SHALL match the persisted settings: when `inventoryScan` is saved as true the run SHALL execute the inventory scan path, and when it is saved as false the run SHALL execute the badge-page path (unless scan filters take precedence by their own defined rule). Stored settings SHALL round-trip across sessions so a value saved on a previous day is still in effect on the first scan of the next day, including the cold-bot-cache first click that refetches the bot list before scanning.

#### Scenario: First scan succeeds in badge-page mode

- **WHEN** a user with badge-page scan mode (inventory scan off, no scan filters) clicks Scan once
- **THEN** badge pages are scanned, owned-card details are fetched, bot matching runs, and results or a terminal status (e.g. no matches) are shown without requiring a second click

#### Scenario: First scan succeeds in inventory mode

- **WHEN** a user with inventory scan on clicks Scan once with a reachable inventory and badges database
- **THEN** the inventory is read, tradable counts are computed, badge eligibility is derived from tradable copies, and matching completes without requiring a second click

#### Scenario: No silent stall on fetch failure

- **WHEN** the inventory fetch or the badges database fetch fails during a scan
- **THEN** the scan either falls back to a defined degraded path or terminates with a visible error status, and never hangs indefinitely requiring the user to click Scan again

#### Scenario: Saved inventory-scan setting is honored on first scan of the day

- **WHEN** a user saved `inventoryScan` as true on a previous day and clicks Scan for the first time after page load with a cold or expired bot cache
- **THEN** the run executes the inventory scan path (inventory fetch, then badges-database eligibility), not the badge-page scan path, and the saved setting still reads as true afterwards

#### Scenario: Missing setting keys receive real defaults without clobbering stored values

- **WHEN** stored settings lack keys introduced by a newer version (or contain a stored `inventoryScan` value)
- **THEN** missing keys are filled with their defined defaults and already-stored values are preserved unchanged

### Requirement: Only tradable cards participate in matching

The system SHALL exclude non-tradable (trade-held) card copies from badge eligibility, owned counts used for matching, and match rows offered to the user, so offered trades never rely on cards Steam would omit from the trade offer. A copy whose trade availability starts at a future date ("Tradable After" in the future) SHALL count as non-tradable until that date passes; only copies currently tradable at scan time participate.

#### Scenario: Trade-held copies are excluded from owned counts

- **WHEN** a card the user owns has some copies flagged non-tradable in the inventory response
- **THEN** only the tradable copies are counted as owned for matching purposes

#### Scenario: Fully held games yield no matches

- **WHEN** all copies of a game's cards relevant to a match are non-tradable
- **THEN** no match row is produced for that game based on held cards

#### Scenario: Tradability flag is interpreted correctly

- **WHEN** an inventory description carries the current trade-state flag as false, zero, or the string zero
- **THEN** its copies are treated as non-tradable, while descriptions without that negative signal are treated as tradable, and the fixed post-market cooldown field is never used as a tradability signal

#### Scenario: Future-dated trade holds are excluded until their date passes

- **WHEN** an owned card carries a "Tradable After" timestamp in the future (e.g. 26/09/2026, 09:00:00, as seen on the Alyx Vance Half-Life 2 card)
- **THEN** its copies are treated as non-tradable, contribute zero to owned counts and eligibility, and never appear in match rows; once the timestamp is in the past the same copies count as tradable (subject to the trade-state flag)

#### Scenario: Foil and non-card items stay excluded

- **WHEN** inventory contains foil cards or non-card items
- **THEN** they remain excluded from badge eligibility and matching exactly as before
