# Spec Delta

## ADDED Requirements

### Requirement: Inventory fetch pages until exhaustion

When the resolved scan plan is inventory mode, the inventory fetch SHALL request pages of the user's Steam inventory until the final page is reached, continuing across pages via pagination so that cards present only on later pages are counted. Pages after the first SHALL be paced by the configured inventory scan delay, and the fetch SHALL terminate once the response reports no further items.

#### Scenario: Large inventories page until exhaustion

- **WHEN** the inventory spans multiple pages (more than one page of 2000 items)
- **THEN** the fetch continues across pages via pagination until the final page, and cards present only on later pages are counted

#### Scenario: Pages are paced

- **WHEN** the fetch issues a page request after the first
- **THEN** the request is delayed by the configured inventory scan delay

#### Scenario: Final page terminates the fetch

- **WHEN** a page response reports no further items
- **THEN** the fetch stops requesting pages and proceeds with the collected data
