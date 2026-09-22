# bundled-dataset-publish

## Purpose

Keeps the authored card dataset readable in `data/` while shipping a minimal-size encoding inside the Tampermonkey/GreasyFork bundle.

## Requirements

### Requirement: Authoring format stays readable

The system SHALL keep `data/badge_cards.json` as the human-readable source of truth using long keys (`size`/`name`/`cards`, `hash`/`title`/`iconUrl`) with full icon URLs.

#### Scenario: Dataset edits stay readable

- **WHEN** a contributor regenerates or edits `data/badge_cards.json`
- **THEN** the file uses long keys and full icon URLs with no manual minification step.

### Requirement: Publish encoding is compact

The system SHALL convert the dataset to a compact publish encoding at build time that strips redundant bytes (short keys, appId-keyed array layout, `"<appid>-"` hash-prefix elision, per-game title-suffix reuse, icon-path prefix stripping) and the runtime SHALL decode it back to the full card entries losslessly.

#### Scenario: Lossless round-trip

- **WHEN** the bundled dataset loads in the userscript
- **THEN** every game resolves the same set size, names, exact market hashes, display titles, and expanded icon URLs as the authoring file.

#### Scenario: Old shapes still load

- **WHEN** `normalizeDataset` receives a legacy shape (counts array, long keys, or `s`/`n`/`c`/`h`/`t`/`u`)
- **THEN** it decodes them exactly as before.

### Requirement: Publish size budget is enforced

The system SHALL enforce a publish size budget on the compacted dataset bytes and the built userscript, failing the build and CI with a clear message when exceeded.

#### Scenario: Budget breach fails loudly

- **WHEN** the compacted dataset or built userscript exceeds its budget
- **THEN** the build exits non-zero naming the artifact and its byte size.
