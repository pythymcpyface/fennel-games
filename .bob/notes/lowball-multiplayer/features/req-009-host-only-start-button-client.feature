Feature: REQ-009 — Host-only Start button (client, requires isHost AND roomPlayerCount>=2)
  As the host, I see an enabled Start button only when eligible so that games start correctly.

  @REQ-009 @AC-009-1
  Scenario Outline: Start button enabled state depends on host status and player count
    # TEST-013, TEST-014, TEST-015
    Given the client renders the lobby with isHost "<isHost>" and roomPlayerCount "<count>"
    When the lobby view is displayed
    Then the Start button is "<state>"

    Examples:
      | isHost | count | state    |
      | true   | 2     | enabled  |
      | true   | 1     | disabled |
      | false  | 2     | disabled |