# Spec Delta

## ADDED Requirements

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
