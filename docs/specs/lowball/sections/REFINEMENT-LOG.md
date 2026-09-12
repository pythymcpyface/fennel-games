# Refinement Log — lowball

## Pass 1

**Trigger:** Phase-2 section extraction revealed the supervisor's Requirements section
terminated mid-REQ-004 at the literal token `- **ID:`. The supervisor's own reviewer had
already self-reported this as RISK-003 (Critical): "REQ section is truncated mid-definition —
no requirements exist yet for answer validation, scoring, tick advancement, verdict
computation, share generation, Practice category selection, or accessibility, despite
architecture already assuming them."

**Action:** Authored REQ-004..REQ-056 covering every EARS-worthy behaviour implied by the
Journeys, Architecture and Test Plan sections. Derivation was traced from existing artefacts
rather than invented:

| REQ range | Derived from |
|---|---|
| REQ-004 | RISK-007 (hash-to-index mapping safety) |
| REQ-005..REQ-012 | JOURNEY-001 steps 5–9, ERROR-001/002/003, EDGE-001 |
| REQ-013..REQ-017 | JOURNEY-001 steps 11–12, EDGE-003, TERM-020 |
| REQ-018..REQ-021 | ADR-001, TERM-014/015/022, BRANCH-003 |
| REQ-022..REQ-026 | JOURNEY-002, ADR-003, ADR-006, RISK-004, RISK-010 |
| REQ-027..REQ-030 | FIELD-023, ERROR-004/007, RISK-008, RISK-011 |
| REQ-031..REQ-035 | JOURNEY-003 step 4 (five gate rules, one REQ each) |
| REQ-036..REQ-040 | JOURNEY-003 step 3, EDGE-014/015, ERROR-010 |
| REQ-041..REQ-042 | JOURNEY-003 step 5, ADR-007, RISK-001, EDGE-016 |
| REQ-043..REQ-046 | ERROR-008, ADR-005, RISK-012, BRANCH-006 |
| REQ-047..REQ-048 | JOURNEY-004 step 4, ADR-008, BRANCH-008 |
| REQ-049..REQ-053 | JOURNEY-001 steps 4/8, JOURNEY-004 steps 2–3, honesty constraint |
| REQ-054..REQ-056 | Feature brief deliverables and determinism constraints |

**Splits applied to preserve atomicity (A1/A2):**

- The five-part Fairness Gate described as one prose sentence in JOURNEY-003 step 4 was split
  into five separate requirements (REQ-031 answer count, REQ-032 top score, REQ-033 findable
  count, REQ-034 findable zero, REQ-035 spread) because a single REQ listing five admission
  rules violates A2 (multiple verb-object pairs) and A6 (not expressible in one scenario).
- The panel-score formula was split into four requirements (REQ-036 formula, REQ-037
  out-of-vocabulary, REQ-038 specialist tier, REQ-039 clamp, REQ-040 non-finite) because the
  original prose combined one computation with three override conditions, breaching A8
  (multiple error modes in one statement).
- Verdict computation was split into three (REQ-015 win, REQ-016 loss, REQ-017 pending) so each
  carries exactly one trigger, satisfying A3.
- Answer rejection was split by cause into four (REQ-006 not in list, REQ-007 affix mismatch,
  REQ-008 duplicate, REQ-009 empty) rather than one requirement enumerating four error modes.

**Vague-word substitutions made during authoring:**

| Avoided | Used instead |
|---|---|
| "handle invalid input" | "assign that Sweep a panelScore of 100" |
| "reliable persistence" | "include schemaVersion in every persisted record" |
| "appropriate category" | "category whose parValue is greater than 0" |
| "efficiently sized pack" | "at most 200 kibibytes" |
| "robust against corruption" | "discard the record and return a freshly initialised round" |
| "handles reduced motion" | "set tickCounter directly to the target panelScore" |

**Result:** 56 REQs, 96 ACs, 0 violations.

## Pass 2

**Action:** Re-ran the linter with no edits, to confirm stability.

**Result:** REQ count 56 (unchanged), violations 0 (unchanged). Both conditions of the
fixed-point predicate satisfied at pass >= 2. Loop terminated.

## Notes carried forward

- RISK-002 remains open by decision, not oversight. The Answer List being the sole runtime
  validator is the direct consequence of ADR-002, which was accepted for a 30x pack-size win.
  The residual exposure is that a Build Tool corpus omission silently mis-rejects a valid word.
  No requirement was authored because the mitigation (cross-validation against a secondary
  wordlist) is a build-pipeline lint, and forcing it into the v1 REQ set would gate delivery on
  sourcing a second corpus. Recorded as accepted residual risk.
- The journeys floor is unmet (4 of 6). An UNDERSIZE-WAIVER is recorded in
  ATOMICITY-REPORT.md and requires user approval before overall PASS is declared.
