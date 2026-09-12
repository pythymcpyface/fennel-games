Feature: REQ-053 — usedWordsBySlot updated on every non-null submission
  As the system, I track used words per player so that reuse can be detected in tiebreaks.

  @REQ-053 @AC-053-1
  Scenario: Non-null submission updates usedWordsBySlot for the submitting player
    # TEST-067, TEST-068
    Given a player at slot 2 has an empty usedWordsBySlot record
    When the player at slot 2 submits the word "MANGO"
    Then usedWordsBySlot for slot 2 contains "MANGO"