# Spec Delta

## MODIFIED Requirements

### Requirement: Non-tradable cards are excluded from matching

The scanner SHALL determine the tradability of each owned card from the Steam inventory response and SHALL treat copies that are not currently tradable (trade-held) as unavailable to be offered in a trade. "Not currently tradable" includes copies flagged by the current trade-state signal AND copies whose "Tradable After" timestamp is in the future at scan time. Held copies remain owned cards for set-progress and request decisions, but SHALL never be selected as cards to send, in every scan mode: the inventory scan, the legacy badge-page scan, and scan filters.

#### Scenario: Trade-held cards are excluded during inventory scan

- **WHEN** the inventory scan fetches an inventory containing both tradable and trade-held copies of a card
- **THEN** only the tradable copies are available to offer, and no held copy appears on the offered side of any match row

#### Scenario: Trade-held cards are excluded during badge-page scan

- **WHEN** the user runs a scan with the inventory scan disabled or with scan filters
- **THEN** the scanner still obtains tradability information where available and omits trade-held cards from the offered side of match rows

#### Scenario: A match that would require offering a held card is not produced

- **WHEN** the only surplus copies the user could offer for a badge are trade-held
- **THEN** no match is generated for that badge and no offer is created with an empty user side

#### Scenario: Future-dated holds are excluded in every scan mode

- **WHEN** an owned card (e.g. Alyx Vance, Half-Life 2) carries a "Tradable After" date in the future at scan time
- **THEN** that copy cannot be offered in inventory, badge-page, or scan-filter modes until the date has passed, while it still counts as an owned copy for set-progress and request decisions

## REMOVED Requirements

### Requirement: Badge eligibility and match counts use tradable copies only

**Reason**: The requirement conflated "owned" with "currently tradable". Counting held copies as zero made the matcher request duplicates of cards the user already owns (wasting a swap that should fill a missing card) and made inventory mode drop badges whose only tradable surplus could still fund a missing card.

**Migration**: Replaced by "Badge counts separate owned copies from tradable capacity" (below): set progress and requests use owned copies; offer capacity uses currently tradable copies.

## ADDED Requirements

### Requirement: Badge counts separate owned copies from tradable capacity

The scanner SHALL maintain, per card of the user's badges, both the owned copy count (all copies, as reported by the Steam badge page) and the currently tradable copy count (from the inventory scan when available). Set-progress decisions - badge state, set targets (`maxSets`/`lastSet`), whether a card is still needed, and the nothing-to-match badge filter - SHALL use owned counts, so a card the user already owns is never requested from a partner even when every owned copy is temporarily held. Offer decisions SHALL use tradable counts: the number of copies offered of a card SHALL NOT exceed its currently tradable count. When tradability is unknown, the tradable count of a card SHALL equal its owned count (badge-page fallback).

#### Scenario: Owned-but-held card is not requested

- **WHEN** the user owns one copy of Card D that is temporarily trade-held, misses Cards B, C, and E, and a partner holds two copies of each card
- **THEN** no swap requests Card D; the proposed swaps only request cards with zero owned copies (B, C, and E)

#### Scenario: Offer count is capped at tradable copies

- **WHEN** the user owns five copies of Card A of which four are temporarily held, and misses Cards B, C, and E
- **THEN** exactly one copy of Card A is offered across the badge's matches, producing exactly one swap

#### Scenario: Fully tradable surplus fills every missing card

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and misses Cards B, C, and E, and a partner holds two copies of each
- **THEN** the matcher proposes exactly three swaps (A to B, A to C, A to E) and none of them requests Card D

#### Scenario: Unknown tradability falls back to owned counts

- **WHEN** tradability data is unavailable for a badge (failed lookup or badge-page mode)
- **THEN** the offer capacity of each card equals its owned count and matching behaves as the badge-page scan always has

### Requirement: Match rows display only the exchanged cards

Match rows SHALL display, per side, exactly the cards the generated offer will exchange: the offered side shows the currently tradable copies that will be sent (never a held copy), and the requested side shows only cards the user does not already own within the applicable set targets.

#### Scenario: Offered icons exclude held copies

- **WHEN** a match offers one of five owned copies of Card A because four copies are held
- **THEN** the match row shows a single Card A icon on the offered side

#### Scenario: Requested icons exclude already-owned cards

- **WHEN** a partner owns two copies of Card D and the user already owns Card D
- **THEN** the requested side of the match row contains no Card D icon even though the partner could send it

### Requirement: Inventory-mode eligibility includes badges that can complete sets

In inventory mode, badge eligibility SHALL treat a badge as a matching candidate not only when its tradable copies are unevenly distributed, but also when the badge has cards with no tradable copies while at least one other card of the same badge has a tradable copy - such a badge may still complete a set by trading the tradable duplicate. Badges with no tradable copies at all SHALL remain excluded.

#### Scenario: Missing-card badge with a tradable duplicate is scanned

- **WHEN** a badge has one tradable copy of Card A, no tradable copies of the remaining cards, and the user owns held copies of some of them
- **THEN** the badge is included in the candidate badge list and proceeds to per-card detail

#### Scenario: Badge with no tradable copies stays excluded

- **WHEN** every card copy of a badge is currently trade-held
- **THEN** the badge is not included in the candidate badge list
