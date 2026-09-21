## Purpose

Defines how the scanner decides which of the user's owned Steam cards are eligible to be counted toward badge completion and offered in a trade, so that generated offers only contain cards the account can actually trade.

## ADDED Requirements

### Requirement: Non-tradable cards are excluded from matching

The scanner SHALL determine the tradability of each owned card from the Steam inventory response and SHALL treat cards that are not currently tradable (trade-held) as unavailable for matching or trade offers. This SHALL apply to every scan mode, including the inventory scan and the legacy badge-page scan.

#### Scenario: Trade-held cards are excluded during inventory scan

- **WHEN** the inventory scan fetches an inventory containing both tradable and trade-held copies of a card
- **THEN** only the tradable copies are counted, and held copies are omitted from badge eligibility and match counts

#### Scenario: Trade-held cards are excluded during badge-page scan

- **WHEN** the user runs a scan with the inventory scan disabled or with scan filters
- **THEN** the scanner still obtains tradability information and omits trade-held cards from match counts

#### Scenario: A match that would require offering a held card is not produced

- **WHEN** the only cards the user could offer for a badge are trade-held
- **THEN** no match is generated for that badge and no offer is created with an empty user side

### Requirement: Badge eligibility and match counts use tradable copies only

Badge eligibility and the per-card counts used to calculate sets SHALL be derived from tradable copies. A badge that appears incomplete or duplicated only because of trade-held cards MUST NOT be reported as a match.

#### Scenario: Duplicates exist only as held cards

- **WHEN** a badge has extra copies of a card but all extra copies are trade-held
- **THEN** the badge is not treated as having duplicates and is not offered

#### Scenario: Mixed tradable and held copies

- **WHEN** a badge has some tradable duplicates and some trade-held duplicates
- **THEN** only the tradable duplicates contribute to the set counts used for matching

### Requirement: Missing tradability data falls back safely

If tradability information cannot be retrieved, the scanner SHALL fall back to counting the affected cards instead of dropping them, so that a failed lookup does not silently suppress valid matches.

#### Scenario: Inventory request fails

- **WHEN** the tradability lookup fails while scanning
- **THEN** the scan continues using the previous count behavior and reports the failure in the debug build

#### Scenario: Card has no tradability field

- **WHEN** a card's inventory entry does not report tradability
- **THEN** the card is treated as tradable rather than excluded
