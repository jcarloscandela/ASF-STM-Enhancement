# settings-storage

## Purpose

Reliable persisted settings for the ASF-STM userscript, so the chosen scan source (inventory vs badge pages) and every other option survive save, reload, and reset exactly as set.

## Requirements

### Requirement: Settings persist to localStorage and reload faithfully

The system SHALL persist the full settings object to `localStorage` key `TempAsfStm.ASF.STM.Settings` on save, and on load the in-memory settings SHALL equal the saved values merged over defaults (stored values win, including explicit `false` and `0`).

#### Scenario: Inventory flag round-trips

- **WHEN** the user checks "Scan inventory", saves, reloads the page, and opens settings
- **THEN** the checkbox is still checked and the loaded `inventoryScan` value is `true`

#### Scenario: Explicit false is preserved

- **WHEN** stored settings contain `inventoryScan: false` and defaults later change
- **THEN** the loaded value remains `false` and is not overwritten by any default

#### Scenario: Corrupt or missing storage falls back to defaults

- **WHEN** the settings key is missing, `null`, or unparsable JSON
- **THEN** the system loads a fresh copy of the defaults and the scan runs the badge-page path

### Requirement: Scan dispatch runs the inventory scan outside scan filters

The system SHALL run the inventory scan whenever no active scan filters take precedence; the dispatch snapshot SHALL be captured at scan start so later UI state cannot change the running path. The inventory scan SHALL be the only non-filter path: no persisted flag or dialog option can select a different scan source.

#### Scenario: Default dispatch is the inventory scan

- **WHEN** no active scan filters exist and the user starts a scan (regardless of stored settings content)
- **THEN** the run takes the inventory path and never falls back to badge pages silently (inventory failures abort with an error)

#### Scenario: Dialog has no scan-source option

- **WHEN** the user opens the config dialog
- **THEN** no "Scan inventory" checkbox is present, and the inventory scan delay input remains available

#### Scenario: Stored inventoryScan flag is ignored

- **WHEN** stored settings still contain an `inventoryScan` value saved by an older version
- **THEN** the value is not used for dispatch (the run takes the inventory path) and the dialog-save flow never writes the flag

### Requirement: Reset restores defaults and clears stored values

The system SHALL, on reset, delete all known stored values (`TempAsfStm.ASF.STM.Settings`, `.Blacklist`, `.Params`, `.BotCache`) and restore in-memory settings and blacklist to their defaults (**BREAKING**: blacklist was previously preserved across reset).

#### Scenario: Reset clears everything

- **WHEN** the user confirms "restore default settings"
- **THEN** all four keys are removed from `localStorage`, in-memory settings equal the defaults (`inventoryScan=false`), and the next scan uses the badge-page path

#### Scenario: Reset persists

- **WHEN** reset completes
- **THEN** the cleared/default state is saved so a subsequent reload still shows defaults
