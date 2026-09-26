# Spec Delta

## MODIFIED Requirements

### Requirement: Badge counts separate owned copies from tradable capacity

The scanner SHALL maintain, per card of the user's badges, both the owned copy count (all copies, as reported by the Steam badge page) and the currently tradable copy count (from the inventory scan when available). Set-progress decisions - badge state, set targets (`maxSets`/`lastSet`), whether a card is still needed, and the nothing-to-match badge filter - SHALL use owned counts, so a card the user already owns is never requested from a partner even when every owned copy is temporarily held. Offer decisions SHALL retain owned copies and cap at tradable copies: the number of copies offered of a card SHALL NOT exceed `offerable = max(min(tradable, owned − target), 0)`, where the target is the copies the badge must retain (one for first-set completion) - so the retained owned copies are never offered, while a tradable copy above the retained owned count is offerable even when every other owned copy is held. A card SHALL be offered only while it both owns more than the target (`owned > target`) and holds at least one currently-tradable copy (`tradable ≥ 1`). When tradability is unknown, the tradable count of a card SHALL equal its owned count (badge-page fallback), which collapses the formula back to the owned surplus, and the same rule SHALL apply. Each inventory asset SHALL resolve its tradability from the description carrying the same `classid` AND `instanceid` pair, so per-copy holds distinguish copies of one card; when no description carries the asset's pair but exactly one description shares its `classid`, that description SHALL apply; when several share the `classid` with no pair match, the last one SHALL apply as before.

#### Scenario: Owned-but-held card is not requested

- **WHEN** the user owns one copy of Card D that is temporarily trade-held, misses Cards B, C, and E, and a partner holds two copies of each card
- **THEN** no swap requests Card D; the proposed swaps only request cards with zero owned copies (B, C, and E)

#### Scenario: Offer count is capped at tradable copies

- **WHEN** the user owns five copies of Card A of which four are temporarily held (owned = 5, tradable = 1) and misses Cards B, C, and E
- **THEN** exactly one copy of Card A is offered across the badge's matches, producing exactly one swap, because the retained owned copy is covered by the held copies and the offered total never exceeds the tradable count of one

#### Scenario: Reported repro with three held copies yields one swap

- **WHEN** the user owns four copies of Card A of which three are temporarily held (owned = 4, tradable = 1, target = 1), owns zero copies of Cards B, C, D, and E, and a partner holds one copy of each card
- **THEN** exactly one swap is proposed (A offered for exactly one of B, C, D, or E), and no held copy appears on the offered side

#### Scenario: Fully tradable surplus fills every missing card

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and misses Cards B, C, and E, and a partner holds two copies of each
- **THEN** the matcher proposes exactly three swaps (A to B, A to C, A to E) and none of them requests Card D

#### Scenario: Held copies above the retained copy still yield their surplus

- **WHEN** the user owns four copies of Card A of which two are temporarily held (owned = 4, tradable = 2, target = 1), one copy each of two other cards, and zero copies of the remaining cards, and a partner holds two copies of every card
- **THEN** exactly two copies of Card A are offered across the badge's matches, producing exactly two swaps, and no held copy is ever offered

#### Scenario: Unknown tradability falls back to owned counts

- **WHEN** tradability data is unavailable for a badge (failed lookup or badge-page mode)
- **THEN** each card's tradable count equals its owned count, its offerable surplus equals the owned copies in excess of the applicable set target, and matching proceeds exactly as the badge-page scan always has for that owned-count distribution

#### Scenario: Fair-bot matching keeps held cards out and respects tradable capacity

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and zero copies of Cards B, C, and E, and a fair (non-ANY) partner holds two copies of every card
- **THEN** no proposed swap requests Card D, the total offered copies of Card A never exceed five, and every match row shows exactly the cards its generated offer will exchange

#### Scenario: Per-copy holds resolve per description pair

- **WHEN** two descriptions share one `classid` with distinct `instanceid`s and mixed tradability verdicts, and one asset matches each pair
- **THEN** each asset counts with its own pair's verdict (owned 2, tradable 1), so a held copy never inflates the tradable count nor masks the tradable copy

#### Scenario: Lone description covers a pair-mismatched asset

- **WHEN** an asset's `instanceid` matches no description pair but exactly one description shares its `classid`
- **THEN** the asset counts with that description's verdict, preserving the previous count behavior for payloads without per-copy descriptions
