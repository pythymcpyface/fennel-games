Feature: REQ-017 — Duplicate submission rejected within same sweep
  As the system, I prevent duplicate submissions so that scoring integrity is preserved.

  @REQ-017 @AC-017-1
  Scenario: Second submission from the same player in the same sweep is rejected
    # TEST-026
    Given a player has already submitted a word in the current sweep
    When the same player submits another word in the same sweep
    Then the Durable Object rejects the second submission