# Spec Delta

## Purpose

Ensures trade-held (non-tradable) cards are excluded from matching on every scan while the scan itself starts and completes reliably on the first attempt in all scan modes.

## ADDED Requirements

### Requirement: First-run scan completes without requiring a retry

The system SHALL start and complete a scan on the first Scan invocation after page load in every scan mode (inventory scan on/off, scan filters on/off), with the same outcome as a second invocation under identical inventory and badge data.

#### Scenario: First scan succeeds in badge-page mode

- **WHEN** a user with badge-page scan mode (inventory scan off, no scan filters) clicks Scan once
- **THEN** badge pages are scanned, owned-card details are fetched, bot matching runs, and results or a terminal status (e.g. no matches) are shown without requiring a second click

#### Scenario: First scan succeeds in inventory mode

- **WHEN** a user with inventory scan on clicks Scan once with a reachable inventory and badges database
- **THEN** the inventory is read, tradable counts are computed, badge eligibility is derived from tradable copies, and matching completes without requiring a second click

#### Scenario: No silent stall on fetch failure

- **WHEN** the inventory fetch or the badges database fetch fails during a scan
- **THEN** the scan either falls back to a defined degraded path or terminates with a visible error status, and never hangs indefinitely requiring the user to click Scan again

### Requirement: Only tradable cards participate in matching

The system SHALL exclude non-tradable (trade-held) card copies from badge eligibility, owned counts used for matching, and match rows offered to the user, so offered trades never rely on cards Steam would omit from the trade offer.

#### Scenario: Trade-held copies are excluded from owned counts

- **WHEN** a card the user owns has some copies flagged non-tradable in the inventory response
- **THEN** only the tradable copies are counted as owned for matching purposes

#### Scenario: Fully held games yield no matches

- **WHEN** all copies of a game's cards relevant to a match are non-tradable
- **THEN** no match row is produced for that game based on held cards

#### Scenario: Tradability flag is interpreted correctly

- **WHEN** an inventory description carries the current trade-state flag as false, zero, or the string zero
- **THEN** its copies are treated as non-tradable, while descriptions without that negative signal are treated as tradable, and the fixed post-market cooldown field is never used as a tradability signal

#### Scenario: Foil and non-card items stay excluded

- **WHEN** inventory contains foil cards or non-card items
- **THEN** they remain excluded from badge eligibility and matching exactly as before

### Requirement: Scan degrades gracefully without tradability data

The system SHALL fall back to Steam badge-page `owned` counts when tradability data is unavailable (inventory fetch failed or a game has no tradability entry), and badge-page / scan-filter scans SHALL still proceed to matching.

#### Scenario: Inventory fetch failure falls back to badge-page scan

- **WHEN** the upfront inventory fetch fails and inventory scan mode is off
- **THEN** the badge-page scan starts and matching uses badge-page owned counts

#### Scenario: Missing tradability entry falls back per card

- **WHEN** a badge has no entry in the tradable-counts lookup
- **THEN** that badge's cards use the badge-page owned counts instead of zero
