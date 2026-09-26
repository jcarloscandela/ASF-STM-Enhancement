# Spec Delta

## ADDED Requirements

### Requirement: Offer selection prefers currently-tradable copies

The system SHALL, when planning the trade-offer moves for each requested card name, consider only currently-tradable live-inventory copies (trade-state flag allows trading AND no future `Tradable After` hold) as selectable, SHALL consume one tradable copy per requested occurrence in request order (SORT: highest id first; RANDOM: random index), and SHALL report a shortfall only when no tradable copy remains for that occurrence.

#### Scenario: Mixed held/tradable copies still fill the offer

- **WHEN** the user requests one copy of card A and the live offer pool holds three copies of A with two trade-held and one currently tradable
- **THEN** the planner selects the tradable copy, records no shortfall for that occurrence, and the offer proceeds

#### Scenario: Fully-held name shortfalls with held reason

- **WHEN** every pool copy of a requested name is trade-held or a previous occurrence already consumed all tradable copies
- **THEN** the planner records one `unselectable` shortfall for that occurrence (present but not tradable right now) and contributes zero moves for it

#### Scenario: Absent name shortfalls with absent reason

- **WHEN** no pool item carries a requested name at all
- **THEN** the planner records one `absent` shortfall for that occurrence
