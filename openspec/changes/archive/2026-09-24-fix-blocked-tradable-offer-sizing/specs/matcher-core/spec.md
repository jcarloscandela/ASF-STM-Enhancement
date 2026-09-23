# Spec Delta

## MODIFIED Requirements

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
