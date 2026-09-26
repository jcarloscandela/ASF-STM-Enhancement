# Spec Delta

## ADDED Requirements

### Requirement: Offer retries present copies the metadata verdict rejects

The system SHALL, when a requested card name is present in the live trade inventory but no copy passes the metadata tradability verdict, attempt each present copy against the live trade in turn and keep the copies the trade accepts, recording a shortfall only for requested occurrences no present copy could fill.

#### Scenario: Metadata-held copy that Steam accepts still fills the offer

- **WHEN** the user requests one copy of card A, the pool holds three copies judged unselectable by metadata, and the live trade accepts the second copy attempted
- **THEN** that copy is kept in the offer, no shortfall is recorded for the occurrence, and the offer proceeds

#### Scenario: Copies Steam truly rejects still abort loudly

- **WHEN** no present copy of a requested name is accepted by the live trade
- **THEN** one `unselectable` shortfall is recorded for that occurrence and the offer aborts with zero items moved, as before

### Requirement: Shortfalls carry per-copy diagnostics

The system SHALL attach to every `unselectable` shortfall the diagnostic facts needed to explain the divergence: how many pool copies carried the name, which `tradable` flag values were seen, any parsed `Tradable After` hold dates, and the scan-time tradable count for that card when available. The debug log SHALL always carry the full record; the visible dialog SHALL keep naming side, card, and reason plus rescan guidance.

#### Scenario: Next occurrence is diagnosable from the log

- **WHEN** an `unselectable` shortfall is recorded for a card the scan counted as tradable
- **THEN** the debug log shows per-copy flag values, parsed hold dates, and the scan-time tradable count, identifying whether the pool, the verdict, or a stale scan diverged
