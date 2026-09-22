# Spec Delta

## ADDED Requirements

### Requirement: Serial badge-detail phase completes and hands off to matching

When badge-detail requests are needed, the serial fetch phase SHALL complete without reading past the end of its pending list and without throwing: once every pending entry has been processed, the system SHALL transition exactly once through the same completion path as the zero-pending fast path — filtering/sorting, then downstream matching — and SHALL issue no further badge-detail request. Phase progress SHALL advance only when a pending entry is actually completed (a retryable failure that re-fetches the same entry SHALL NOT advance it), SHALL reach exactly its total exactly when the phase ends, SHALL never exceed its total, and SHALL restart from zero at the beginning of every scan. An aborted phase (user interrupt, rate-limit fail-fast, or exhausted error budget) SHALL NOT hand off to matching.

#### Scenario: Last pending badge hands off to matching

- **WHEN** the final pending badge-detail response is processed successfully
- **THEN** no badge-detail request is scheduled afterward, no missing pending entry is read, and the scan proceeds to filtering/sorting and downstream matching with no exception

#### Scenario: Single pending badge completes

- **WHEN** exactly one badge requires a badge-detail request
- **THEN** it is fetched once and the scan hands off to matching exactly as it does after a longer pending list

#### Scenario: Retry re-fetches the same badge without advancing progress

- **WHEN** a pending badge-detail fetch fails with a retryable error
- **THEN** the same pending entry is re-fetched without skipping or duplicating any entry, the failed attempt does not advance phase progress, and completion still occurs exactly once

#### Scenario: Phase progress completes exactly once per scan

- **WHEN** a serial phase with N pending entries finishes after any number of retries
- **THEN** the badge progress reads exactly N of N at handoff, never exceeds its total, and a subsequent scan starts again from zero

#### Scenario: Aborted phase does not hand off

- **WHEN** the serial phase aborts because of a user interrupt, a rate-limit fail-fast, or an exhausted error budget
- **THEN** the scan does not proceed to filtering/sorting or downstream matching

### Requirement: Interrupted badge-detail phase resumes from temporary storage

The badge-detail phase SHALL persist its in-flight state — the derived badge state, the pending queue with its current position, and the inventory card counts that pending fills still need — to temporary per-tab storage as it advances, under a versioned record tied to the scan plan. When a subsequent scan starts in the same tab with a matching record version and scan plan, the system SHALL resume the badge-detail phase from the record: the earlier scan phases are not re-run, entries completed before the interruption are neither re-derived nor re-fetched, and the phase continues into the exactly-once handoff to matching. The record SHALL be removed when the badge-detail phase completes, when the scan finishes, and when the user stops the scan, so it is never offered for resume afterward. A missing, corrupt, version-mismatched, or plan-mismatched record, and storage that is unavailable or rejects writes, SHALL each degrade silently to a fresh scan without throwing. Applying a resumed entry SHALL rebuild that badge's slot list from its detail response rather than appending to it, so an interruption mid-fill can never duplicate cards.

#### Scenario: Interrupted phase resumes at the saved position

- **WHEN** a scan is interrupted during the badge-detail phase (crash, reload, or tab restore) and a new scan starts in the same tab with the same scan plan
- **THEN** the badge-detail phase resumes from the saved queue position without re-running the inventory and eligibility phases, and the scan reaches matching

#### Scenario: Completed entries are never re-fetched after resume

- **WHEN** resuming a phase whose first K entries were completed before the interruption
- **THEN** no badge-detail request is issued for those K entries and the remaining entries are fetched serially as usual

#### Scenario: Plan or version mismatch starts fresh

- **WHEN** the stored resume record's scan plan or record version does not match the scan being started
- **THEN** the record is ignored, a normal fresh scan runs, and no error is surfaced

#### Scenario: Corrupt or unavailable storage degrades to a fresh scan

- **WHEN** the resume record is missing or unparsable, or storage rejects reads or writes
- **THEN** the scan runs as a fresh scan without throwing

#### Scenario: Record removed after completion or stop

- **WHEN** the badge-detail phase completes, the scan finishes, or the user stops the scan
- **THEN** no resume record remains and the next scan starts fresh

#### Scenario: Resumed or retried fill never duplicates cards

- **WHEN** a badge's slot list was partially filled when the scan was interrupted, or a fill is applied to a badge that already holds slots
- **THEN** the fill rebuilds the slot list from the detail response, so the badge's card counts contain no duplicates
