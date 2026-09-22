# Spec Delta

## MODIFIED Requirements

### Requirement: Badge counts separate owned copies from tradable capacity

The scanner SHALL maintain, per card of the user's badges, both the owned copy count (all copies, as reported by the Steam badge page) and the currently tradable copy count (from the inventory scan when available). Set-progress decisions - badge state, set targets (`maxSets`/`lastSet`), whether a card is still needed, and the nothing-to-match badge filter - SHALL use owned counts, so a card the user already owns is never requested from a partner even when every owned copy is temporarily held. Offer decisions SHALL use tradable counts: the number of copies offered of a card SHALL NOT exceed its tradable copies in excess of the applicable set target - `surplus = max(tradable − target, 0)`, where the target is the copies the badge must retain (one for first-set completion) - so the retained copies are never offered even when further owned copies are held. A card whose tradable count does not exceed the target SHALL NOT be offered at all. When tradability is unknown, the tradable count of a card SHALL equal its owned count (badge-page fallback) and the same surplus rule SHALL apply.

#### Scenario: Owned-but-held card is not requested

- **WHEN** the user owns one copy of Card D that is temporarily trade-held, misses Cards B, C, and E, and a partner holds two copies of each card
- **THEN** no swap requests Card D; the proposed swaps only request cards with zero owned copies (B, C, and E)

#### Scenario: Offer count is capped at tradable copies

- **WHEN** the user owns five copies of Card A of which four are temporarily held (tradable = 1) and misses Cards B, C, and E
- **THEN** zero copies of Card A are offered across the badge's matches and no swap is proposed for the badge, because the single tradable copy is the retained copy and the surplus above the target is zero

#### Scenario: Fully tradable surplus fills every missing card

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and misses Cards B, C, and E, and a partner holds two copies of each
- **THEN** the matcher proposes exactly three swaps (A to B, A to C, A to E) and none of them requests Card D

#### Scenario: Held copies above the retained copy still yield their surplus

- **WHEN** the user owns four copies of Card A of which two are temporarily held (tradable = 2, surplus = 1 above the retained copy), one copy each of two other cards, and zero copies of the remaining cards, and a partner holds two copies of every card
- **THEN** exactly one copy of Card A is offered across the badge's matches, producing exactly one swap, and the remaining tradable copy is never offered

#### Scenario: Unknown tradability falls back to owned counts

- **WHEN** tradability data is unavailable for a badge (failed lookup or badge-page mode)
- **THEN** each card's tradable count equals its owned count, its offerable surplus equals the owned copies in excess of the applicable set target, and matching proceeds exactly as the badge-page scan always has for that owned-count distribution

#### Scenario: Fair-bot matching keeps held cards out and respects tradable capacity

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and zero copies of Cards B, C, and E, and a fair (non-ANY) partner holds two copies of every card
- **THEN** no proposed swap requests Card D, the total offered copies of Card A never exceed five, and every match row shows exactly the cards its generated offer will exchange

### Requirement: Inventory-mode eligibility includes badges that can complete sets

In inventory mode, badge eligibility SHALL mark a badge as a matching candidate only when BOTH of the following hold: at least one receivable slot exists (a card whose owned count is below the applicable set target; missing cards count as zero owned copies) AND at least one offerable slot exists (a card whose currently tradable copies exceed the applicable set target, i.e. `max(tradable − target, 0) > 0`). A badge SHALL be excluded when it is already complete (no card below the target), when the user owns no cards of the badge, when missing cards exist but no card has tradable surplus above the target, and when every duplicate is at or below the retained target (including all-held badges). When tradability is unknown for a badge, tradable counts equal owned counts for this check.

#### Scenario: Missing-card badge with a tradable duplicate is scanned

- **WHEN** a badge is missing cards, owns at least two currently tradable copies of one card (a duplicate above the retained target), and the user owns held copies of some other cards
- **THEN** the badge is included in the candidate badge list and proceeds to bot matching

#### Scenario: Badge with no tradable copies stays excluded

- **WHEN** every card copy of a badge is currently trade-held
- **THEN** the badge is not included in the candidate badge list

#### Scenario: Last tradable copy leaves nothing to offer

- **WHEN** a badge misses cards and owns five copies of one card of which only one is currently tradable, with the applicable set target retaining one copy (surplus = 0)
- **THEN** the badge is not included in the candidate badge list and no partner check is issued for it

#### Scenario: Owned-count unbalance drives eligibility

- **WHEN** a badge's owned copies are distributed unevenly across its cards so that at least one card sits below the applicable set target and at least one duplicate sits above it (e.g. five copies of one card, one of another, none of the rest)
- **THEN** the badge is a candidate as long as the duplicate's surplus copy is currently tradable above the retained target; an uneven distribution whose duplicates are all at or below the retained target, or whose surplus is entirely held, is NOT a candidate

### Requirement: Badges with no tradable path to a swap are never checked

The system SHALL determine from a badge's own slots alone — owned counts, currently tradable counts, and set targets — whether any swap is possible regardless of any partner's cards. A swap requires both a receivable card (a slot below the copies needed to complete the badge's current sets) and an offerable copy (a slot whose currently tradable copies strictly exceed the copies needed to complete the badge's current sets — the retained copies are never offerable). WHEN no such receive/offer pair can exist for any partner, the badge SHALL be treated as unable to trade. WHEN tradability is unknown for a badge, tradable capacity SHALL equal owned counts, so the check behaves exactly as the owned-count distribution requires.

#### Scenario: Complete set needs nothing

- **WHEN** the user owns exactly one copy of every card of a badge
- **THEN** the badge is unable to trade (nothing to receive) and no partner check is issued for it

#### Scenario: Empty badge needs nothing offerable

- **WHEN** the user owns zero copies of every card of a badge
- **THEN** the badge is unable to trade (nothing to offer) and no partner check is issued for it

#### Scenario: Incomplete badge without duplicates needs nothing offerable

- **WHEN** the user owns single copies of some cards of a badge and zero of the rest (e.g. one copy each of three cards, zero of two)
- **THEN** the badge is unable to trade (nothing to offer) and no partner check is issued for it

#### Scenario: Complete badge with a single spare needs nothing receivable

- **WHEN** the user owns a complete set plus exactly one spare copy (e.g. two copies of one card, one of each remaining card)
- **THEN** the badge is unable to trade (nothing to receive) and no partner check is issued for it

#### Scenario: Duplicate with gaps is checked

- **WHEN** the user owns two currently tradable copies of one card - a spare above the retained copy - and misses other cards of the badge (e.g. two copies of one card, one of two others, zero of two)
- **THEN** the badge is able to trade and partner checks are issued for it

#### Scenario: Extra spare toward a further set is checked

- **WHEN** the user owns a complete set plus more than one spare copy of a card (e.g. three copies of one card, one of each remaining card)
- **THEN** the badge is able to trade and partner checks are issued for it

#### Scenario: Trade-held duplicate removes the offer path

- **WHEN** the only spare copies above the set targets are currently trade-held (e.g. two owned copies of one card with zero tradable, single copies elsewhere, gaps unfilled)
- **THEN** the badge is unable to trade and no partner check is issued for it

#### Scenario: Single tradable copy among duplicates leaves no path

- **WHEN** the user owns two copies of one card of which only one is currently tradable (the retained copy, surplus = 0), with single or zero copies elsewhere and gaps still unfilled
- **THEN** the badge is unable to trade and no partner check is issued for it

#### Scenario: Unknown tradability falls back to owned counts

- **WHEN** tradability data is unavailable for a badge with a duplicate and gaps
- **THEN** the badge is judged by owned counts alone and partner checks are issued for it
