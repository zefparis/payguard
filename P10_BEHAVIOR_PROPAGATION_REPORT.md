# P10 — Behavior Propagation Report

## Overview

Propagation of integrated behavioral touch diagnostics from PayGuard through Hybrid Vector API, HCS Backend, and Admin panel.

**Status: GO**

---

## Contracts

### BehaviorSummarySafe

```typescript
interface BehaviorSummarySafe {
  tasksObserved: number;
  totalInteractions: number;
  avgRhythmMs: number | null;
  rhythmVariance: number | null;
  hesitationTotal: number;
  correctionTotal: number;
  consistencyScore: number;      // 0–1
  motorConfidence: number;       // 0–1
  behaviorLikelihood: 'high' | 'medium' | 'low';
  quality: 'ok' | 'review' | 'failed';
}
```

### TouchDiagnosticsBehaviorSafe

```typescript
interface TouchDiagnosticsBehaviorSafe {
  status: 'ok' | 'review' | 'missing' | 'unsupported';
  supported: boolean;
  interactionCount: number;
  tasksObserved: number;
  quality: 'ok' | 'review' | 'missing' | 'unsupported';
  reasonSafe: string;
  behaviorConsistency: number;   // 0–1
  motorConfidence: number;       // 0–1
}
```

### Behavior Status Rules

| Condition | Status |
|-----------|--------|
| No summary or totalInteractions ≤ 0 | `missing` |
| tasksObserved ≥ 3 AND motorConfidence ≥ 0.65 | `ok` |
| tasksObserved < 2 | `review` |
| Otherwise | `ok` |

Behavior cannot force APPROVED alone but can cap decision at REVIEW.

---

## Propagation

### Part A — Hybrid Vector API

**Files modified:**
- `src/types/demoguard.ts` — Added `BehaviorSummarySafe`, `TouchDiagnosticsBehaviorSafe` types; added `behavior`, `touchDiagnosticsBehavior` to `DemoGuardSignals`; added `behaviorSummary`, `touchDiagnosticsBehavior`, `behaviorStatus` to `DemoGuardSignalsReadyEvent`, `HybridDecisionFinalEvent`, `DemoGuardHybridFusion`
- `src/services/demoguardFusionTrigger.ts` — Added `computeBehaviorStatus()` function; enriched `buildSignalsReadyEvent` with behavior summary and touch diagnostics behavior; enriched `buildDecisionFinalEvent` with behavior status, summary, and touch diagnostics; `buildTouchDiagnosticsSafe()` now prioritizes behavior diagnostics when available, overriding missing status; monitoring recorder call includes behavior fields; return output includes behavior fields
- `src/services/hcsMonitoringRecorder.ts` — Added `behaviorSummary` and `touchDiagnosticsBehavior` to `MonitoringDecisionRecord` interface
- `src/routes/demoguard.ts` — Added behavior fields to safe response `hybridFusion` object

**Events enriched:**
- `demoguard.signals.ready` — includes `behaviorSummary` and `touchDiagnosticsBehavior`
- `hybrid.decision.final` — includes `behaviorStatus`, `behaviorSummary`, `touchDiagnosticsBehavior`

**Tests:** 11 tests — `tests/p10-behavior-propagation.test.ts`
- Acceptance of behavior summary and touch diagnostics in payload
- Propagation in signals ready and decision final events
- Behavior sent to monitoring recorder
- No raw touch data propagated (forbidden fields check)
- Touch missing overridden by behavior interactions > 0
- Behavior status computation (missing/review/ok)
- taskBehaviors not propagated in events

### Part B — HCS Backend

**Files modified:**
- `src/monitoring/far-frr.ts` — Added `behaviorSummary` and `touchDiagnosticsBehavior` to `DecisionRecord` interface; added same fields plus `behaviorStatus` to `SafeTraceDetail` interface; `lookupTrace()` returns behavior fields and computes `behaviorStatus` from `behaviorSummary`
- `src/routes/monitoring/decision-record.routes.ts` — Extracts `behaviorSummary` and `touchDiagnosticsBehavior` from request body; includes in `DecisionRecord`; added raw behavior fields to `FORBIDDEN_FIELDS`
- `src/routes/admin/trace-lookup.ts` — Added raw behavior fields to `FORBIDDEN_TRACE_KEYS`

**FAR/FRR formulas:** Unchanged. Gray-zone scores remain 50/50. Behavior fields are additive metadata only.

