Feature: REQ-001 — Deterministic Daily category selection via FNV-1a hash
  As the Lowball engine, I compute a deterministic categoryId so Daily Rounds are consistent.

  Background:
    Given a dayId "2024-06-01", a contentPackVersion "1.0.0", and a datasetId "lowball-core"

  @REQ-001 @AC-001-1
  Scenario: Identical seed hashes to a byte-identical categoryId
    # TEST-001
    When the engine computes categoryId twice using FNV-1a 32-bit hash over the seed
    Then both computed categoryId values are byte-identical

  @REQ-001 @AC-001-2
  Scenario: categoryId is identical across runtimes for a frozen historical seed
    # TEST-002
    Given a frozen contentPackVersion "1.0.0" and a historical dayId "2023-01-01"
    When the engine computes categoryId on "iOS WKWebView"
    And the engine computes categoryId on "Android WebView"
    And the engine computes categoryId on "desktop Chromium"
    Then the resulting categoryId matches the canonical reference categoryId