# scan-resilience

## Purpose

Provides reusable request-resilience behavior for the scan flows: Steam request failures are classified into a known taxonomy, and a circuit-breaker/backoff policy fails fast while Steam is rate-limiting and recovers automatically, so transient failures neither abort scans that could succeed nor hammer an already-throttled endpoint.

## Requirements

### Requirement: Scan request failures are classified

The scan flows SHALL classify Steam request failures into at least these categories: rate-limited (HTTP 429 or Steam's rate-limit error body), auth (session/credentials failures), transient (network errors, timeouts, 5xx), and unknown. Classification SHALL be a pure function of the failure (status and error text), usable by every scan flow without duplicating error-text heuristics.

#### Scenario: Rate-limit response is classified as rate-limited

- **WHEN** a scan request fails with HTTP 429 or a Steam rate-limit error message
- **THEN** the failure is classified as rate-limited

#### Scenario: Transport failure is classified as transient

- **WHEN** a scan request fails with a network error or timeout
- **THEN** the failure is classified as transient

### Requirement: Circuit breaker fails fast during a rate-limit window

The scan flows SHALL implement a circuit breaker over scan requests: when consecutive rate-limited failures reach a threshold, the breaker opens and further scan requests SHALL fail fast without hitting Steam until an exponentially growing cooldown elapses; a successful request after the cooldown resets the breaker. The breaker SHALL compose with the existing shared retry-delay computation (it gates whether/when a request may be attempted, not the per-retry delay formula).

#### Scenario: Breaker opens after consecutive rate limits

- **WHEN** scan requests keep failing as rate-limited until the threshold is reached
- **THEN** subsequent scan requests fail fast without issuing network requests until the cooldown expires

#### Scenario: Breaker recovers after a successful request

- **WHEN** a scan request succeeds after the cooldown elapsed
- **THEN** the breaker resets and subsequent failures start counting from zero

#### Scenario: Open breaker surfaces a retryable error

- **WHEN** the breaker is open mid-scan
- **THEN** the scan surfaces a retryable error status instead of silently proceeding with unverified data
