Feature: Lowball multiplayer reveal pause and result effects

  Scenario: Drain plays and countdown stays paused even with reduced motion
    Given a multiplayer round with prefers-reduced-motion enabled
    When a reveal with score 40 arrives followed immediately by sweep-start
    Then the counter steps down from 100 to 40
    And the next turn view is not rendered until drain + hold complete

  Scenario: Score 100 shows a big X and still pauses
    When a reveal with score 100 arrives followed by sweep-start
    Then a cross overlay is shown
    And the next turn view renders only after the hold

  Scenario: Score 0 celebrates
    When a reveal with score 0 completes draining
    Then a celebration overlay is shown before the next view

  Scenario: Queued re-render survives a second reveal
    Given a queued sweep-start render during reveal A
    When reveal B starts
    Then the queued render still runs after reveal B completes

  Scenario: Sweep 2 waits for the host
    When the last player of sweep 1 answers
    Then the room enters between-sweeps with no auto-advance alarm
    And sweep 2 starts only when the host sends next
