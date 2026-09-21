# Spec Delta

## Purpose

Defines the pure, side-effect-free trade-matching rules that decide which cards the user offers and receives, so matching logic can be unit-tested without a browser or network.

## ADDED Requirements

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
