Feature: REQ-048 — Label Practice share text distinctly
  As the Share Module, I include a distinct "(Practice)" marker for Practice Round share text.

  @REQ-048 @AC-048-1
  Scenario: Practice share text includes the "(Practice)" marker
    # TEST-082
    Given a completed round with totalScore 30, parValue 40, verdict "win", mode "practice"
    When generateShareText is called
    Then the returned string contains a "(Practice)" label

  @REQ-048 @AC-048-2
  Scenario: Daily share text omits the "(Practice)" marker
    # TEST-083
    Given a completed round with totalScore 42, parValue 50, verdict "win", mode "daily"
    When generateShareText is called
    Then the share text omits "(Practice)"