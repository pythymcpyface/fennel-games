Feature: REQ-058 — Repair a save state carrying more players than the mode allows
  As the Hub Shell, I retain only the first player entry when a loaded Save State holds more than one.

  @REQ-058 @AC-058-1
  Scenario: A Save State with three player entries is repaired to a single entry
    # TEST-098
    Given a persisted Save State whose players array holds 3 entries
    When the tampered Save State is loaded
    Then the repaired state holds exactly 1 player entry