# P10 — Behavior-Integrated Touch Report

## Task: P10-BEHAVIOR-INTEGRATED-TOUCH

**Date:** 2026-02-28  
**Repo:** payguard  
**Status:** ✅ Complete — GO for backend propagation

---

## 1. Rationale

Touch was previously a standalone signal collected in isolation (`touchCollector.ts`) — a simple count of touch events over 3 seconds with no context. This provided minimal liveness value.

**P10 transforms touch into a behavioral layer integrated inside cognitive tasks.** Instead of asking "did the user touch the screen?", we now measure *how* the user interacts during cognitive challenges:

- **Timing rhythm** — inter-action intervals, variance
- **Hesitation** — long pauses between interactions
- **Corrections** — deletions, re-taps, changing answers
- **Wrong taps** — incorrect selections (Trail Tap, Stroop, N-Back)
- **Path efficiency** — straightness of trail tap path
- **Pressure** — average force (when available)
- **Decision rhythm** — consistency across tasks
- **Motor confidence** — interaction volume + task coverage

This provides a rich behavioral fingerprint that is far more discriminating than a simple touch count.

---

## 2. Modules Instrumented

All 6 cognitive modules now feed the `TouchBehaviorCollector`:

| Module | Task Name | What's Recorded |
|--------|-----------|-----------------|
| Reflex | `reflex` | Each tap (start, wait, go), too-fast flagged as wrong |
| Stroop | `stroop` | Each color selection, correctness, response time |
| Digit Span | `digit_span` | Each keypress (typing + deletions as corrections), submit |
| N-Back | `n_back` | Each match/no-match decision, correctness |
| Trail Tap | `trail_tap` | Each tap, correctness, path segment distances for efficiency |
| Vocal RAN | `vocal_ran` | Record button interaction (screen interaction present) |

---

## 3. New Files Created

### `src/demoguard/behavior/behaviorTypes.ts`
- `CognitiveTaskName` — union of 6 task names
- `TaskTouchBehavior` — per-task safe aggregates
- `BehaviorSummary` — cross-task summary
- `BehaviorPayload` — full payload for submission
- `TouchDiagnosticsBehaviorSafe` — safe diagnostics

### `src/demoguard/behavior/touchBehaviorCollector.ts`
- Singleton `TouchBehaviorCollector` class
- `recordInteraction()` — called by each cognitive module
- `getSummary()` / `getPayload()` / `getTouchDiagnostics()` — produce safe aggregates
- `reset()` — clears state between sessions
- Touch support detection (`ontouchstart`, `maxTouchPoints`)

### `src/demoguard/behavior/taskBehaviorRecorder.ts`
- Per-task helper functions:
  - `recordReflexTap()`, `recordStroopSelection()`, `recordDigitSpanKey()`, `recordDigitSpanSubmit()`, `recordNBackDecision()`, `recordTrailTap()`, `recordVocalRanInteraction()`
  - `recordTaskStart()` — marks task begin

### `src/demoguard/behavior/behaviorScoring.ts`
- `computeTaskBehavior()` — per-task scoring (timing, hesitation, corrections, path efficiency)
- `computeBehaviorSummary()` — cross-task aggregation (consistency, motor confidence, likelihood, quality)

---

## 4. Metrics Computed

### Per-Task (`TaskTouchBehavior`)
- `interactionCount` — number of touch interactions
- `avgInterActionMs` — mean time between interactions
- `varianceInterActionMs` — variance of inter-action timing
- `hesitationCount` — gaps > 1500ms
- `correctionCount` — deletions, re-taps
- `wrongTapCount` — incorrect taps (Trail Tap only)
- `pressureAvailable` — whether pressure data exists
- `avgPressure` — mean pressure (when available)
- `pathEfficiency` — optimal/actual path ratio (Trail Tap only)
- `behaviorQuality` — ok / review / failed / missing

### Summary (`BehaviorSummary`)
- `tasksObserved` — number of tasks with interactions
- `totalInteractions` — sum across all tasks
- `avgRhythmMs` — mean of per-task avgInterActionMs
- `rhythmVariance` — mean of per-task varianceInterActionMs
- `hesitationTotal` — sum across all tasks
- `correctionTotal` — sum across all tasks
- `consistencyScore` — 0-1 (OK ratio + low corrections + low hesitation)
- `motorConfidence` — 0-1 (interaction volume + task coverage + pressure)
- `behaviorLikelihood` — high / medium / low
- `quality` — ok / review / failed

---

## 5. Diagnostics (`TouchDiagnosticsBehaviorSafe`)

```typescript
{
  status: "ok" | "review" | "missing" | "unsupported",
  supported: boolean,
  interactionCount: number,
  tasksObserved: number,
  quality: "ok" | "review" | "missing" | "unsupported",
  reasonSafe: "behavior_touch_captured" | "behavior_touch_missing" | "touch_unsupported",
  behaviorConsistency: number,
  motorConfidence: number
}
```

- **Desktop:** `status = "unsupported"`, `reasonSafe = "touch_unsupported"`
- **Mobile with interactions:** `status = "ok" | "review"`, `reasonSafe = "behavior_touch_captured"`
- **Mobile without interactions:** `status = "missing"`, `reasonSafe = "behavior_touch_missing"`

---

## 6. Excluded Data (Safety)

The following are **never** stored, transmitted, or logged:

