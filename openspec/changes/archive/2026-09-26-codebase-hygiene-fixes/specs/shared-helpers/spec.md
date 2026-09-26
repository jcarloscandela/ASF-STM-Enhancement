# Spec Delta

## MODIFIED Requirements

### Requirement: Color conversions preserve current results

The color helpers SHALL convert between hex and rgba and mix an alpha component with the same results and fallbacks as the current inline implementations, including the existing fallback when an input color cannot be parsed. Hex output SHALL always carry six digits: each channel is zero-padded to two digits, so channels below 16 no longer produce malformed output.

#### Scenario: Unparseable color uses the existing fallback

- **WHEN** an rgba string that does not match the expected shape is converted to hex
- **THEN** the existing fallback color and alpha are returned

#### Scenario: Hex converts to rgba

- **WHEN** a hex color is converted to rgba
- **THEN** the result carries the same channel values as today with alpha 1

#### Scenario: Low channels still produce six-digit hex

- **WHEN** an rgba color with a channel value below 16 is converted to hex
- **THEN** each channel is zero-padded to two digits (e.g. channel 10 renders as `0a`)

#### Scenario: Mixing alpha replaces only the alpha component

- **WHEN** an alpha value is mixed into an rgba color
- **THEN** the channels are unchanged and only the alpha component is replaced
