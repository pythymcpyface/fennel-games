Feature: REQ-034 — Disconnected player receives auto-blank at deadline
  As the system, I auto-blank disconnected players at the deadline (not immediately) so that late reconnects can still count.

  @REQ-034 @AC-034-1
  Scenario: Disconnected player is auto-blanked only when the sweep deadline is reached
    Given a player disconnects during an active sweep before the deadline
    When the sweep deadline is reached without a submission from that player
    Then the Durable Object records an auto-blank for that player at the deadline
    And the Durable Object does not record an auto-blank at the moment of disconnect