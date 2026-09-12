Feature: REQ-029 — Expose a single migration function contract
  As the Hub Shell, I expose migration through the single migrate(state, fromVersion, toVersion) signature.

  @REQ-029 @AC-029-1
  Scenario: Migrating at the current schema version returns the input unchanged
    # TEST-049
    Given a persisted Save State with schemaVersion 1
    When Hub Shell loads the Save State
    Then the state is migrated to schemaVersion 1

  @REQ-029 @AC-029-2
  Scenario: Migrating from an unknown schemaVersion returns null
    # TEST-050
    Given a persisted Save State with schemaVersion 99
    When Hub Shell loads the Save State
    Then the migrate return value is null