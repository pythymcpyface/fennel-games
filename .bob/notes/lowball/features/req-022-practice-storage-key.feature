Feature: REQ-022 — Persist Practice results only under the practice storage key
  As the Hub Shell, I write Practice Round state only under storageKeyPractice.

  @REQ-022 @AC-022-1
  Scenario: Completing a full Practice Round leaves the Daily storage key untouched
    # TEST-038
    Given a completed round ready to persist
    When the Practice round state is persisted
    Then storageKeyDaily is NOT modified