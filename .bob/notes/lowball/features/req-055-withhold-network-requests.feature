Feature: REQ-055 — Withhold network requests at runtime
  As the Lowball plugin, I avoid issuing network requests beyond the precached Content Pack asset.

  @REQ-055 @AC-055-1
  Scenario: A full round completes with the network offline
    # TEST-093
    Given the plugin mounted with the network offline
    When a full round is played
    Then the round reaches a terminal verdict

  @REQ-055 @AC-055-2
  Scenario: Only the Content Pack asset path appears among outbound requests
    # TEST-094
    Given the plugin mounted with outbound requests recorded
    When a full round is played
    Then only the Content Pack asset path appears among outbound requests