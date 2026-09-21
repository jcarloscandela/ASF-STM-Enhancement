# Spec Delta

## Purpose

Provide pure, side-effect-free utility functions shared by the scanner UI and the trade-offer page so duplicated conversion and formatting logic has one tested definition.

## ADDED Requirements

### Requirement: Color conversions preserve current results

The color helpers SHALL convert between hex and rgba and mix an alpha component with the same results and fallbacks as the current inline implementations, including the existing fallback when an input color cannot be parsed.

#### Scenario: Unparseable color uses the existing fallback

- **WHEN** an rgba string that does not match the expected shape is converted to hex
- **THEN** the existing fallback color and alpha are returned

#### Scenario: Hex converts to rgba

- **WHEN** a hex color is converted to rgba
- **THEN** the result carries the same channel values as today with alpha 1

#### Scenario: Mixing alpha replaces only the alpha component

- **WHEN** an alpha value is mixed into an rgba color
- **THEN** the channels are unchanged and only the alpha component is replaced

### Requirement: Nickname sanitization escapes the same characters

The nickname sanitizer SHALL escape the same character set before a nickname is inserted into the DOM, so untrusted Steam nicknames cannot inject markup.

#### Scenario: Markup characters are escaped

- **WHEN** a nickname contains any of `&`, `<`, `>`, `"`, `'`, or `/`
- **THEN** each such character is replaced by its HTML entity

### Requirement: List and text conversion is lossless for numeric ids

The list/text helpers SHALL join a string array into comma-and-newline separated text and parse text back into a string array that retains only numeric entries.

#### Scenario: Array converts to text

- **WHEN** a string array is converted to text
- **THEN** entries are joined with a comma and newline

#### Scenario: Parsing keeps only numeric entries

- **WHEN** text containing both numeric and non-numeric entries is parsed
- **THEN** only the numeric entries are returned

### Requirement: Deep clone produces an independent copy

The deep-clone helper SHALL return a structurally equal copy for JSON-compatible input, so mutating the clone does not affect the source.

#### Scenario: Clone mutation does not affect the source

- **WHEN** a nested object is cloned and the clone is mutated
- **THEN** the original object is unchanged

### Requirement: Helpers have no host side effects

The helpers SHALL be pure and SHALL NOT reference the DOM, userscript globals, network, or storage, so they can be imported and tested without a browser.

#### Scenario: Helpers run in a plain test environment

- **WHEN** the helper suite runs under the unit-test runner with no browser environment
- **THEN** every helper executes successfully
