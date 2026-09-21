# trade-matching

## Purpose

Defines how the scanner decides which of the user's owned Steam cards are eligible to be counted toward badge completion and offered in a trade, so that generated offers only contain cards the account can actually trade.

## Requirements

### Requirement: Non-tradable cards are excluded from matching

The scanner SHALL determine the tradability of each owned card from the Steam inventory response and SHALL treat cards that are not currently tradable (trade-held) as unavailable for matching or trade offers. "Not currently tradable" includes copies flagged by the current trade-state signal AND copies whose "Tradable After" timestamp is in the future at scan time. This SHALL apply to every scan mode, including the inventory scan and the legacy badge-page scan.

#### Scenario: Trade-held cards are excluded during inventory scan

- **WHEN** the inventory scan fetches an inventory containing both tradable and trade-held copies of a card
- **THEN** only the tradable copies are counted, and held copies are omitted from badge eligibility and match counts

#### Scenario: Trade-held cards are excluded during badge-page scan

- **WHEN** the user runs a scan with the inventory scan disabled or with scan filters
- **THEN** the scanner still obtains tradability information and omits trade-held cards from match counts

#### Scenario: A match that would require offering a held card is not produced

- **WHEN** the only cards the user could offer for a badge are trade-held
- **THEN** no match is generated for that badge and no offer is created with an empty user side

#### Scenario: Future-dated holds are excluded in every scan mode

- **WHEN** an owned card (e.g. Alyx Vance, Half-Life 2) carries a "Tradable After" date in the future at scan time
- **THEN** it contributes zero to owned counts, badge eligibility, and match rows in inventory, badge-page, and scan-filter modes, and only counts again once that date has passed

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

### Requirement: Trade-offer creation only adds currently-tradable copies

The system SHALL, when building a trade offer on the Steam trade-offer page, select only copies that are currently tradable at offer time. Held copies (trade-state negative or future "Tradable After") SHALL be skipped during item selection; if a requested card has no currently-tradable copy in the live trade inventory, the offer flow SHALL surface the existing missing-items abort instead of substituting a held copy.

#### Scenario: Held copy is skipped when adding cards to the offer

- **WHEN** the user opens a generated match on the trade-offer page and the live inventory contains both a held copy and a tradable copy of a requested card
- **THEN** only the tradable copy is moved into the trade, and the held copy is left in the inventory

#### Scenario: All copies held aborts instead of offering untradable cards

- **WHEN** every live-inventory copy of a requested card is currently untradable (including future-dated holds)
- **THEN** the missing-items abort is shown and no held card is added to the offer

### Requirement: Inventory-mode scan derives badges from inventory only

When the resolved scan plan is inventory mode, the scanner SHALL derive the badge candidate list exclusively from the fetched Steam inventory (tradable counts mapped onto the badges database) and SHALL NOT issue requests to the badge pages (`/badges?p=N`) nor to per-badge detail pages during candidate discovery.

#### Scenario: Inventory mode performs no badge-page requests

- **WHEN** a scan runs with inventory mode resolved and the inventory fetch plus badges database load succeed
- **THEN** zero HTTP requests are issued to badge pages while building the candidate badge list

#### Scenario: Inventory mode result matches inventory eligibility

- **WHEN** a scan runs in inventory mode over an inventory with unbalanced (duplicated/incomplete) badges
- **THEN** the candidate badge list contains exactly the unbalanced appIds from the inventory-to-badges-database mapping, and the scan proceeds to per-card detail from there

### Requirement: Inventory-mode failure does not silently fall back to badge pages

When inventory mode cannot build eligibility (inventory fetch fails, badges database unavailable, or tradability unknown and unrecoverable), the scanner SHALL NOT silently run the badge-page scan. It SHALL abort the scan with an explicit error surfaced in the UI (and debug log in the debug build), preserving the resolved inventory mode.

#### Scenario: Inventory fetch failure aborts with error

- **WHEN** a scan runs in inventory mode and the inventory fetch fails
- **THEN** no badge-page requests are issued and the scan aborts with a visible error indicating the inventory scan failed

#### Scenario: Missing tradability data aborts instead of badge fallback

- **WHEN** a scan runs in inventory mode and tradability cannot be determined
- **THEN** the scan aborts with an explicit error rather than falling back to badge pages

#### Scenario: Badge-page mode unchanged when inventory scan disabled

- **WHEN** a scan runs with inventory scan disabled (badges mode, no active scan filters)
- **THEN** the scanner uses the badge-page flow as before
