Feature: REQ-015 — Authoritative scoring by DO
  As the system, I score submissions authoritatively so that clients cannot manipulate results.

  @REQ-015 @AC-015-1
  Scenario: DO ignores client-supplied score and computes its own via engine
    # TEST-023, TEST-024
    Given a player submits a word with a client-supplied score of 0
    When the Durable Object processes the submission using engine.ts and the content pack
    Then the Durable Object computes the panelScore authoritatively
    And the client-supplied score is discarded