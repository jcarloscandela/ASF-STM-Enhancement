# request-service

## Purpose

Provide one reusable request helper so every GM/HTTP call shares request-mechanism resolution, promise-based response handling, and the retry/backoff policy used by the scan flows.

## Requirements

### Requirement: Request mechanism resolution

The system SHALL select the available userscript request mechanism when issuing a request, preferring the modern GM request API when present and otherwise using the legacy GM request function, and SHALL fail with a clear error when neither is available instead of throwing an unhandled exception.

#### Scenario: Only the legacy mechanism is available

- **WHEN** only the legacy GM request function is defined
- **THEN** the request is issued through it

#### Scenario: Only the modern mechanism is available

- **WHEN** only the modern GM request API is defined
- **THEN** the request is issued through it

#### Scenario: No mechanism is available

- **WHEN** neither request mechanism is defined
- **THEN** the helper fails with a clear error and does not crash the caller

### Requirement: Promise-based GET with explicit failures

The system SHALL expose a promise-returning GET helper that resolves with the response text when the response status is in the success range, rejects with an error identifying the HTTP status when it is not, and rejects on transport error or timeout.

#### Scenario: Successful response resolves

- **WHEN** the request completes with a success status
- **THEN** the promise resolves with the response text

#### Scenario: Error status rejects with status

- **WHEN** the request completes with a client or server error status
- **THEN** the promise rejects with an error that identifies the status

#### Scenario: Transport failure rejects

- **WHEN** the request fails or times out before completing
- **THEN** the promise rejects instead of hanging or resolving empty

### Requirement: One shared retry and backoff policy

Retry scheduling for retryable request failures SHALL be computed in one shared place from the configured web limiter, error limiter, and current attempt count, and every scan flow SHALL use that shared computation instead of duplicating the delay formula.

#### Scenario: First retry uses the base limiter

- **WHEN** a retryable failure occurs and no prior retries have happened in the flow
- **THEN** the next attempt is scheduled after the base web-limiter delay

#### Scenario: Later retries increase the delay

- **WHEN** retryable failures accumulate during a flow
- **THEN** each subsequent attempt is scheduled after the base delay plus the error limiter multiplied by the attempt count

#### Scenario: Retries stop at the configured maximum

- **WHEN** the number of failed attempts exceeds the configured maximum error count
- **THEN** the flow stops and reports failure instead of scheduling further attempts

### Requirement: Superseded or stopped runs stop scheduling work

Request scheduling SHALL allow a caller to cancel or supersede an in-flight scan run so that a stopped or superseded run schedules no further requests and does not act on late responses.

#### Scenario: Stopped run schedules nothing further

- **WHEN** the user stops a run or a newer run supersedes it while a request is pending
- **THEN** the older run performs no further scheduled requests and ignores its late response
