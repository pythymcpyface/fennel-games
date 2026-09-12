Feature: REQ-038 — Invite link format
  As a host, I share an invite link so that others can join my room directly.

  @REQ-038 @AC-038-1
  Scenario: Generated invite link matches the required format
    # TEST-051
    Given a room has been created with code "AB12CD" and base URL "<base>"
    When the client generates an invite link for the room
    Then the invite link equals "<base>#/game/lowball?room=AB12CD"