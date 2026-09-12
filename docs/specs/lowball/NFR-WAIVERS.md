# NFR Waivers — lowball

**Complexity class:** small (waivers are inline at this class; this file is the inline record)
**Generated:** start-project Phase 4 (LOCAL, deterministic)
**Method:** every REQ's `NFR-Tags` field was cross-checked against the 98 extracted Gherkin
scenarios by matching each acceptance criterion's `TEST-XXX` id to a `# TEST-XXX` comment in
`features/*.feature`.

## Result: no waivers required

| Metric | Value |
|---|---|
| REQs carrying an NFR tag | 58 / 58 |
| NFR-tagged REQs lacking full scenario coverage | 0 |
| Waivers requested | 0 |
| Waivers lacking an `Approved by` value | 0 |

Because no waiver rows exist, the Phase 4 gate condition "block emission of
`start-project.gate.json` if any waiver lacks an Approved by value" is satisfied trivially.

## NFR coverage distribution

| NFR | Category | REQs | Requirement ids |
|---|---|---|---|
| NFR-001 | Accessibility (WCAG 2.1 AA) | 5 | REQ-021, REQ-049, REQ-050, REQ-051, REQ-052 |
| NFR-002 | Maintainability | 5 | REQ-026, REQ-027, REQ-029, REQ-030, REQ-054 |
| NFR-003 | Privacy and honesty | 8 | REQ-022, REQ-023, REQ-044, REQ-047, REQ-048, REQ-053, REQ-055, REQ-057 |
| NFR-004 | Determinism | 22 | REQ-001, REQ-002, REQ-004, REQ-005, REQ-010, REQ-011, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-024, REQ-025, REQ-036, REQ-037, REQ-038, REQ-039, REQ-041, REQ-056 |
| NFR-005 | Fault tolerance | 10 | REQ-003, REQ-006, REQ-007, REQ-008, REQ-009, REQ-012, REQ-028, REQ-040, REQ-043, REQ-058 |
| NFR-006 | Content quality | 8 | REQ-031, REQ-032, REQ-033, REQ-034, REQ-035, REQ-042, REQ-045, REQ-046 |

Total tag assignments: 58 (each REQ carries exactly one primary NFR tag).

## Caveat on what this measures

This check verifies that every NFR-tagged requirement has a **scenario** covering each of its
acceptance criteria. It does not verify those scenarios have executable step implementations — the
step-definition library in `TDD-STRATEGY.md` lists 210 patterns, but no step code exists yet
because `/start-project` never writes application or test code. Executable coverage is a
`/feature-dev` concern and is gated by `.bob/scripts/quality-gate.sh`.

Two NFRs additionally require tooling that is not yet present in the repository:

| NFR | Gap | Owner |
|---|---|---|
| NFR-001 | `axe-core` is not currently a devDependency; the automated WCAG scan required by REQ-049..REQ-052 cannot run until it is added. Playwright is already present. | View owner |
| NFR-004 | Cross-runtime determinism needs the existing three-runtime Playwright matrix (Chromium, WebKit/iOS, Pixel/Android) extended to cover this game's golden vectors. | Engine owner |

Neither is a waiver: both requirements remain in force with full scenario coverage. They are
tooling prerequisites recorded so they are not discovered late.
