# Spec Delta

## MODIFIED Requirements

### Requirement: Only tradable cards participate in matching

The system SHALL exclude non-tradable (trade-held) card copies from the offered side of matches and from offer capacity, so offered trades never rely on cards Steam would omit from the trade offer. Held copies SHALL still count as owned copies for set-progress and request decisions: owning a card - even only as currently held copies - satisfies the need for that card, so partners are never asked for it. A copy whose trade availability starts at a future date ("Tradable After" in the future) SHALL count as non-tradable for offering until that date passes; only copies currently tradable at scan time can be offered.

#### Scenario: Trade-held copies are excluded from owned counts

- **WHEN** a card the user owns has some copies flagged non-tradable in the inventory response
- **THEN** only the tradable copies are available to offer, and no held copy is offered or displayed on the offered side of a match

#### Scenario: Owned-but-held copies satisfy the need for that card

- **WHEN** every copy the user owns of a card is currently trade-held but the owned count meets the applicable set target
- **THEN** the scanner does not request that card from partners, and owned-set progress counts those held copies

#### Scenario: Fully held games yield no matches

- **WHEN** all copies of a game's cards relevant to a match are non-tradable
- **THEN** no match row is produced for that game based on held cards

#### Scenario: Tradability flag is interpreted correctly

- **WHEN** an inventory description carries the current trade-state flag as false, zero, or the string zero
- **THEN** its copies are treated as non-tradable, while descriptions without that negative signal are treated as tradable, and the fixed post-market cooldown field is never used as a tradability signal

#### Scenario: Future-dated trade holds are excluded until their date passes

- **WHEN** an owned card carries a "Tradable After" timestamp in the future (e.g. 26/09/2026, 09:00:00, as seen on the Alyx Vance Half-Life 2 card)
- **THEN** its copies cannot be offered while the timestamp is in the future, but they still count as owned copies for set-progress and request decisions; once the timestamp is in the past the same copies count as tradable (subject to the trade-state flag)

#### Scenario: Foil and non-card items stay excluded

- **WHEN** inventory contains foil cards or non-card items
- **THEN** they remain excluded from badge eligibility and matching exactly as before
