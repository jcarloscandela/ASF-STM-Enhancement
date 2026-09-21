# Spec Delta

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Scan dispatch follows the persisted scan source

**Reason**: The persisted `inventoryScan` flag and its dialog checkbox are removed, so dispatch no longer branches on any scan-source setting; the scenarios describing flag-based dispatch ("Saved inventory mode scans inventory", "Badge mode is the default", "Dialog reflects stored value") describe removed behavior.

**Migration**: Replaced by "Scan dispatch runs the inventory scan outside scan filters" above, which keeps the snapshot-at-start semantics and the abort-not-fallback failure behavior.