**Tests:** 12 tests — `tests/p10-behavior-propagation.test.ts`
- DecisionRecord accepts behavior fields
- SafeTraceDetail includes behavior fields
- Behavior status computation logic
- Forbidden raw behavior fields verification
- FAR/FRR formulas unchanged

### Part C — Admin E2E Trace Panel

**Files modified:**
- `components/admin/E2ETracePanel.tsx` — Added `behaviorSummary`, `touchDiagnosticsBehavior`, `behaviorStatus` to `SafeTraceDetail` interface; added raw behavior fields to `FORBIDDEN_KEYS`; added 6 behavior warnings; added behavior summary, touch diagnostics behavior, and behavior status display sections

**Warnings added:**
- Behavior data present but touch behavior diagnostics missing
- Behavior quality: failed
- Behavior quality: review
- Behavior status missing despite DemoGuard submitted
- Behavior status: review
- Behavior status: failed

### Part D — Admin Cognitive Command Center

**Files modified:**
- `lib/cognitive-terminal-utils.ts` — Added raw behavior fields to `FORBIDDEN_KEYS`; added `behaviorSummary`, `touchDiagnosticsBehavior`, `behaviorStatus` to `DemoGuardSignalsInfo` interface; `extractDemoGuardSignalsInfo()` extracts behavior fields from payload
- `app/(admin)/cognitive-terminal/page.tsx` — Added behavior summary panel (behavioral consistency, motor confidence, behavior likelihood, tasks observed, total interactions, behavior quality), touch diagnostics behavior panel (status, interactions, consistency, motor confidence), and behavior status badge

**Tests:** 19 tests — `tests/p10-behavior-propagation.test.ts`
- Forbidden keys include raw behavior data (6 tests)
- sanitizeEventForDisplay removes raw behavior data (2 tests)
- extractDemoGuardSignalsInfo extracts behavior fields (5 tests)
- E2ETracePanel behavior warnings logic (6 tests)

---

## Exclusions — Raw Data Never Propagated

The following fields are in forbidden sets across all repos:

- `taskBehaviors`, `task_behaviors`
- `raw_touch_events`, `raw_pointer_events`
- `raw_pressure_series`, `raw_interaction_log`
- `raw_coordinates`

Additionally, all pre-existing forbidden fields remain enforced:
- `selfie_b64`, `voice_b64`, `raw_audio`, `raw_image`, `raw_motion_trace`, `raw_touch_trace`
- `face_embedding`, `vocal_embedding`, `mfcc`, `mfcc_raw`, `mfcc_summary`, `voiceprint`
- `first_name`, `last_name`, `student_id`, `email`, `phone`
- `token`, `jwt`, `sessionToken`, `hcsResultToken`, `hcsCode`
- `components`, `breakdown`, `detail`, `debug`, `internal`
- `raw_trials`, `raw_sequence`, `sequence`, `tap_trace`, `raw_tap_trace`
- `cognitive_token`, `challenge_secret`, `expected_sequence`
- `internal_scoring`, `module_breakdown`

---

## Test Results

| Repo | Test File | Tests | Status |
|------|-----------|-------|--------|
| hybrid-vector-api | tests/p10-behavior-propagation.test.ts | 11 | ✅ PASS |
| hcs-u7-backend | tests/p10-behavior-propagation.test.ts | 12 | ✅ PASS |
| hcs-u7-admin | tests/p10-behavior-propagation.test.ts | 19 | ✅ PASS |
| hcs-u7-admin | tests/cognitive-terminal-utils.test.ts | 61 | ✅ PASS (no regression) |
| **Total** | | **103** | **✅ ALL PASS** |

TypeScript compilation: `npx tsc --noEmit` passes on hybrid-vector-api.

---

## Unchanged Systems

- FAR/FRR formulas and thresholds — unchanged
- Cognitive scoring — unchanged
- Enforcement and autoApply — unchanged
- BRAIN_STATE — unchanged
- hcs-u7-dashboard — not modified
- hybrid-vector-frontend — not modified
- PayGuard frontend UI — not modified (only admin panel)

---

## GO/NO-GO

**GO** — All tests pass, types compile, no raw data propagated, behavior status logic implemented, admin panels display behavior diagnostics with warnings.

---

*Copyright (c) 2026 Benjamin BARRERE / IA SOLUTION*
*Patents Pending FR2514274 | FR2514546*
