Feature: REQ-025 — Tiebreak sweep excludes previously used words
  As the system, I reject reused words in tiebreaks so that players cannot repeat answers to gain advantage.

  @REQ-025 @AC-025-1
  Scenario: Reusing a previously used word in a tiebreak sweep scores as invalid
    # TEST-036
    Given a player used the word "GRAPE" earlier in the round
    When the same player submits "GRAPE" again during a tiebreak sweep
    Then the Durable Object scores the submission with panelScore 100 due to reuse