Feature: REQ-028 — Discard unmigratable save state without throwing
  As the Hub Shell, I discard a Save State that fails validation and migration, returning a fresh round.

  @REQ-028 @AC-028-1
  Scenario: A malformed stored string yields a fresh round without throwing
    # TEST-047
    Given a persisted Save State with schemaVersion 99
    When Hub Shell loads the Save State
    Then the corrupt state is discarded

  @REQ-028 @AC-028-2
  Scenario: A corrupt Practice record does not affect the intact Daily record
    # TEST-048
    Given a corrupt Practice record and an intact Daily record
    When the Practice state is loaded
    Then the Daily record is unchanged