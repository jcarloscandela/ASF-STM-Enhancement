# Spec Delta

## ADDED Requirements

### Requirement: Empty-offer abort names its stage and cause

The system SHALL, whenever the trade-offer flow aborts with zero items selected on both sides, surface a visible dialog that names the failed stage (`trade setup` for handoff-data resolution vs `live inventory` for selection) and states explicitly that no items were added.

#### Scenario: Handoff-data empty names keys tried and counts

- **WHEN** handoff resolution yields zero selectable cards (`missing url parameter`, `invalid url parameter`, `no matches with this partner`, `nothing to add, exiting`, or unbalanced `Different items amount`)
- **THEN** the dialog and debug log include the partner-key candidates tried, the resolved appid filter, how many filter appids had a match entry, how many stored card ids were skipped as unknown, and the resulting `Cards[2]` counts, alongside the existing `TempAsfStm.ASF.STM.Params` (`matches`/`filter`/`cardNames`) pointer.

#### Scenario: Live-inventory empty names per-card shortfalls

- **WHEN** handoff resolution succeeds with balanced non-empty `Cards[2]` but the live inventory cannot supply every requested card
- **THEN** the dialog lists each unsupplied card with side and absent-vs-unselectable reason, states that zero items were moved, and does not blame the Params key.

#### Scenario: Zero moves preserved on every abort

- **WHEN** any abort above fires (handoff-data, live-inventory shortfall, slot-count mismatch, or non-1:1 type veto)
- **THEN** no item is moved into the trade on either side, so a failed offer is left empty rather than partial.

## MODIFIED Requirements

### Requirement: Offer preconditions abort loudly and document params

The system SHALL require `match`, a non-empty filter, non-empty balanced `Cards[2]` (equal counts both sides), and SHALL surface handoff-data violations (`missing url parameter`, `invalid url parameter`, `no matches with this partner`, `Different items amount`, `nothing to add`) in a visible dialog naming the failed stage as trade setup, the partner-key candidates tried, the resolved appid filter, per-appid match presence, skipped card-id count, and `Cards[2]` counts, plus localStorage key `TempAsfStm.ASF.STM.Params` (`matches`/`filter`/`cardNames`) for diagnosis. The dialog SHALL state explicitly that no items were added. Live-inventory shortfalls SHALL surface in a separate visible dialog that names the unsupplied cards per the live-inventory shortfall requirement and SHALL NOT blame the Params key. The offer page SHALL move no item into the trade while any requested card is unsupplied, so a failed offer is left empty rather than partial.

#### Scenario: No silent empty offer

- **WHEN** any precondition fails (missing match param, empty selection, unbalanced sides)
- **THEN** a visible error names the cause and the storage key, and no partial silent selection is left

#### Scenario: URL params testable

- **WHEN** a tester varies `partner`, `token`, `source`, or `match` in the offer URL
- **THEN** `partner` selects the match entry, `match` selects all vs one badge, `source=asfstm` gates the auto-fill, and `token` passes through to Steam untouched

#### Scenario: Balanced handoff with short inventory leaves an empty offer

- **WHEN** the handoff resolves balanced `Cards[2]` but the live inventory cannot supply every requested card
- **THEN** the flow aborts with a dialog naming each unsupplied card and moves zero items, instead of a partial offer followed by "Cards missing"
