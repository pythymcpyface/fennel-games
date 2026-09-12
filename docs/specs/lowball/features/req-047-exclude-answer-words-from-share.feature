Feature: REQ-047 — Exclude answer words from generated share text
  As the Share Module, I generate shareText only from totalScore, parValue, verdict and dayId.

  @REQ-047 @AC-047-1
  Scenario: Share text omits neither submitted answer word
    # TEST-080
    Given a completed round with totalScore 42, parValue 50, verdict "win", mode "daily"
    When generateShareText is called
    Then the returned string does NOT contain either submitted answer word as a substring

  @REQ-047 @AC-047-2
  Scenario: Share text omits every Answer List entry
    # TEST-081
    Given a completed round with totalScore 42, parValue 50, verdict "win", mode "daily"
    When each answer in the round's Answer List is sought in the share text
    Then no Answer List entry is found in the share text