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

The system SHALL only propose a card swap when it improves or preserves the user's badge state AND, for bots that do not accept any-cards trades, does not worsen the bot's badge state. For bots that accept any-cards trades, the bot-side fairness check SHALL be skipped.

#### Scenario: Unfair-to-bot swap is rejected

- **WHEN** a candidate swap would even out the user's badge but unbalance the bot's badge and the bot does not accept any-cards trades
- **THEN** no trade is proposed for that card pair

#### Scenario: ANY-mode bot accepts uneven swaps

- **WHEN** the bot accepts any-cards trades and the swap evens out the user's badge
- **THEN** the trade is proposed regardless of the bot-side balance effect

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

The pure matcher SHALL treat the user's per-card counts as two quantities: owned copies drive the badge state and the need checks (a card is requested only while its owned count is below the applicable set target), and currently tradable copies drive the give checks (a card is offered only while a tradable copy remains and the owned-surplus condition holds). Each proposed send SHALL decrement both the owned and the tradable count of the sent card, and each proposed receive SHALL increment both, so subsequent iterations reason about the post-trade state. When a card carries no tradable count, its tradable count SHALL equal its owned count. Badge state, bot-side fairness, per-game balance, and deterministic card ordering SHALL be unchanged.

#### Scenario: Never requests an owned card

- **WHEN** the user owns at least one copy of a card within a single-set badge - whether tradable or temporarily held - and the partner can send it
- **THEN** the matcher never pairs a surplus card against that card

#### Scenario: Offers stop at tradable capacity

- **WHEN** the user owns five copies of one card of which only one is currently tradable, one held copy of a second card, and zero copies of the remaining cards, and the partner holds two copies of every card
- **THEN** exactly one swap is proposed: the single tradable copy for one missing card, and the owned second card is not requested

#### Scenario: Full capacity fills every missing card

- **WHEN** the user owns five tradable copies of one card, one held copy of a second card, and zero copies of the remaining cards, and the partner holds two copies of every card
- **THEN** exactly three swaps are proposed, filling each of the three missing cards, and none requests the already-owned second card

#### Scenario: Missing tradable count falls back to owned count

- **WHEN** the matcher receives badges whose cards carry only owned counts
- **THEN** the offer capacity of each card equals its owned count, preserving the pre-change behavior for those badges

#### Scenario: Fair-bot mode keeps held cards out and caps offers at tradable capacity

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and zero copies of Cards B, C, and E, and a fair (non-ANY) partner holds two copies of every card
- **THEN** no proposed swap requests Card D, the total offered copies of Card A never exceed its tradable count, and every proposed swap keeps offered and requested counts balanced

#### Scenario: Multi-iteration accounting tracks the post-trade state

- **WHEN** the matcher proposes successive swaps within one badge
- **THEN** each send decrements both the owned and the tradable remainder of the sent card and each receive increments both of the received card, so later iterations never offer a copy that is no longer owned or no longer tradable
