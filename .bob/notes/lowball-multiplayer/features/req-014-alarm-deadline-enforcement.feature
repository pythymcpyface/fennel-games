Feature: REQ-014 — DO alarm enforcement of 30-second sweep deadline
  As the system, I enforce sweep deadlines via alarm so that rounds progress even without submissions.

  @REQ-014 @AC-014-1
  Scenario: DO alarm fires and closes the sweep at the deadline
    # TEST-022
    Given a sweep has started with a sweepDeadlineTimestamp 30000 milliseconds in the future
    When the Durable Object alarm fires at the sweepDeadlineTimestamp
    Then the Durable Object closes the active sweep
    And the Durable Object proceeds to the next sweep phase