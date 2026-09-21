# steam-payload-schema

## Purpose

Provides validated, version-tolerant types for every Steam payload the scanner consumes, so shape changes in Steam responses degrade gracefully instead of breaking scans.

## Requirements

### Requirement: Inventory payloads are validated at the scan boundary

The system SHALL validate Steam inventory `descriptions` and `assets` entries at the point they enter the scan, accepting only entries with usable `classid`/`instanceid` and interpreting the trade-state flag (`false`, `0`, `"0"` = held; absent or any other value = tradable). Entries that fail validation SHALL be skipped without aborting the scan.

#### Scenario: Valid inventory passes through

- **WHEN** an inventory response contains well-formed descriptions and assets for regular (non-foil) cards
- **THEN** all valid entries are available for counting and matching

#### Scenario: Malformed entries are skipped safely

- **WHEN** an inventory response contains entries missing `classid`/`instanceid` or with unusable shapes
- **THEN** those entries are skipped, valid entries still count, and the scan completes

#### Scenario: Unknown Steam fields never break the scan

- **WHEN** Steam adds new fields alongside the ones the scanner reads
- **THEN** the new fields are ignored and counting behavior is unchanged

#### Scenario: Tradable flag variants are interpreted consistently

- **WHEN** a description carries the trade-state flag as `false`, `0`, or `"0"`
- **THEN** its copies count as non-tradable, while descriptions without that negative signal count as tradable

### Requirement: Badge and bot-list payloads are validated at their boundaries

The system SHALL validate badge-page card entries (`title`, `markethash`, `owned`, `imgurl`) and bot-list entries (Steam ID, trade token, match mode, inventory counts) before they are used for matching, substituting safe fallbacks (skip the entry, treat counts as zero) for invalid entries so one bad record never aborts a run.

#### Scenario: Bad badge card entry is skipped

- **WHEN** a badge response contains a card entry with a missing title or market hash
- **THEN** that card is skipped and the remaining cards of the badge still process

#### Scenario: Bad bot entry is skipped

- **WHEN** the bot list contains an entry with an unusable Steam ID
- **THEN** that bot is skipped and matching continues with the remaining bots

#### Scenario: Future-dated trade holds stay excluded after validation

- **WHEN** an owned card carries a "Tradable After" timestamp in the future at scan time
- **THEN** it contributes zero to owned counts, eligibility, and match rows regardless of payload shape variations
