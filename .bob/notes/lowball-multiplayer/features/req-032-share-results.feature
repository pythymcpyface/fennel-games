Feature: REQ-032 — Share results via existing SharePort
  As a player, I share my results so that I can post them without revealing answer words.

  @REQ-032 @AC-032-1
  Scenario: Sharing results uses SharePort and excludes answer words
    # TEST-044
    Given a player has completed a round with a final leaderboard
    When the player invokes the share results action
    Then the client calls the existing SharePort with the results text
    And the share text does not contain any answer words