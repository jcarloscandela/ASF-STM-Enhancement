# Spec Delta

## Purpose

Provide one typed, injectable JSON persistence helper over browser storage so every persisted value is read, written, and removed safely using a single inventory of storage keys.

## ADDED Requirements

### Requirement: Reads never throw on missing or corrupt data

Reading a persisted value SHALL return the caller-provided fallback when the key is absent or the stored value cannot be parsed as JSON, and SHALL return the parsed value otherwise. A read SHALL NOT throw because of missing or malformed stored data.

#### Scenario: Missing key returns fallback

- **WHEN** a caller reads a key that was never written
- **THEN** the fallback value is returned

#### Scenario: Corrupt value returns fallback

- **WHEN** the stored value is not valid JSON
- **THEN** the fallback value is returned and no exception escapes the read

#### Scenario: Valid value is parsed

- **WHEN** a valid JSON value was previously written under the key
- **THEN** the read returns the parsed value

### Requirement: Writes round-trip and removal restores the fallback

Writing a value SHALL persist its JSON serialization under the given key such that a subsequent read returns a structurally equal value, and removing a key SHALL delete it so a later read returns the fallback.

#### Scenario: Write then read returns the same value

- **WHEN** a value is written and then read back
- **THEN** the read result is structurally equal to the written value

#### Scenario: Remove deletes the stored value

- **WHEN** a key is removed and then read
- **THEN** the read returns the fallback

### Requirement: Single inventory of storage keys

Every storage key the userscript persists SHALL be declared in one place and reused by every save and load call site, and no call site SHALL construct its own literal key string.

#### Scenario: Scanner and trade page agree on keys

- **WHEN** the scanner writes a persisted value and the trade-offer page later reads it
- **THEN** both sides use the same declared key and the value is found

### Requirement: Host-independent and testable

The persistence helper SHALL operate on an injected storage-like interface and SHALL NOT reference the global `window` or `localStorage` directly, so its behavior can be unit-tested without a browser.

#### Scenario: Unit test with a fake storage

- **WHEN** the helper is given an in-memory storage implementation in a test
- **THEN** all read, write, and remove behavior can be exercised without a browser environment
