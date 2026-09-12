Feature: REQ-060 — engine.ts/types.ts/share.ts/content-build.ts have no WebSocket/fetch imports
  As a maintainer, I ensure core logic modules remain transport-agnostic so that they stay testable and portable.

  @REQ-060 @AC-060-1
  Scenario: Core logic modules contain no WebSocket or fetch imports
    # TEST-075
    Given the source files "engine.ts", "types.ts", "share.ts", and "content-build.ts" are scanned
    When the scan inspects import statements and API usage in these files
    Then none of these files import or reference the WebSocket API
    And none of these files import or reference the fetch API