- Raw touch coordinates (x, y)
- Raw tap traces / event lists
- Raw path data
- Pressure series / pressure per tap
- Timestamps (only aggregates transmitted)
- Tokens, JWT, sessionToken
- PII (name, email, phone)
- selfie_b64, voice_b64, raw audio
- Face/vocal embeddings
- Debug, internal, breakdown data

**Verification:** Test `No raw data in payload` checks that JSON.stringify(payload) does not contain any of: `x_coord`, `y_coord`, `clientX`, `clientY`, `pageX`, `pageY`, `tapTrace`, `rawEvents`, `interactions`, `timestamps`, `coordinates`, `path`, `token`, `jwt`, `sessionToken`, `hcsCode`, `first_name`, `last_name`, `email`, `phone`, `selfie_b64`, `voice_b64`, `raw_audio`, `face_embedding`, `vocal_embedding`, `debug`, `internal`, `breakdown`.

---

## 7. UI Changes (`DemoGuard.tsx`)

### Signal Matrix — Touch entry
- Replaced standalone touch quality with behavioral touch status
- Shows "Active" / "Review" / "Missing" based on `behaviorSummary`
- Displays interaction count and tasks observed

### Cognitive Science panel
- Added "Behavioral consistency" row (percentage)
- Added "Motor confidence" row (percentage)

### New: Behavioral Touch panel
- Status badge (Active / Review / Missing)
- Tasks observed (x/6)
- Total interactions
- Motor consistency (%)
- Hesitation level (low / medium / high)
- Behavior likelihood (high / medium / low)

---

## 8. Payload Changes

### `signals.behavior` (new)
```json
{
  "taskBehaviors": {
    "reflex": { "task": "reflex", "interactionCount": 5, ... },
    "stroop": { "task": "stroop", "interactionCount": 6, ... },
    ...
  },
  "summary": {
    "tasksObserved": 5,
    "totalInteractions": 27,
    "avgRhythmMs": 580,
    ...
  }
}
```

### `signals.touchDiagnostics` (updated)
- Now uses behavioral data when available
- Falls back to standalone touch signal if behavior is empty

### `signals.touchDiagnosticsBehavior` (new)
- Full behavioral diagnostics with consistency and motor confidence

---

## 9. Test Results

### New tests: `tests/p10-behavior-integrated-touch.test.ts`
- **19 tests, 19 passed** ✅

Coverage:
- Reflex taps feed behavior collector ✅
- Stroop selections feed behavior collector ✅
- Digit Span typing feeds behavior collector ✅
- N-Back decisions feed behavior collector ✅
- Trail Tap computes wrong taps and path efficiency ✅
- BehaviorSummary counts tasksObserved ✅
- totalInteractions > 0 makes touch status OK ✅
- Mobile cognitive interactions prevent touch_missing ✅
- Pressure unavailable does not fail ✅
- No raw coordinates in payload ✅
- No raw tap trace in payload ✅
- No forbidden fields (PII, tokens, debug) in payload ✅
- BehaviorPayload structure correct ✅
- Behavior scoring functions correct ✅
- DemoGuardSignals type accepts behavior field ✅

### Existing tests
- **529 passed, 4 failed** (all 4 failures pre-existing, unrelated to this task)
- Pre-existing failures: `voice_b64` constant in page source, raw audio UI check

### TypeScript
- `tsc --noEmit` — **0 errors** ✅

### Build
- `vite build` — **success** ✅ (80 modules, 193KB)

---

## 10. Impact on Other Repos

### `hybrid-vector-api`
- **GO** — Can consume `signals.behavior` and `signals.touchDiagnosticsBehavior` in fusion trigger
- `demoguardFusionTrigger.ts` can read `behavior.summary.behaviorLikelihood` and `behavior.summary.motorConfidence` as additional fusion signals
- No breaking changes — new fields are optional

### `hcs-u7-backend`
- **GO** — Can store behavior payload in decision records
- `far-frr.ts` `recordDecision()` can include behavior summary in safe trace
- No breaking changes — new fields are additive

### `hcs-u7-admin`
- **GO** — Can display behavioral touch metrics in E2E trace panel
- `E2ETracePanel.tsx` can show behavioral consistency and motor confidence
- No breaking changes — new fields are optional

### `hybrid-vector-frontend`
- **No changes required** (per task constraints)

---

## 11. Constraints Respected

- ✅ No changes to FAR/FRR formulas, enforcement, autoApply, thresholds
- ✅ No changes to HCS Brain state
- ✅ No changes to hybrid-vector-frontend
- ✅ No raw coordinates, tap traces, raw paths, pressure series, raw event lists
- ✅ No tokens, JWT, sessionToken, PII, internal/debug/breakdown data
- ✅ Desktop returns `unsupported` status
- ✅ Mobile cognitive interactions > 0 prevent `touch_missing`
- ✅ Pressure unavailable does not cause failure
- ✅ Existing cognitive tests still pass
- ✅ DemoGuard submit still works

---

## 12. GO/NO-GO

### **GO** for backend propagation

The payguard implementation is complete, tested, and safe. The behavioral touch layer provides rich liveness signal data that can enhance fusion decisions in `hybrid-vector-api` and monitoring in `hcs-u7-backend` / `hcs-u7-admin`.

---

*© 2026 Benjamin BARRERE / IA SOLUTION — Patents Pending FR2514274 | FR2514546*
