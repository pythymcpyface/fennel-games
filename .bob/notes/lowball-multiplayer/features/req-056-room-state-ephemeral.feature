Feature: REQ-056 — Room state ephemeral (no DO Storage API calls)
  As the system, I keep room state ephemeral so that no persistent storage is used.

  @REQ-056 @AC-056-1
  Scenario: Durable Object room lifecycle makes no calls to the Storage API
    # TEST-071
    Given a Durable Object manages a room through its full lifecycle from creation to completion
    When the Durable Object's source code and runtime calls are inspected
    Then no calls to the Durable Object Storage API are present