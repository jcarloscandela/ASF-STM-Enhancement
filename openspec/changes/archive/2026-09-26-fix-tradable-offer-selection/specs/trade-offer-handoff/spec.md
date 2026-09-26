# Spec Delta

## MODIFIED Requirements

### Requirement: Offer selection prefers currently-tradable copies

The system SHALL, when planning the trade-offer moves for each requested card name, apply the same currently-tradable verdict as the scan (trade-state flag allows trading AND no future `Tradable After` hold, with unparseable dates failing open to the flag verdict), SHALL filter the live-inventory pool to currently-tradable copies before applying any ordering, SHALL consume one tradable copy per requested occurrence in request order (SORT: highest tradable id first; RANDOM: random index among tradable copies only), SHALL never move a held copy when a tradable copy of the same name exists, and SHALL report a shortfall only when zero tradable copies remain for that occurrence.

#### Scenario: Mixed held/tradable copies still fill the offer

- **WHEN** the user requests one copy of card A and the live offer pool holds three copies of A with two trade-held and one currently tradable
- **THEN** the planner selects the tradable copy, records no shortfall for that occurrence, and the offer proceeds

#### Scenario: Tradable copy with the lowest id still fills the offer under SORT

- **WHEN** the user requests one copy of card A and the pool holds two trade-held copies with higher ids and one currently-tradable copy with the lowest id
- **THEN** the planner selects the tradable copy, records no shortfall, and no held copy is moved

#### Scenario: Tradable copy with the lowest id still fills the offer under RANDOM

- **WHEN** the user requests one copy of card A and the pool holds two trade-held copies plus one currently-tradable copy, with RANDOM ordering
- **THEN** the random pick is drawn from tradable copies only, the tradable copy is selected, and no held copy is moved

#### Scenario: Fully-held name shortfalls with held reason

- **WHEN** every pool copy of a requested name is trade-held or a previous occurrence already consumed all tradable copies
- **THEN** the planner records one `unselectable` shortfall for that occurrence (present but not tradable right now) and contributes zero moves for it

#### Scenario: Absent name shortfalls with absent reason

- **WHEN** no pool item carries a requested name at all
- **THEN** the planner records one `absent` shortfall for that occurrence

#### Scenario: Reported 3-copy repro fills the single swap

- **WHEN** the user requests one copy of 72850-Troll (or any Card A) and the live pool holds three copies of that name with two temporally blocked and one currently tradable, requesting one swap (A for B)
- **THEN** the planner selects the tradable copy, records no shortfall, and the offer proceeds instead of aborting with `present but not tradable right now`

### Requirement: Offer retries present copies the metadata verdict rejects

The system SHALL, when a requested card name is present in the live trade inventory but no copy passes the metadata tradability verdict, attempt each present copy against the live trade in turn and keep only the copies the trade accepts, recording a shortfall only for requested occurrences no present copy could fill. The retry SHALL skip copies already consumed by the metadata plan, SHALL remove every trial move when any occurrence remains unfilled so a failed retry leaves zero net moves, and SHALL never leave a held copy in the trade when the trade rejects it.

#### Scenario: Metadata-held copy that Steam accepts still fills the offer

- **WHEN** the user requests one copy of card A, the pool holds three copies judged unselectable by metadata, and the live trade accepts the second copy attempted
- **THEN** that copy is kept in the offer, no shortfall is recorded for the occurrence, and the offer proceeds

#### Scenario: Copies Steam truly rejects still abort loudly

- **WHEN** no present copy of a requested name is accepted by the live trade
- **THEN** one `unselectable` shortfall is recorded for that occurrence and the offer aborts with zero items moved, as before

#### Scenario: Failed retry removes its trial moves

- **WHEN** the retry keeps some copies but at least one requested occurrence remains unfilled
- **THEN** every trial-kept copy is removed again so the offer is left empty rather than partial
