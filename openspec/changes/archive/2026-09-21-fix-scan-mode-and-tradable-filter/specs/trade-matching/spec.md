# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Trade-offer creation only adds currently-tradable copies

The system SHALL, when building a trade offer on the Steam trade-offer page, select only copies that are currently tradable at offer time. Held copies (trade-state negative or future "Tradable After") SHALL be skipped during item selection; if a requested card has no currently-tradable copy in the live trade inventory, the offer flow SHALL surface the existing missing-items abort instead of substituting a held copy.

#### Scenario: Held copy is skipped when adding cards to the offer

- **WHEN** the user opens a generated match on the trade-offer page and the live inventory contains both a held copy and a tradable copy of a requested card
- **THEN** only the tradable copy is moved into the trade, and the held copy is left in the inventory

#### Scenario: All copies held aborts instead of offering untradable cards

- **WHEN** every live-inventory copy of a requested card is currently untradable (including future-dated holds)
- **THEN** the missing-items abort is shown and no held card is added to the offer
