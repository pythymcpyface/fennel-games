Feature: REQ-030 — Reconcile a persisted verdict missing from the Stats Record
  As the Hub Shell, I apply the Stats Record update once for a terminal verdict absent from played days.

  @REQ-030 @AC-030-1
  Scenario: Loading an unreconciled win applies the Stats Record update once
    # TEST-051
    Given a Daily Save State holding a terminal "win" verdict for dayId "2024-06-01"
    And a Stats Record omitting dayId "2024-06-01"
    When the Daily Save State is loaded
    Then the Stats Record records 1 win for dayId "2024-06-01"

  @REQ-030 @AC-030-2
  Scenario: Loading the same reconciled state again does not double-count
    # TEST-052
    Given a Daily Save State holding a terminal "win" verdict for dayId "2024-06-01"
    And a Stats Record omitting dayId "2024-06-01"
    When the Daily Save State is loaded
    And the Daily Save State is loaded
    Then the Stats Record win count is unchanged