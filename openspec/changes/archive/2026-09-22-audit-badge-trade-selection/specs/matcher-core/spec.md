# Spec Delta

## MODIFIED Requirements

### Requirement: Requests respect owned need and offers respect tradable capacity

The pure matcher SHALL treat the user's per-card counts as two quantities: owned copies drive the badge state and the need checks (a card is requested only while its owned count is below the applicable set target), and currently tradable copies drive the give checks. A card SHALL be offered only while its currently tradable copies exceed the applicable set target — the offerable surplus is `max(tradable − target, 0)` — so the copies the badge must retain (one for first-set completion, `maxSets`/`lastSet` for later sets) are never spent, even when further owned copies exist only as held copies. A card whose tradable count does not exceed the target SHALL NOT be offered at all. Each proposed send SHALL decrement both the owned and the tradable count of the sent card, and each proposed receive SHALL increment both, so subsequent iterations of one planning pass reason about the post-trade state. When a card carries no tradable count, its tradable count SHALL equal its owned count before the surplus rule is applied. Badge state, bot-side fairness, per-game balance, and deterministic card ordering SHALL be unchanged.

#### Scenario: Never requests an owned card

- **WHEN** the user owns at least one copy of a card within a single-set badge - whether tradable or temporarily held - and the partner can send it
- **THEN** the matcher never pairs a surplus card against that card

#### Scenario: Offers stop at tradable capacity

- **WHEN** the user owns five copies of one card of which only one is currently tradable, one held copy of a second card, and zero copies of the remaining cards, the applicable set target retains one copy, and the partner holds two copies of every card
- **THEN** no swap is proposed at all: the single tradable copy is the retained copy (surplus = 0), so the offer capacity is zero, and the owned second card is not requested

#### Scenario: Full capacity fills every missing card

- **WHEN** the user owns five tradable copies of one card, one held copy of a second card, and zero copies of the remaining cards, and the partner holds two copies of every card
- **THEN** exactly three swaps are proposed, filling each of the three missing cards, and none requests the already-owned second card

#### Scenario: Partial surplus above the retained copy yields exactly that many swaps

- **WHEN** the user owns four copies of one card of which two are temporarily held (tradable = 2, surplus = 1 above the retained copy), one copy each of two other cards, and zero copies of the remaining cards, and the partner holds two copies of every card
- **THEN** exactly one swap is proposed, drawing on that card's single surplus copy, and the remaining tradable copy is never offered

#### Scenario: Missing tradable count falls back to owned count

- **WHEN** the matcher receives badges whose cards carry only owned counts
- **THEN** each card's tradable count equals its owned count and its offerable surplus equals the owned copies in excess of the applicable set target, preserving the give behavior those badges always had for that owned-count distribution

#### Scenario: Fair-bot mode keeps held cards out and caps offers at tradable capacity

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and zero copies of Cards B, C, and E, and a fair (non-ANY) partner holds two copies of every card
- **THEN** no proposed swap requests Card D, the total offered copies of Card A never exceed its tradable count, and every proposed swap keeps offered and requested counts balanced

#### Scenario: Multi-iteration accounting tracks the post-trade state

- **WHEN** the matcher proposes successive swaps within one badge during a single planning pass
- **THEN** each send decrements both the owned and the tradable remainder of the sent card and each receive increments both of the received card, so later iterations never offer a copy that is no longer owned or no longer tradable

### Requirement: Matches stay fair for both sides unless ANY mode applies

The system SHALL only propose a card swap when it improves or preserves the user's badge state AND the partner can safely part with the card they give: the partner's currently tradable count for that card — falling back to their owned count when their tradability is unknown — SHALL be greater than one, so the partner always retains at least one copy. This partner-retain rule SHALL apply to every partner, including bots that accept any-cards trades. Additionally, for bots that do not accept any-cards trades, the swap SHALL NOT worsen the bot's badge state; for bots that accept any-cards trades only that relative-fairness check SHALL be skipped, while the partner-retain rule still applies.

#### Scenario: Unfair-to-bot swap is rejected

- **WHEN** a candidate swap would even out the user's badge but unbalance the bot's badge and the bot does not accept any-cards trades
- **THEN** no trade is proposed for that card pair

#### Scenario: ANY-mode bot accepts uneven swaps

- **WHEN** the bot accepts any-cards trades and the swap evens out the user's badge
- **THEN** the trade is proposed regardless of the bot-side balance effect

#### Scenario: A partner's last copy is never taken

- **WHEN** a partner owns exactly one copy of a card the user needs (partner tradability unknown, so their owned count applies), even though the bot accepts any-cards trades
- **THEN** no proposed trade takes that card from the partner
