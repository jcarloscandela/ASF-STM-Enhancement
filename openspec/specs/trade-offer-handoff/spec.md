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

### Requirement: Offer preconditions abort loudly and document params

The system SHALL require `match`, a non-empty filter, non-empty balanced `Cards[2]` (equal counts both sides), and SHALL surface each violation (`missing url parameter`, `Different items amount`, `nothing to add`) in a visible dialog naming localStorage key `TempAsfStm.ASF.STM.Params` (`matches`/`filter`/`cardNames`) for diagnosis.

#### Scenario: No silent empty offer

- **WHEN** any precondition fails (missing match param, empty selection, unbalanced sides)
- **THEN** a visible error names the cause and the storage key, and no partial silent selection is left

#### Scenario: URL params testable

- **WHEN** a tester varies `partner`, `token`, `source`, or `match` in the offer URL
- **THEN** `partner` selects the match entry, `match` selects all vs one badge, `source=asfstm` gates the auto-fill, and `token` passes through to Steam untouched
