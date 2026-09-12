Feature: REQ-027 — Persist save state with a schema version
  As the Hub Shell, I include schemaVersion in every persisted Lowball Save State record.

  @REQ-027 @AC-027-1
  Scenario: A persisted record contains a positive integer schemaVersion
    # TEST-046
    Given a completed round ready to persist
    When the round state is written to storage
    Then the stored record contains a positive integer schemaVersion