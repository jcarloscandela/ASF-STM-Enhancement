# Spec Delta

## MODIFIED Requirements

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
