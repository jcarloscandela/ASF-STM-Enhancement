# Spec Delta

## ADDED Requirements

### Requirement: Live-inventory shortfall names the missing cards

The system SHALL report, in the visible failure dialog and the debug log, each requested card the live trade inventory could not supply, naming the side, the market-hash name, and whether the name was absent from that side's inventory or present but not selectable (trade-held or otherwise untradable).

#### Scenario: Missing user-side cards are named

- **WHEN** the user's live inventory cannot supply every requested send card
- **THEN** the dialog lists each unsupplied send-card name with its absent-vs-unselectable reason instead of only naming the Params storage key

#### Scenario: Missing partner-side cards are named

- **WHEN** the partner's live inventory cannot supply every requested receive card
- **THEN** the dialog lists each unsupplied receive-card name with its absent-vs-unselectable reason

## MODIFIED Requirements

### Requirement: Offer preconditions abort loudly and document params

The system SHALL require `match`, a non-empty filter, non-empty balanced `Cards[2]` (equal counts both sides), and SHALL surface handoff-data violations (`missing url parameter`, `Different items amount`, `nothing to add`) in a visible dialog naming localStorage key `TempAsfStm.ASF.STM.Params` (`matches`/`filter`/`cardNames`) for diagnosis. Live-inventory shortfalls SHALL surface in a separate visible dialog that names the unsupplied cards per the live-inventory shortfall requirement and SHALL NOT blame the Params key. The offer page SHALL move no item into the trade while any requested card is unsupplied, so a failed offer is left empty rather than partial.

#### Scenario: No silent empty offer

- **WHEN** any precondition fails (missing match param, empty selection, unbalanced sides)
- **THEN** a visible error names the cause and the storage key, and no partial silent selection is left

#### Scenario: URL params testable

- **WHEN** a tester varies `partner`, `token`, `source`, or `match` in the offer URL
- **THEN** `partner` selects the match entry, `match` selects all vs one badge, `source=asfstm` gates the auto-fill, and `token` passes through to Steam untouched

#### Scenario: Balanced handoff with short inventory leaves an empty offer

- **WHEN** the handoff resolves balanced `Cards[2]` but the live inventory cannot supply every requested card
- **THEN** the flow aborts with a dialog naming each unsupplied card and moves zero items, instead of a partial offer followed by "Cards missing"
