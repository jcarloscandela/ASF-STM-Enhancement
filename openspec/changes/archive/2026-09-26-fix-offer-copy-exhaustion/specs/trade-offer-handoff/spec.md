# Spec Delta

## MODIFIED Requirements

### Requirement: Live-inventory shortfall names the missing cards

The system SHALL report, in the visible failure dialog and the debug log, each requested card the live trade inventory could not supply, naming the side, the market-hash name, and the reason the copy could not be supplied: `absent` when no pool item carries the name, `unselectable` when copies are present but every unconsumed copy is trade-held or otherwise untradable, and `exhausted` when tradable copies existed but earlier occurrences of the same offer already consumed them all.

#### Scenario: Missing user-side cards are named

- **WHEN** the user's live inventory cannot supply every requested send card
- **THEN** the dialog lists each unsupplied send-card name with its absent-vs-unselectable-vs-exhausted reason instead of only naming the Params storage key

#### Scenario: Missing partner-side cards are named

- **WHEN** the partner's live inventory cannot supply every requested receive card
- **THEN** the dialog lists each unsupplied receive-card name with its absent-vs-unselectable-vs-exhausted reason

#### Scenario: Exhausted second occurrence is not reported as held

- **WHEN** the user requests two copies of 252010-Geist and the live pool holds one tradable copy that the first occurrence consumes
- **THEN** the second occurrence is reported as `exhausted` (with requested, pool-tradable, and already-allocated counts), never as `present but not tradable right now`

### Requirement: Offer selection prefers currently-tradable copies

The system SHALL, when planning the trade-offer moves for each requested card name, apply the same currently-tradable verdict as the scan (trade-state flag allows trading AND no future `Tradable After` hold, with unparseable dates failing open to the flag verdict), SHALL filter the live-inventory pool to currently-tradable copies before applying any ordering, SHALL consume one tradable copy per requested occurrence in request order (SORT: highest tradable id first; RANDOM: random index among tradable copies only), SHALL never move a held copy when a tradable copy of the same name exists, and SHALL report a shortfall only when zero unconsumed tradable copies remain for that occurrence. An occurrence that finds no remaining copy only because earlier occurrences of the same offer consumed them all SHALL be recorded as `exhausted`, not `unselectable`.

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

- **WHEN** every pool copy of a requested name is trade-held, so no tradable copy was ever available to this offer
- **THEN** the planner records one `unselectable` shortfall for that occurrence (present but not tradable right now) and contributes zero moves for it

#### Scenario: Absent name shortfalls with absent reason

- **WHEN** no pool item carries a requested name at all
- **THEN** the planner records one `absent` shortfall for that occurrence

#### Scenario: Reported 3-copy repro fills the single swap

- **WHEN** the user requests one copy of 72850-Troll (or any Card A) and the live pool holds three copies of that name with two temporally blocked and one currently tradable, requesting one swap (A for B)
- **THEN** the planner selects the tradable copy, records no shortfall, and the offer proceeds instead of aborting with `present but not tradable right now`

#### Scenario: Twice-requested single copy exhausts the second occurrence

- **WHEN** the user requests two copies of one card name and the live pool holds exactly one tradable copy of it
- **THEN** the first occurrence consumes that copy with no shortfall, and the second occurrence is recorded as `exhausted` with zero moves

### Requirement: Shortfalls carry per-copy diagnostics

The system SHALL attach to every `unselectable` shortfall the diagnostic facts needed to explain the divergence: how many pool copies carried the name, which `tradable` flag values were seen, any parsed `Tradable After` hold dates, and the scan-time tradable count for that card when available. Every `exhausted` shortfall SHALL instead carry occurrence-aware facts: the occurrence index within the request order, how many tradable pool copies existed, and how many this offer already allocated. The debug log SHALL always carry the full record; the visible dialog SHALL keep naming side, card, and reason plus rescan guidance.

#### Scenario: Next occurrence is diagnosable from the log

- **WHEN** an `unselectable` shortfall is recorded for a card the scan counted as tradable
- **THEN** the debug log shows per-copy flag values, parsed hold dates, and the scan-time tradable count, identifying whether the pool, the verdict, or a stale scan diverged

#### Scenario: Exhausted occurrence is diagnosable from the log

- **WHEN** an `exhausted` shortfall is recorded for the second requested copy of a single-copy pool card
- **THEN** the debug log shows the occurrence index, the tradable pool-copy count, and the already-allocated count, identifying the double request rather than a hold

## ADDED Requirements

### Requirement: Offer planning waits for complete live inventories

The system SHALL NOT plan trade-offer moves until both sides' live trade inventories are fully loaded, and SHALL treat a partially loaded inventory as not-ready (continuing to poll) rather than planning against an incomplete pool that would manufacture exhaustion shortfalls for copies present on unloaded pages.

#### Scenario: Partial inventory delays planning instead of shortfalling

- **WHEN** the offer page opens with one side's trade inventory still loading further pages
- **THEN** no selection is planned and no shortfall is recorded until both inventories report fully loaded, after which planning proceeds against the complete pools
