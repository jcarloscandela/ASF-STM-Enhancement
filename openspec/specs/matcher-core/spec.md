# matcher-core

## Purpose

Defines the pure, side-effect-free trade-matching rules that decide which cards the user offers and receives, so matching logic can be unit-tested without a browser or network.

## Requirements

### Requirement: Badge completion state drives matching

The system SHALL classify each badge into one of three states — needs more sets, has max sets but can still even out, or fully even (nothing to do) — derived from per-card counts, and SHALL only propose trades that move a badge toward the even state.

#### Scenario: Even badge produces no trades

- **WHEN** every card in a badge has the same count
- **THEN** no trade is proposed for that badge

#### Scenario: Uneven badge proposes evening trades

- **WHEN** a badge has surplus copies of one card and a deficit of another within the same set
- **THEN** a trade offering the surplus card for the deficit card is proposed

### Requirement: Matches stay fair for both sides unless ANY mode applies

The system SHALL only propose a card swap when it improves or preserves the user's badge state AND the partner can give the card they would send under the mode that applies to that partner. For bots that accept any-cards trades (ANY mode), the partner give condition SHALL be ownership alone: a partner may give a card whenever they own at least one copy (`owned > 0`), including their last copy. For ANY-mode partners the matcher SHALL NOT evaluate the partner's badge state — their surplus, their missing cards, their badge completeness, and their post-trade badge state SHALL NOT influence the decision — and a swap SHALL NOT be refused because the partner would be left without the card or would end with duplicates of the card the user sends. For bots that do not accept any-cards trades, the partner SHALL be able to safely part with the card they give — their currently tradable count for that card, falling back to their owned count when their tradability is unknown, SHALL be greater than one, so the partner always retains at least one copy — and the swap SHALL NOT worsen the bot's badge state.

#### Scenario: Unfair-to-bot swap is rejected

- **WHEN** a candidate swap would even out the user's badge but unbalance the bot's badge and the bot does not accept any-cards trades
- **THEN** no trade is proposed for that card pair

#### Scenario: ANY-mode bot accepts uneven swaps

- **WHEN** the bot accepts any-cards trades and the swap evens out the user's badge
- **THEN** the trade is proposed regardless of the bot-side balance effect

#### Scenario: A partner's last copy is never taken

- **WHEN** a partner that does not accept any-cards trades owns exactly one copy of a card the user needs (partner tradability unknown, so their owned count applies)
- **THEN** no proposed trade takes that card from the partner — this protection now applies to fair partners only, with ANY-mode partners covered by the takeable case below

#### Scenario: An ANY-mode partner's last copy can be taken

- **WHEN** the user needs a card and holds offerable surplus, and an any-cards partner owns exactly one copy of that needed card
- **THEN** the trade is proposed even though the partner is left with zero copies of the card

#### Scenario: ANY-mode matching ignores the partner's post-trade badge state

- **WHEN** a proposed swap would give an any-cards partner duplicates of the card the user sends while taking their only copy of a card the user needs (the partner would end with three copies of one card and none of the other)
- **THEN** the trade is still proposed, because the partner's resulting badge is not part of the decision

### Requirement: Offered and requested cards always balance per game

The system SHALL produce, for each matched game, equal counts of offered and requested cards, and SHALL record the match as market-hash references resolvable on the trade-offer page. A mismatch in game IDs or card counts between the two sides SHALL be treated as an error, never as a partial offer.

#### Scenario: Balanced match records both sides

- **WHEN** a match is found for a game
- **THEN** the stored match lists the same number of offered and requested cards for that game

#### Scenario: App-ID mismatch is rejected

- **WHEN** the offered and requested sides reference different game IDs
- **THEN** the match is rejected rather than stored

### Requirement: Matching is deterministic and equivalent across implementations

The system SHALL produce the same match sets as the current userscript for identical inputs (user badges, bot badges, bot flags), with cards processed in a defined sorted order so repeated runs agree.

#### Scenario: Identical inputs give identical matches

- **WHEN** matching runs twice over the same badge and bot data
- **THEN** both runs produce the same offered/requested card sets

### Requirement: Requests respect owned need and offers respect tradable capacity

The pure matcher SHALL treat the user's per-card counts as two quantities: owned copies drive the badge state and the need checks (a card is requested only while its owned count is below the applicable set target), and owned surplus capped by tradable copies drives the give checks. A card SHALL be offered only while it owns more than the applicable set target (`owned > target`) AND at least one copy is currently tradable (`tradable ≥ 1`) — the offerable surplus is `max(min(tradable, owned − target), 0)` — so the copies the badge must retain (one for first-set completion, `maxSets`/`lastSet` for later sets) are never spent, while a tradable copy above the retained owned count is offerable even when every other owned copy is held. Each proposed send SHALL decrement both the owned and the tradable count of the sent card, and each proposed receive SHALL increment both, so subsequent iterations of one planning pass reason about the post-trade state. When a card carries no tradable count, its tradable count SHALL equal its owned count before the surplus rule is applied. Badge state, bot-side fairness, per-game balance, and deterministic card ordering SHALL be unchanged.

#### Scenario: Never requests an owned card

- **WHEN** the user owns at least one copy of a card within a single-set badge - whether tradable or temporarily held - and the partner can send it
- **THEN** the matcher never pairs a surplus card against that card

#### Scenario: Offers stop at tradable capacity

- **WHEN** the user owns five copies of one card of which only one is currently tradable (owned = 5, tradable = 1), one held copy of a second card, and zero copies of the remaining cards, the applicable set target retains one copy, and the partner holds two copies of every card
- **THEN** exactly one swap is proposed, offering the single tradable copy while the retained owned copy stays covered by the held copies, and offers stop there: the owned second card is not requested and no further copy is offered once the tradable remainder is exhausted

#### Scenario: Full capacity fills every missing card

- **WHEN** the user owns five tradable copies of one card, one held copy of a second card, and zero copies of the remaining cards, and the partner holds two copies of every card
- **THEN** exactly three swaps are proposed, filling each of the three missing cards, and none requests the already-owned second card

#### Scenario: Partial surplus above the retained copy yields exactly that many swaps

- **WHEN** the user owns four copies of one card of which two are temporarily held (owned = 4, tradable = 2, target = 1), one copy each of two other cards, and zero copies of the remaining cards, and the partner holds two copies of every card
- **THEN** exactly two swaps are proposed, drawing on that card's two tradable copies, and no held copy is ever offered

#### Scenario: Missing tradable count falls back to owned count

- **WHEN** the matcher receives badges whose cards carry only owned counts
- **THEN** each card's tradable count equals its owned count and its offerable surplus equals the owned copies in excess of the applicable set target, preserving the give behavior those badges always had for that owned-count distribution

#### Scenario: Fair-bot mode keeps held cards out and caps offers at tradable capacity

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and zero copies of Cards B, C, and E, and a fair (non-ANY) partner holds two copies of every card
- **THEN** no proposed swap requests Card D, the total offered copies of Card A never exceed its tradable count, and every proposed swap keeps offered and requested counts balanced

#### Scenario: Multi-iteration accounting tracks the post-trade state

- **WHEN** the matcher proposes successive swaps within one badge during a single planning pass
- **THEN** each send decrements both the owned and the tradable remainder of the sent card and each receive increments both of the received card, so later iterations never offer a copy that is no longer owned or no longer tradable
