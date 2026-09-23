# trade-offer-handoff

## Purpose

Guarantees the scan-to-tradeoffer handoff fills the Steam trade offer on both sides for bulk and per-badge flows, and fails loudly instead of rendering an empty offer.

## Requirements

### Requirement: Bulk trade URL selects every matchable trade

The system SHALL build the "Offer a trade for all" URL as the partner base URL plus `source=asfstm` and `match=all`, and the offer page SHALL resolve `match=all` to every appid in the persisted filter that also has a match entry for the resolved partner.

#### Scenario: match=all fills both sides

- **WHEN** the user opens `.../tradeoffer/new/?partner=<id>&token=<t>&source=asfstm&match=all` with persisted matches for that partner
- **THEN** every matchable appid contributes its send cards to the user's side and its receive cards to the partner side

### Requirement: Per-badge trade URL selects exactly that badge

The system SHALL build each per-badge "Offer a trade" URL as the partner base URL plus `source=asfstm` and `match=<appid>`, and the offer page SHALL resolve it to exactly that appid's send/receive cards.

#### Scenario: match=appid fills that badge only

- **WHEN** the user opens the offer URL with `match=<appid>`
- **THEN** only that badge's send cards and receive cards are selected, and no other badge's cards are added

### Requirement: Partner key resolution covers bot and friend modes

The system SHALL persist matches under the truncated partner key and resolve the offer-page `partner` URL param against both the raw value and its truncated form, so bot mode (truncated id in URL) and friend mode (full SteamID in URL) both find their matches.

#### Scenario: Friend-mode full SteamID resolves

- **WHEN** the offer URL carries the full SteamID while matches are keyed by truncated id
- **THEN** the match entry is found and cards are selected

#### Scenario: Unknown partner aborts loudly

- **WHEN** no match entry exists for either key form
- **THEN** the offer flow aborts with a visible error instead of an empty offer

### Requirement: Card-name ids always decode to selectable names

The system SHALL persist the card-name table alongside matches before saving params, and the offer page SHALL decode every send/receive card id to a market-hash name; unknown ids are skipped with a debug log, and a fully-unresolvable selection aborts loudly.

#### Scenario: Empty Cards aborts loudly

- **WHEN** filter/matches resolve but zero card names result
- **THEN** the flow throws "nothing to add, exiting" with a visible dialog and selects nothing silently

### Requirement: Live-inventory shortfall names the missing cards

The system SHALL report, in the visible failure dialog and the debug log, each requested card the live trade inventory could not supply, naming the side, the market-hash name, and whether the name was absent from that side's inventory or present but not selectable (trade-held or otherwise untradable).

#### Scenario: Missing user-side cards are named

- **WHEN** the user's live inventory cannot supply every requested send card
- **THEN** the dialog lists each unsupplied send-card name with its absent-vs-unselectable reason instead of only naming the Params storage key

#### Scenario: Missing partner-side cards are named

- **WHEN** the partner's live inventory cannot supply every requested receive card
- **THEN** the dialog lists each unsupplied receive-card name with its absent-vs-unselectable reason

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
