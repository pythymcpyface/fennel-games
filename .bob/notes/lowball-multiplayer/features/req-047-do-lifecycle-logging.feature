Feature: REQ-047 — DO logs room lifecycle transitions via console.log
  As a maintainer, I observe room lifecycle transitions in logs so that I can debug issues.

  @REQ-047 @AC-047-1
  Scenario: Durable Object logs lifecycle transitions via console.log
    # TEST-061
    Given a Durable Object manages a room
    When the room transitions between lifecycle states such as created, started, and completed
    Then the Durable Object emits a console.log entry for each lifecycle transition