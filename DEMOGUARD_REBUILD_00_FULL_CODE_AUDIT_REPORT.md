# DEMOGUARD-REBUILD-00b — Full Code Audit Report

**Date**: 2026-07-11  
**Scope**: PayGuard DemoGuard module — complete codebase audit (client + proxy + HV API + HCS backend)  
**Constraints**: Audit only, zero refactor, zero backend modification  
**Author**: Cascade (IA SOLUTION)

---

## Table of Contents

- [Section A — Table de Tri](#section-a--table-de-tri)
- [Section B — DemoGuard.tsx Component Audit](#section-b--demoguardtsx-component-audit)
- [Section C — State Machine (Current → Target)](#section-c--state-machine-current--target)
- [Section D — Voice Lifecycle](#section-d--voice-lifecycle)
- [Section E — Touch Chain (Complete Trace)](#section-e--touch-chain-complete-trace)
- [Section F — Responsive Shell](#section-f--responsive-shell)
- [Section G — Payload Builder](#section-g--payload-builder)
- [Section H — Target Architecture](#section-h--target-architecture)
- [Section I — Flag Strategy](#section-i--flag-strategy)
- [Section J — Test Plan](#section-j--test-plan)

---

## Section A — Table de Tri

Every file in the DemoGuard module is evaluated. Verdict: **GARDER** (keep as-is or minor fix), **RÉÉCRIRE** (needs rewrite), **SUPPRIMER** (delete).

### Client — `src/demoguard/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `types.ts` | Type definitions for all signals, payload, response | Clean. `DemoGuardReactionSignal` is used but `reactionCollector.ts` that produces it is dead code. `VOICE_KEY` export is good. | Low | **GARDER** |
| `constants.ts` | Version, source, API path, timeout | Clean. `DEMOGUARD_ENABLED` flag unused in `DemoGuard.tsx` (gate not enforced). | Low | **GARDER** |
| `api.ts` | Fetch wrapper for `/api/demoguard/verify` | Clean. AbortController timeout, error parsing. No issues. | Low | **GARDER** |

### Client — `src/demoguard/behavior/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `behaviorTypes.ts` | Types: `CognitiveTaskName`, `BehaviorSummary`, `BehaviorPayload`, `TouchDiagnosticsBehaviorSafe` | Clean. `vocal_ran` in `CognitiveTaskName` but never recorded. | Low | **GARDER** |
| `behaviorScoring.ts` | `computeTaskBehavior()`, `computeBehaviorSummary()` | Clean pure functions. `HESITATION_THRESHOLD_MS` duplicated in `touchBehaviorCollector.ts`. | Low | **GARDER** |
| `taskBehaviorRecorder.ts` | Per-task recording helpers | Clean. `recordVocalRanInteraction()` never called. | Low | **GARDER** |
| `touchBehaviorCollector.ts` | Singleton collector, `getPayload()`, `getTouchDiagnostics()` | **Singleton pattern** — module-level singleton survives across component remounts. `reset()` only called in `handleStart`. If component unmounts and remounts mid-session, stale interactions persist. `HESITATION_THRESHOLD_MS` duplicated. | Medium | **RÉÉCRIRE** (see Section E) |

### Client — `src/demoguard/cognitive/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `cognitiveTypes.ts` | Shared types for cognitive signals | Clean. `VocalRanSignal` defined but never used in UI. | Low | **GARDER** |
| `cognitiveScoring.ts` | `computeCognitiveSummary()` | Clean pure function. `vocal_ran` always `null` → `total_modules` stays 6 but max completed is 5. | Low | **GARDER** |
| `reflexChallenge.ts` | Reflex test logic | Clean. | Low | **GARDER** |
| `stroopChallenge.ts` | Stroop test logic | Clean. | Low | **GARDER** |
| `digitSpanChallenge.ts` | Digit span test logic | Clean. | Low | **GARDER** |
| `nBackChallenge.ts` | N-Back test logic | Clean. | Low | **GARDER** |
| `trailTapChallenge.ts` | Trail tap test logic | Clean. | Low | **GARDER** |
| `vocalRanChallenge.ts` | Vocal RAN challenge generation | **DEAD CODE**. Never imported by `DemoGuard.tsx`. `vocal_ran` is always `null` in cognitive signals. `recordVocalRanInteraction()` in `taskBehaviorRecorder.ts` is never called. | None | **SUPPRIMER** (confirmed) |

### Client — `src/demoguard/collectors/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `audioCollector.ts` | Voice recording, MFCC, WAV encoding | Clean. Returns safe + sensitive split. `generateChallengePhrase()` is deterministic (same phrase always). | Low | **GARDER** |
| `cameraCollector.ts` | Camera stream + selfie capture | Clean. | Low | **GARDER** |
| `deviceCollector.ts` | Device context (platform, screen, etc.) | Clean. | Low | **GARDER** |
| `motionCollector.ts` | 3s motion sampling | Clean. iOS permission handling. | Low | **GARDER** |
| `networkCollector.ts` | Network info (effective type, rtt) | Clean. | Low | **GARDER** |
| `orientationCollector.ts` | 3s orientation sampling | Clean. iOS permission handling. | Low | **GARDER** |
| `permissionCollector.ts` | Permission status query | Clean. | Low | **GARDER** |
| `reactionCollector.ts` | Reaction time collector (2 rounds) | **DEAD CODE**. Never imported by `DemoGuard.tsx`. The component uses `reflexChallenge.ts` instead (5 rounds, different thresholds). `reactionSignal` state in `DemoGuard.tsx` is always `null` — `setReactionSignal` is never called. | None | **SUPPRIMER** (confirmed) |
| `touchCollector.ts` | 3s touch dynamics sampling | Clean. Separate from behavior touch — this is the device signal collector. | Low | **GARDER** |
| `visibilityCollector.ts` | 3s visibility/focus tracking | Clean. | Low | **GARDER** |

### Client — `src/demoguard/quality/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `signalCompleteness.ts` | `computeQuality()` — signal completeness score | Clean. `reaction` is in `CRITICAL_SLOTS` but `reactionSignal` is always `null` → always counted as missing critical. This artificially lowers the score and may block submission. | Medium | **RÉÉCRIRE** (remove `reaction` from CRITICAL_SLOTS or wire the reaction collector) |
| `audioQuality.ts` | `assessAudioQuality()`, `isAudioUsable()` | Clean. | Low | **GARDER** |
| `deviceSignalQuality.ts` | Motion/orientation/touch/visibility/network quality | Clean. | Low | **GARDER** |
| `selfieQuality.ts` | `assessSelfieQuality()`, `isSelfieUsable()` | Clean. | Low | **GARDER** |

### Client — `src/hooks/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `useStableMobileViewport.ts` | Viewport stabilization during cognitive phases | See Section F for detailed analysis. | Medium | **RÉÉCRIRE** (see Section F) |

### Client — `src/pages/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `DemoGuard.tsx` (1695 lines) | Main component — all phases, state, handlers, UI | See Section B for detailed audit. | High | **RÉÉCRIRE** |
| `demoguard-premium.css` (769 lines) | Styling | See Section F. | Medium | **RÉÉCRIRE** (partial — responsive issues) |

### Proxy — `api/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `demoguard/verify.ts` | Vercel proxy handler | Clean. CORS, rate limiting, tenant injection, safe logging. Forwards body as-is (no stripping). | Low | **GARDER** |
| `_lib/demoguardSanitize.ts` | Response sanitizer | Clean. Strips 20+ forbidden keys from response. | Low | **GARDER** |

### Upstream — `hybrid-vector-api/src/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `routes/demoguard.ts` | HV API endpoint — Zod validation + fusion trigger | **CRITICAL BUG**: Zod schema for `signals` object does NOT include `behavior`, `voiceDiagnostics`, `touchDiagnostics`, or `touchDiagnosticsBehavior`. Zod `z.object()` strips unknown keys by default. These fields are silently stripped during parsing. See Section E. | **Critical** | **RÉÉCRIRE** (add missing fields to Zod schema) |
| `services/demoguardFusionTrigger.ts` | Fusion logic, event publishing, HCS recording | Accesses `payload.demo_guard.signals?.behavior?.summary` and `payload.demo_guard.signals?.touchDiagnosticsBehavior` — but these are `undefined` after Zod stripping. `buildTouchDiagnosticsSafe()` falls through to `touch` signal (device collector, not behavior). | **Critical** | **RÉÉCRIRE** (once Zod fixed, verify access patterns) |
| `services/hcsMonitoringRecorder.ts` | Records decision to HCS backend | Clean. Sends `touchDiagnosticsBehavior` to HCS. But receives `undefined` from fusion trigger due to Zod stripping. | Medium | **GARDER** (fix is upstream in Zod) |
| `types/demoguard.ts` | HV API type definitions | Includes `behavior`, `touchDiagnosticsBehavior` in `DemoGuardSignals` — types are correct, but Zod schema doesn't match. | Low | **GARDER** |

### HCS Backend — `hcs-u7-backend/src/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `routes/monitoring/decision-record.routes.ts` | Receives monitoring record from HV API | Correctly extracts `touchDiagnosticsBehavior` from body. Stores it. | Low | **GARDER** |
| `monitoring/far-frr.ts` | FAR/FRR storage + E2E trace query | Correctly includes `touchDiagnosticsBehavior` in trace response. | Low | **GARDER** |

### Admin — `hcs-u7-admin/`

| File | Responsibility | Issues | Risk | Verdict |
|------|---------------|--------|------|---------|
| `components/admin/E2ETracePanel.tsx` | Displays E2E trace in admin UI | Correctly renders `touchDiagnosticsBehavior`. Warning at line 233: "Behavior data present but touch behavior diagnostics missing" — this is the symptom of the Zod stripping bug. | Low | **GARDER** |

---

## Section B — DemoGuard.tsx Component Audit

### B.1 — Hook Count

| Hook Type | Count | Details |
|-----------|-------|---------|
| `useState` | **38** | See full list below |
| `useRef` | **12** | `sensitiveRef`, `videoRef`, `cameraStreamRef`, `voiceCountdownTimerRef`, `cogGoAtRef`, `cogReflexTimerRef`, `stroopStartRef`, `stroopAdvancingRef`, `stroopResultsRef`, `nbackStartRef`, `nbackAdvancingRef`, `nbackResultsRef`, `trailStartRef`, `trailAreaRef`, `trailNormalizedRef`, `trailEventsRef` (16 total) |
| `useEffect` | **10** | See B.2 for dep analysis |
| `useCallback` | **16** | `handleStart`, `handleCaptureSelfie`, `handleSkipCamera`, `finishToReview`, `handleStartVoiceCountdown`, `handleRecordVoice`, `handleSkipVoice`, `handleVoiceContinue`, `handleVoiceRetake`, `handleCogReflexTap`, `handleSkipCogReflex`, `handleStroopPracticeSelect`, `handleStroopSelect`, `handleDigitSpanSubmit`, `handleNBackPracticeResponse`, `handleNBackResponse`, `handleTrailTap`, `handleReviewContinue`, `handleSubmit` (19 total) |
| `useNavigate` | 1 | |
| `useSearchParams` | 1 | |
| `useStableMobileViewport` | 1 | Custom hook |

**Total useState declarations (38):**
`sessionPublicId`, `phase`, `device`, `permissions`, `selfieSignal`, `reactionSignal`, `voiceSignal`, `motionSignal`, `orientationSignal`, `touchSignal`, `visibilitySignal`, `networkSignal`, `quality`, `response`, `error`, `cameraReady`, `voiceChallengeId`, `voiceRecording`, `voiceDiagnostic`, `voiceCountdown`, `voiceRetakeUsed`, `voiceCaptured`, `cogReflexSignal`, `cogStroopSignal`, `cogDigitSpanSignal`, `cogNBackSignal`, `cogTrailTapSignal`, `cogSummary`, `behaviorSummary`, `cogReflexPhase`, `cogReflexRound`, `cogReflexResults`, `cogLastReflexMs`, `stroopTrials`, `stroopIndex`, `stroopResults`, `stroopPracticeTrials`, `stroopPracticeIndex`, `stroopPracticeMode`, `digitSpanTrials`, `digitSpanIndex`, `digitSpanInput`, `digitSpanResults`, `digitSpanShowDigits`, `nbackTrials`, `nbackIndex`, `nbackResults`, `nbackPracticeTrials`, `nbackPracticeIndex`, `nbackPracticeMode`, `trailNodes`, `trailEvents`, `trailAreaSize`, `reconciledVocalDiag`

### B.2 — useEffect Dependency Analysis

| # | Effect | Deps | Flags |
|---|--------|------|-------|
| 1 | URL param pre-fill (L222) | `[searchParams]` | ✅ Safe |
| 2 | Camera start (L351) | `[phase]` | ⚠️ Reads `videoRef.current` inside — if ref not yet attached, camera starts but video element may be null. Falls through to error handler. |
| 3 | Reflex wait timer (L495) | `[phase, cogReflexPhase]` | ✅ Safe — cleanup clears timeout |
| 4 | Reflex too_early recovery (L505) | `[cogReflexPhase]` | ✅ Safe |
| 5 | Digit span display timer (L622) | `[phase, digitSpanShowDigits, digitSpanIndex]` | ⚠️ `digitSpanIndex` in deps causes re-run when index changes, but `digitSpanShowDigits` is set to `true` before index changes, so timer restarts correctly. Redundant dep. |
| 6 | Voice countdown cleanup (L488) | `[]` (empty) | ✅ Safe — cleanup only |
| 7 | Trail tap area measurement + ResizeObserver (L741) | `[phase]` | ⚠️ **See Section F** — ResizeObserver on trail area can trigger during viewport resize |
| 8 | Device signals collection (L773) | `[phase, permissions]` | ⚠️ `permissions` dep — if permissions object identity changes (e.g., re-render), effect re-runs. In practice, `permissions` is set once in `handleStart` and doesn't change, so low risk. |
| 9 | Readiness quality computation (L812) | `[phase, device, permissions, selfieSignal, reactionSignal, voiceSignal, motionSignal, orientationSignal, touchSignal, visibilitySignal, networkSignal, cogSummary, cogReflexSignal, cogStroopSignal, cogDigitSpanSignal, cogNBackSignal, cogTrailTapSignal, behaviorSummary]` | 🔴 **18 deps — extremely broad**. Any signal change triggers full recomputation. Not a bug per se, but means `computeQuality` runs on every signal update. `reactionSignal` is always `null` (dead state). |
| 10 | Vocal diagnostic reconciliation (L951) | `[response, voiceDiagnostic]` | ✅ Safe |
| 11 | Camera cleanup on unmount (L921) | `[]` (empty) | ✅ Safe |

### B.3 — Stale Closure Analysis

| Handler | Deps | Risk |
|---------|------|------|
| `handleStartVoiceCountdown` (L419) | `[]` (empty deps) | 🔴 **STALE CLOSURE**: Calls `handleRecordVoice()` inside `setInterval` callback, but `handleRecordVoice` is NOT in deps. The interval captures the first render's `handleRecordVoice`. Since `handleRecordVoice` only depends on `voiceChallengeId` (which is stable via `useState(() => generateChallengeId())`), this works by accident. **If `handleRecordVoice` ever depends on changing state, this breaks silently.** |
| `handleStroopSelect` (L582) | `[stroopPracticeMode, phase, stroopIndex, stroopTrials]` | ⚠️ Uses `stroopResultsRef.current` (ref) for accumulating results — correct pattern to avoid stale closure on results. `stroopStartRef.current` is reset after each advance. Deps are sufficient for the state values read. **OK but fragile** — any new state read must be added to deps. |
| `handleNBackResponse` (L671) | `[nbackPracticeMode, phase, nbackIndex, nbackTrials]` | ⚠️ Same pattern as Stroop — uses `nbackResultsRef.current`. Same assessment. |
| `handleTrailTap` (L705) | `[phase, trailEvents, trailNodes]` | ⚠️ `trailEvents` is in deps (state, not ref). Each tap creates `next = [...trailEvents, event]` and calls `setTrailEvents(next)`. This is correct — the handler always sees fresh `trailEvents` because it's in deps. But `trailEventsRef.current = trailEvents` (L307) is set on every render, so it's redundant. |
| `finishToReview` (L400) | `[cogReflexSignal, cogStroopSignal, cogDigitSpanSignal, cogNBackSignal, cogTrailTapSignal]` | ✅ Correct — reads all cognitive signals, all in deps. |
| `handleSubmit` (L846) | 17 deps | ✅ All state values read are in deps. Very long dep list but correct. |

### B.4 — Duplicated Logic

1. **Cognitive signals assembly** — The `CognitiveSignals` object is constructed in 3 places:
   - `finishToReview` (L401-409)
   - Readiness `useEffect` (L814-822)
   - `handleSubmit` (L864-872)
   All three are identical (`vocal_ran: null`). Should be a single helper.

2. **Stroop setup** — The block that transitions to Stroop (generate trials, set practice mode, reset results) is duplicated:
   - `handleCogReflexTap` (L541-547) — after reflex completes
   - `handleSkipCogReflex` (L557-564) — when skipping reflex

3. **N-Back setup** — Similar duplication for N-Back transition:
   - `handleDigitSpanSubmit` (L642-648)
   - (No skip path for digit span, but the pattern would be duplicated if added)

4. **`recordTaskStart('stroop')` called in both** `handleStroopPracticeSelect` (L570) and `handleStroopSelect` (L587) — if practice runs first, `recordTaskStart` is called twice for `stroop`. The second call overwrites `taskStartedAt['stroop']` in the collector, resetting the start time. Minor but means practice interactions are excluded from timing.

5. **`recordTaskStart('n_back')` same issue** — called in both `handleNBackPracticeResponse` (L659) and `handleNBackResponse` (L676).

### B.5 — Dead Phases and State

| Item | Status | Evidence |
|------|--------|----------|
| `reactionSignal` state | **DEAD** | `setReactionSignal` is never called. `reactionSignal` is always `null`. Included in `DemoGuardSignals` payload as `reaction: null`. Listed in `CRITICAL_SLOTS` in `signalCompleteness.ts` → always counts as missing critical. |
| `reactionCollector.ts` | **DEAD** | Never imported. See Section A. |
| `vocalRanChallenge.ts` | **DEAD** | Never imported. `vocal_ran` always `null`. See Section A. |
| `reconciledVocalDiag` state | **ALIVE** | Set in useEffect from response, used in UI panels. |
| `DEMOGUARD_ENABLED` constant | **UNUSED** | Defined in `constants.ts` but never checked in `DemoGuard.tsx`. Component is always rendered regardless of flag. |
| `trailEventsRef` (L306-307) | **REDUNDANT** | `trailEventsRef.current = trailEvents` is set on every render, but `trailEvents` is already in `handleTrailTap` deps. The ref is never read elsewhere. |

### B.6 — Timer Inventory

| Timer | Type | Location | Cleanup |
|-------|------|----------|---------|
| Reflex wait timer | `setTimeout` | L498, ref `cogReflexTimerRef` | ✅ Cleared in effect cleanup |
| Reflex too_early recovery | `setTimeout` | L507 | ✅ Cleared in effect cleanup |
| Digit span display | `setTimeout` | L624 | ✅ Cleared in effect cleanup |
| Voice countdown | `setInterval` | L426, ref `voiceCountdownTimerRef` | ✅ Cleared in effect cleanup + unmount |
| Trail area ResizeObserver | `ResizeObserver` | L760 | ✅ Disconnected in effect cleanup |
| Camera cleanup | (on unmount) | L921 | ✅ `stopCamera` called |

---

## Section C — State Machine (Current → Target)

### Current State Machine

```
idle ──[handleStart]──▶ prep ──[device+perms collected]──▶ camera
                                                              │
                                          ┌───────────────────┼───────────────────┐
                                          │                   │                   │
                                    [capture]            [skip]            [camera error]
                                          │                   │                   │
                                          ▼                   ▼                   ▼
                              cognitive-intro ◀─────────────────────────── cognitive-intro
                                          │
                                    [reflex 5 rounds]
                                          │
                                          ▼
                                  cognitive-stroop
                                          │
                                    [6 trials + 2 practice]
                                          │
                                          ▼
                                cognitive-digit-span
                                          │
                                    [3 trials]
                                          │
                                          ▼
                                  cognitive-nback
                                          │
                                    [8 trials + 3 practice]
                                          │
                                          ▼
                                cognitive-trail-tap
                                          │
                                    [5 nodes]
                                          │
                                          ▼
                                    voice-proof
                                          │
                              ┌───────────┼───────────┐
                              │           │           │
                        [record]      [skip]      [continue]
                              │           │           │
                              ▼           ▼           ▼
                          [captured]  finishToReview  finishToReview
                              │
                        [continue/retake]
                              │
                              ▼
                         finishToReview ──▶ review
                                          │
                                    [handleReviewContinue]
                                          │
                                          ▼
                                  device-signals (3s collection)
                                          │
                                          ▼
                                       readiness
                                          │
                              ┌───────────┼───────────┐
                              │           │           │
                          [submit]    [error]     [retry]
                              │           │           │
                              ▼           ▼           │
                          submitting     error ◀──────┘
                              │
                          [response]
                              │
                              ▼
                            done
```

### Problems with Current State Machine

1. **`reactionSignal` is dead** — `reaction` is in `CRITICAL_SLOTS` but never populated. `overall_ready` is always `false` because `critical_missing` always includes `reaction`. Submit is not blocked by `overall_ready` (only by `behaviorBlocked`), so this doesn't block submission but produces misleading quality scores.

2. **No back navigation** — Once a cognitive test is completed, there's no way to go back. Skip buttons exist for reflex only. If a user makes errors, they can't retry individual tests.

3. **`device-signals` phase is after review** — Device signals (motion, orientation, touch, visibility, network) are collected AFTER the review screen. This means the review screen shows cognitive + behavior results but NOT device signals. The user can't see device signal quality before proceeding.

4. **`voice-proof` is after trail-tap** — Voice is collected after all cognitive tests. If the user is fatigued, voice quality may suffer. Also, if the component is unmounted during voice-proof (e.g., navigation), `sensitiveRef.current[VOICE_KEY]` is lost.

5. **No explicit error recovery for cognitive tests** — If a cognitive test errors, there's no try/catch around the test logic. An exception would crash the component.

### Target State Machine

```
idle ──[handleStart]──▶ prep ──[device+perms]──▶ camera
                                                       │
                                          ┌────────────┼────────────┐
                                          │            │            │
                                    [capture]       [skip]      [error]
                                          │            │            │
                                          ▼            ▼            ▼
                              cognitive-battery ◀────────────── cognitive-battery
                                          │
                                    [reflex → stroop → digit-span → nback → trail-tap]
                                          │
                                          ▼
                                    voice-proof
                                          │
                                          ▼
                                  device-signals (parallel collection)
                                          │
                                          ▼
                                       review (full summary: cognitive + voice + device + behavior)
                                          │
                                          ▼
                                       readiness
                                          │
                                          ▼
                                       submit
```

Key changes:
- Remove `reaction` from critical slots (or wire it)
- Move `device-signals` before `review` so review shows everything
- Merge all cognitive phases into a single `cognitive-battery` phase with sub-step state
- Add error boundaries per cognitive test

---

## Section D — Voice Lifecycle

### D.1 — Functions that write VOICE_KEY / sensitiveRef voice

| Function | Location | Writes | Context |
|----------|----------|--------|---------|
| `handleRecordVoice` | L439-460 | `sensitiveRef.current[VOICE_KEY] = result.sensitive.voice_b64` + `sensitiveRef.current.mfcc_summary = result.sensitive.mfcc_summary` | Called from `handleStartVoiceCountdown` interval callback |
| `handleStartVoiceCountdown` | L419-437 | `delete sensitiveRef.current[VOICE_KEY]` (clears before recording) | Called on "Enregistrer" button click |
| `handleVoiceRetake` | L477-485 | `delete sensitiveRef.current[VOICE_KEY]` (clears before retake) | Called on "Reprendre" button click |
| `handleSkipVoice` | L462-471 | Does NOT clear `sensitiveRef` — but `handleStartVoiceCountdown` already cleared it, and no recording happened, so it's already absent | Called on "Passer" button click |
| `handleStart` | L320-348 | `sensitiveRef.current = {}` (full reset) | Called on "Commencer" button click |

**Total: 2 functions write voice_b64, 3 functions delete it, 1 function resets the entire ref.**

### D.2 — Can the component be unmounted by layout/resize/conditional?

**Analysis of the render tree:**

```tsx
// DemoGuard.tsx L1034-1036
return (
  <div className="dg-app-shell" style={{ ['--dg-stable-frame-width']: `${stableFrameWidth}px` }}>
    <div className="dg-mobile-frame" data-testid="dg-mobile-frame">
      {/* ALL content inside this wrapper */}
    </div>
  </div>
);
```

The component is rendered as a single tree — there are no conditional wrappers that could unmount the component. The `dg-app-shell` and `dg-mobile-frame` divs are always rendered regardless of phase or viewport size.

**However**, the parent route/component that renders `<DemoGuard />` could unmount it. Let's check:

The component is rendered via React Router. If the user navigates away (e.g., clicks the "←" back button at L1044), the component unmounts. This would:
1. Trigger the unmount cleanup effect (L921) — stops camera
2. Trigger the voice countdown cleanup (L488) — clears interval
3. **`sensitiveRef.current` is lost** — refs do not survive unmount

**The component itself cannot be unmounted by resize alone.** The CSS uses `display: flex` and width constraints, not `display: none` or conditional rendering based on viewport. There are no `@media` queries that hide the entire component.

### D.3 — Resize during voice-proof: does voice_b64 survive?

**Trace: resize during voice-proof → submit**

1. User is in `voice-proof` phase
2. `handleRecordVoice` has completed — `sensitiveRef.current[VOICE_KEY]` contains the base64 WAV
3. User triggers a resize (e.g., rotates device, Chrome address bar shows/hides)
4. `useStableMobileViewport` fires `handleResize`:
   - If phase is NOT cognitive (`voice-proof` is not in `COGNITIVE_PHASES`), the resize is NOT ignored
   - `setStableFrameWidth(newWidth)` triggers a re-render
   - The component re-renders with new `--dg-stable-frame-width` CSS variable
   - **`sensitiveRef` is a `useRef` — it survives re-renders**
5. User clicks "Continuer" → `handleVoiceContinue` → `finishToReview()` → `review` phase
6. User proceeds to `readiness` → `handleSubmit`
7. In `handleSubmit` (L906): `sensitive: Object.keys(sensitiveRef.current).length > 0 ? sensitiveRef.current : undefined`
8. **`sensitiveRef.current[VOICE_KEY]` is still present** — refs are not affected by re-renders

**Conclusion: voice_b64 survives resize during voice-proof.** The ref is stable across re-renders. The only way to lose it is:
- Component unmount (navigation away)
- `handleStartVoiceCountdown` or `handleVoiceRetake` (which delete it before re-recording)
- `handleStart` (which resets the entire ref)

### D.4 — Reproducing the vocal disappearance after DEMOGUARD-MOBILE-RESPONSIVE-02

**Hypothesis: The vocal disappearance is NOT caused by resize.**

The `useStableMobileViewport` hook only changes a CSS variable and state (`stableFrameWidth`, `visualViewportHeight`). Neither of these affects `sensitiveRef`. The hook does not unmount or remount the component.

**Most likely cause of vocal disappearance:**

1. **Component unmount/remount during navigation** — If the responsive shell changes caused a route change or conditional rendering at the parent level, the component could unmount and remount, losing `sensitiveRef.current`.

2. **`handleStart` being called again** — If the user accidentally triggers `handleStart` (e.g., by navigating back to idle and clicking "Commencer" again), `sensitiveRef.current = {}` resets everything.

3. **The Zod stripping bug (Section E)** — The voice_b64 IS sent to the proxy and forwarded to HV API. But the HV API's `demoguardPayloadSchema` includes `sensitive.voice_b64` in its schema, so this should pass through. The vocal disappearance in the **response** (not the payload) could be caused by the sanitizer stripping `vocalDiagnostic` fields, or the HCS vocal relay failing.

4. **CSS layout shift causing button mis-taps** — If the responsive changes moved the "Continuer" button position, the user might tap "Passer" instead, which calls `handleSkipVoice` → `finishToReview()` without recording. This would result in `voiceSignal = { recorded: false, quality: 'missing' }` and no `voice_b64` in sensitiveRef.

**Most probable: #4 (button mis-tap due to layout shift) or #1 (parent-level remount).** The resize itself does not destroy the ref.

---

## Section E — Touch Chain (Complete Trace)

### The Problem

> The client displays interactions OK but the admin E2E Trace displays "Touch Missing". Trace the complete chain from collector to admin. Identify where `touchDiagnosticsBehavior` is lost.

### E.1 — Chain Overview

```
[Client] touchBehaviorCollector singleton
    ↓ recordInteraction() calls during cognitive tasks
[Client] getTouchBehaviorCollector().getPayload()
    ↓ produces BehaviorPayload { taskBehaviors, summary }
[Client] getTouchBehaviorCollector().getTouchDiagnostics()
    ↓ produces TouchDiagnosticsBehaviorSafe
[Client] handleSubmit — assembles DemoGuardSignals
    ↓ signals.behavior = behaviorPayload
    ↓ signals.touchDiagnosticsBehavior = behaviorDiag
[Client] submitDemoGuard() — POST /api/demoguard/verify
    ↓ JSON.stringify(payload) — includes behavior + touchDiagnosticsBehavior
[Proxy] api/demoguard/verify.ts
    ↓ Parses body, forwards as-is to HV API
    ↓ Logs: behaviorPresent, touchDiagBehaviorPresent (confirms receipt)
[HV API] routes/demoguard.ts — Zod validation
    ↓ demoguardPayloadSchema.safeParse(req.body)
    ↓ *** ZOD STRIPS behavior, touchDiagnosticsBehavior FROM signals ***
[HV API] triggerHybridFusionFromDemoGuard(payload)
    ↓ payload.demo_guard.signals.behavior → undefined
    ↓ payload.demo_guard.signals.touchDiagnosticsBehavior → undefined
[HV API] buildTouchDiagnosticsSafe(payload)
    ↓ behaviorDiag = undefined → falls through
    ↓ touchDiagnostics = undefined → falls through
    ↓ touch = signals.touch (device collector, not behavior) → uses this
    ↓ Returns TouchDiagnosticsSafe based on DEVICE touch, not BEHAVIOR touch
[HV API] recordDecisionToHCS()
    ↓ behaviorSummary = undefined → not sent to HCS
    ↓ touchDiagnosticsBehavior = undefined → not sent to HCS
[HCS Backend] decision-record.routes.ts
    ↓ Receives no behavior data
    ↓ Stores empty touch diagnostics
[Admin] E2ETracePanel.tsx
    ↓ Reads touchDiagnostics (device-based, may show "missing" if no device touch)
    ↓ Reads touchDiagnosticsBehavior → null (never received)
    ↓ Displays "Touch Missing" or "Behavior data present but touch behavior diagnostics missing"
```

### E.2 — Root Cause: Zod Schema Stripping

**File**: `c:\Users\ia-solution\CascadeProjects\hybrid-vector-api\src\routes\demoguard.ts:39-59`

The Zod schema for `signals` is:

```typescript
signals: z.object({
  selfie: signalSlotSchema,
  reaction: signalSlotSchema,
  voice: signalSlotSchema,
  motion: signalSlotSchema,
  orientation: signalSlotSchema,
  touch: signalSlotSchema,
  visibility: signalSlotSchema,
  network: signalSlotSchema,
  cognitive: z.object({
    summary: z.object({...}).optional(),
  }).optional(),
}),
```

**Zod's `z.object()` by default strips unknown keys.** The following fields are sent by the client but NOT declared in the schema:

- `behavior` — the `BehaviorPayload` with task behaviors and summary
- `voiceDiagnostics` — the `VoiceDiagnosticsSafe` object
- `touchDiagnostics` — the `TouchDiagnosticsSafe` object (from `buildTouchDiagnosticsSafe` in the client)
- `touchDiagnosticsBehavior` — the `TouchDiagnosticsBehaviorSafe` object

After `safeParse()`, these keys are silently removed from `parsed.data.demo_guard.signals`.

### E.3 — Does the payload actually contain the interactions?

**YES.** The client payload is correctly assembled:

```typescript
// DemoGuard.tsx L873-888
const behaviorPayload = getTouchBehaviorCollector().getPayload();
const behaviorDiag = getTouchBehaviorCollector().getTouchDiagnostics();
const signals: DemoGuardSignals = {
  // ...
  behavior: behaviorPayload,           // ← Present in outgoing JSON
  voiceDiagnostics: buildVoiceDiagnosticsSafe(...),
  touchDiagnostics: buildTouchDiagnosticsSafe(...),
  touchDiagnosticsBehavior: behaviorDiag,  // ← Present in outgoing JSON
};
```

The proxy forwards the body as-is (no transformation). The proxy even logs the presence of behavior data:

```typescript
// verify.ts L227-238
const behaviorData = voiceSignal?.behavior as Record<string, unknown> | undefined;
const touchDiagBehavior = voiceSignal?.touchDiagnosticsBehavior as Record<string, unknown> | undefined;
safeLog('info', {
  event: 'demoguard_behavior_signal',
  behaviorPresent: !!behaviorData,
  behaviorTasksObserved: behaviorSummary?.tasksObserved ?? 0,
  behaviorTotalInteractions: behaviorSummary?.totalInteractions ?? 0,
  touchDiagBehaviorPresent: !!touchDiagBehavior,
  touchDiagStatus: touchDiagBehavior?.status ?? 'missing',
});
```

**Note**: The proxy log uses `voiceSignal` (which is actually `body.demo_guard.signals`) — variable naming is misleading but functionally correct.

### E.4 — The Fix (Not implementing — audit only)

The Zod schema needs `.passthrough()` on the signals object, or explicit fields for `behavior`, `voiceDiagnostics`, `touchDiagnostics`, and `touchDiagnosticsBehavior`:

```typescript
// Option A: Add .passthrough() to signals
signals: z.object({
  selfie: signalSlotSchema,
  // ...
  cognitive: z.object({...}).optional(),
  behavior: z.object({}).passthrough().optional(),
  voiceDiagnostics: z.object({}).passthrough().optional(),
  touchDiagnostics: z.object({}).passthrough().optional(),
  touchDiagnosticsBehavior: z.object({}).passthrough().optional(),
}),
```

### E.5 — Additional Touch Chain Issues

1. **Singleton persistence** — `touchBehaviorCollector` is a module-level singleton. If the user navigates away and comes back without clicking "Commencer" (which calls `resetTouchBehaviorCollector()`), stale interactions from a previous session persist.

2. **`recordTaskStart` called twice for stroop and n_back** — Practice mode calls `recordTaskStart('stroop')` at L570, then the first real trial calls it again at L587. This overwrites `taskStartedAt['stroop']`, meaning the timing of the first real trial is measured from the first real trial, not from practice start. This is actually correct behavior (we want real trial timing), but the double call is sloppy.

3. **`touchDiagnostics` vs `touchDiagnosticsBehavior` confusion** — The client sends BOTH:
   - `touchDiagnostics`: built from `buildTouchDiagnosticsSafe(touchSignal, behaviorDiag)` — falls back to device touch signal
   - `touchDiagnosticsBehavior`: the behavior-based diagnostics directly from the collector
   
   The HV API's `buildTouchDiagnosticsSafe()` checks `touchDiagnosticsBehavior` first, then `touchDiagnostics`, then `touch`. But since both are stripped by Zod, it falls through to `touch` (the device touch signal), which may show `missing` if the 3s device touch collection didn't capture any touches.

---

## Section F — Responsive Shell

### F.1 — Wrapper Inventory

| Wrapper | CSS Class | Key Properties | Location |
|---------|-----------|----------------|----------|
| Outer shell | `.dg-app-shell` | `width: 100%`, `min-height: 100dvh`, `overflow-x: hidden`, `display: flex`, `justify-content: center` | L1035 (JSX), CSS L2-28 |
| Mobile frame | `.dg-mobile-frame` | `width: min(100%, var(--dg-stable-frame-width, 430px))`, `max-width: 430px`, `flex: 1` | L1036 (JSX), CSS L30-42 |
| Test card | `.dg-test-card` | `min-height: clamp(360px, calc(100dvh - 230px), 560px)`, `flex-shrink: 0` | L1124 (JSX), CSS L120-133 |
| Trail area | `.dg-trail-area` | `height: clamp(300px, calc(100dvh - 320px), 420px)` | L1269 (JSX), CSS L614-627 |
| Sticky bar | `.dg-sticky-bar` | `position: fixed`, `bottom: 0`, `max-width: 460px` | L1636 (JSX), CSS L390-406 |

### F.2 — CSS `100dvh` Usage

| Selector | Property | Value | Risk |
|----------|----------|-------|------|
| `.dg-app-shell` | `min-height` | `100dvh` | ✅ Good — dynamic viewport height |
| `.dg-test-card` | `min-height` | `clamp(360px, calc(100dvh - 230px), 560px)` | ⚠️ If `100dvh` changes during Chrome address bar show/hide, the test card height changes, causing layout shift |
| `.dg-trail-area` | `height` | `clamp(300px, calc(100dvh - 320px), 420px)` | ⚠️ Same — trail area height changes with address bar |

### F.3 — `ResizeObserver` Usage

**Location**: `DemoGuard.tsx` L760-763

```typescript
const ro = new ResizeObserver(() => {
  measure();
});
ro.observe(el);
```

**Behavior**: The ResizeObserver watches `trailAreaRef` (the trail tap area div). When the element's size changes (due to viewport resize, address bar show/hide, or CSS `100dvh` changes), it:
1. Measures the new `width` and `height` via `getBoundingClientRect()`
2. Calls `setTrailAreaSize({ w, h })` — triggers re-render
3. Calls `computeTrailTapLayout()` to reposition nodes

**Risk**: During `cognitive-trail-tap`, if a resize occurs:
- Nodes are repositioned → user may tap wrong node
- `trailNodes` state changes → `handleTrailTap` deps include `trailNodes` → handler is recreated
- If the user is mid-tap, the tap target moves

**This is NOT the same as the `useStableMobileViewport` resize handler.** The viewport handler ignores resizes during cognitive phases (≤50px width change), but the ResizeObserver on the trail area does NOT have this guard — it always re-measures and repositions.

### F.4 — `useStableMobileViewport` Real Behavior

**File**: `c:\Users\ia-solution\CascadeProjects\HCS\payguard\src\hooks\useStableMobileViewport.ts`

**What it does:**
1. Listens to `window.resize` and `window.visualViewport.resize`
2. Computes `stableFrameWidth = min(visualViewportWidth ?? innerWidth, 430)`
3. During cognitive phases (`cognitive-intro`, `cognitive-stroop`, `cognitive-digit-span`, `cognitive-nback`, `cognitive-trail-tap`), ignores width changes ≤50px
4. Sets `--dg-stable-frame-width` CSS variable on the shell

**What it does NOT do:**
- Does NOT prevent height changes — `visualViewportHeight` is always updated
- Does NOT lock the viewport — it only controls the width CSS variable
- Does NOT prevent the Chrome address bar from showing/hiding
- Does NOT prevent `100dvh` from changing in CSS
- Does NOT prevent the ResizeObserver on trail area from firing

**The `shouldIgnoreViewportResizeDuringCognitive` function:**
```typescript
export function shouldIgnoreViewportResizeDuringCognitive(
  prevWidth: number,
  newWidth: number,
  phase: string,
): boolean {
  if (!isCognitivePhase(phase)) return false;
  return Math.abs(newWidth - prevWidth) <= 50;
}
```

This only ignores WIDTH changes ≤50px during cognitive phases. HEIGHT changes (address bar show/hide) are NOT ignored — `setVisualViewportHeight` is called unconditionally inside `handleResize` (L87-89), even when the width change is ignored.

**Wait — re-reading the code:**

```typescript
const handleResize = useCallback(() => {
  // ...
  if (shouldIgnoreViewportResizeDuringCognitive(prevWidthRef.current, newWidth, currentPhase)) {
    // LOGS AND RETURNS EARLY
    return;  // ← L82
  }
  // Height update only happens if we DON'T return early
  prevWidthRef.current = newWidth;
  setStableFrameWidth(newWidth);
  if (window.visualViewport) {
    setVisualViewportHeight(window.visualViewport.height);  // ← L88
  }
}, []);
```

Actually, if the width change is ≤50px during cognitive phase, the function returns early (L82) and does NOT update `visualViewportHeight`. So height changes that accompany small width changes ARE ignored. But if the width changes >50px (e.g., orientation change), both width and height are updated.

**The real issue**: The `100dvh` CSS unit is NOT controlled by this hook. The browser automatically updates `100dvh` when the dynamic viewport changes. So even if the hook ignores the resize, the CSS `clamp(360px, calc(100dvh - 230px), 560px)` on `.dg-test-card` still changes height. This causes the trail area to resize, triggering the ResizeObserver, which repositions nodes.

### F.5 — What can change the format during `cognitive-stroop`?

1. **Chrome address bar show/hide** — Changes `100dvh`, which changes `.dg-test-card` min-height. The Stroop word and buttons are inside the test card, so they may shift vertically. The `useStableMobileViewport` hook ignores width changes ≤50px, but the CSS height change still happens.

2. **Visual viewport resize** — `window.visualViewport.resize` fires. The hook may or may not update `stableFrameWidth` depending on width delta. If width changes >50px (e.g., keyboard appears), the frame width changes, causing horizontal reflow.

3. **Orientation change** — Width changes >50px, hook updates `stableFrameWidth`, CSS variable changes, frame width changes. All cognitive test elements reflow.

4. **`isCognitivePhase` check** — `cognitive-stroop` IS in the cognitive phases set, so width changes ≤50px are ignored. But the CSS `100dvh` change is NOT ignored.

### F.6 — Conditional Rendering That Affects Layout

| Phase | Conditionals | Effect |
|-------|-------------|--------|
| `cognitive-stroop` | `stroopPracticeMode` toggles practice vs real trials | Different JSX blocks rendered |
| `cognitive-digit-span` | `digitSpanShowDigits` toggles digit display vs keypad | Different JSX blocks rendered |
| `cognitive-nback` | `nbackPracticeMode` toggles practice vs real | Different JSX blocks rendered |
| All cognitive | `isCognitivePhase(phase)` wraps the test card | Test card appears/disappears |
| All cognitive + voice | Compact status row shown (L1114) | Additional 36px height element |
| Signal matrix | Hidden during cognitive phases (L1411) | Prevents layout shift — good |

**Key finding**: The compact status row (L1114-1120) is rendered during ALL cognitive phases AND `voice-proof`. This adds 36px of height. When transitioning from `camera` (no status row) to `cognitive-intro` (status row appears), there's a 36px layout shift.

---

## Section G — Payload Builder

### G.1 — Current Payload Assembly

The payload is assembled in `handleSubmit` (L846-918):

```typescript
const cogSignals: CognitiveSignals | null = cogSummary ? {
  reflex: cogReflexSignal,
  stroop: cogStroopSignal,
  digit_span: cogDigitSpanSignal,
  n_back: cogNBackSignal,
  trail_tap: cogTrailTapSignal,
  vocal_ran: null,                    // ← Always null (dead module)
  summary: cogSummary,
} : null;

const behaviorPayload = getTouchBehaviorCollector().getPayload();
const behaviorDiag = getTouchBehaviorCollector().getTouchDiagnostics();

const signals: DemoGuardSignals = {
  selfie: selfieSignal,
  reaction: reactionSignal,           // ← Always null (dead collector)
  voice: voiceSignal,
  motion: motionSignal,
  orientation: orientationSignal,
  touch: touchSignal,
  visibility: visibilitySignal,
  network: networkSignal,
  cognitive: cogSignals,
  behavior: behaviorPayload,
  voiceDiagnostics: buildVoiceDiagnosticsSafe(voiceSignal, voiceDiagnostic, !!sensitiveRef.current[VOICE_KEY]),
  touchDiagnostics: buildTouchDiagnosticsSafe(touchSignal, behaviorDiag),
  touchDiagnosticsBehavior: behaviorDiag,
};
```

### G.2 — Issues

1. **`reaction: reactionSignal` is always `null`** — This is a dead field. It's in `CRITICAL_SLOTS` in `signalCompleteness.ts`, so `critical_missing` always includes `'reaction'`, and `overall_ready` is always `false`.

2. **`vocal_ran: null` is always null** — Dead module. Counts as 0/6 in `total_modules` for cognitive scoring, making `depth_score` max out at 5/6 = 83% even with all tests passed.

3. **`behavior` and `touchDiagnosticsBehavior` are correctly populated** — The client does the right thing. The data is lost downstream in the HV API Zod schema (see Section E).

4. **`touchDiagnostics` is built from `buildTouchDiagnosticsSafe(touchSignal, behaviorDiag)`** — This function (L177-209) prefers `behaviorDiag` if present, otherwise falls back to `touchSignal` (device collector). This is correct — but since the HV API strips it, it doesn't matter.

5. **Duplicate cognitive signals assembly** — Same object built 3 times (see B.4).

6. **`quality` is recomputed if `null`** — `const q = quality ?? computeQuality(signals, device, permissions);` — The readiness effect should have set `quality` already, but this is a fallback. Correct.

### G.3 — Sensitive Payload

```typescript
sensitive: Object.keys(sensitiveRef.current).length > 0 ? sensitiveRef.current : undefined,
```

This correctly sends `sensitiveRef.current` only if it has keys. The `sensitiveRef` may contain:
- `selfie_b64` — set in `handleCaptureSelfie` via `Object.assign`
- `voice_b64` — set in `handleRecordVoice`
- `mfcc_summary` — set in `handleRecordVoice`

All three are correctly typed in `DemoGuardSensitive`.

---

## Section H — Target Architecture

### H.1 — Current Architecture Problems

1. **Monolithic component** — 1695 lines, 38 useState, 16 useRef, 10 useEffect in a single component
2. **Singleton collector** — Module-level singleton for touch behavior, survives remounts
3. **Dead code** — `reactionCollector.ts`, `vocalRanChallenge.ts`, `reactionSignal` state
4. **Zod schema mismatch** — HV API strips behavior data (Section E)
5. **CSS `100dvh` dependency** — Layout shifts during address bar show/hide
6. **No error boundaries** — Cognitive test errors crash the component
7. **No retry for individual tests** — Only reflex has a skip button

### H.2 — Target Architecture

```
DemoGuard/
├── DemoGuard.tsx                    # Orchestrator only — phase routing, <200 lines
├── hooks/
│   ├── useDemoGuardSession.ts       # Session state: sessionPublicId, phase, error, response
│   ├── useCameraCapture.ts          # Camera + selfie state + handlers
│   ├── useCognitiveBattery.ts       # All cognitive test state + handlers
│   ├── useVoiceProof.ts             # Voice recording state + handlers
│   ├── useDeviceSignals.ts          # Motion/orientation/touch/visibility/network
│   └── usePayloadBuilder.ts         # Assembles DemoGuardPayload from all signals
├── components/
│   ├── IdleScreen.tsx
│   ├── PrepScreen.tsx
│   ├── CameraScreen.tsx
│   ├── CognitiveTestCard.tsx        # Shared card for all cognitive tests
│   ├── ReflexTest.tsx
│   ├── StroopTest.tsx
│   ├── DigitSpanTest.tsx
│   ├── NBackTest.tsx
│   ├── TrailTapTest.tsx
│   ├── VoiceProofScreen.tsx
│   ├── ReviewScreen.tsx
│   ├── ReadinessScreen.tsx
│   ├── ResultPanels/
│   │   ├── CognitivePanel.tsx
│   │   ├── BehaviorPanel.tsx
│   │   ├── VoicePanel.tsx
│   │   ├── DecisionPanel.tsx
│   │   └── MonitoringPanel.tsx
│   └── StickyActionBar.tsx
├── state/
│   └── demoguardStore.ts            # Zustand or useReducer — replaces 38 useState
└── ...existing demoguard/ modules (cognitive, behavior, collectors, quality)
```

### H.3 — Key Architectural Decisions

1. **Replace singleton with React context** — `TouchBehaviorCollector` should be instantiated per-session, not module-level. Use a React context or `useRef` at the orchestrator level.

2. **Centralized state** — Use `useReducer` or Zustand for the 38+ state variables. This eliminates stale closure risks and dep array issues.

3. **Remove dead code** — Delete `reactionCollector.ts`, `vocalRanChallenge.ts`, remove `reactionSignal` state, remove `reaction` from `CRITICAL_SLOTS`.

4. **Fix Zod schema** — Add `behavior`, `voiceDiagnostics`, `touchDiagnostics`, `touchDiagnosticsBehavior` to the HV API Zod schema (or use `.passthrough()`).

5. **CSS: replace `100dvh` with JS-controlled height** — Use `visualViewport.height` from `useStableMobileViewport` to set explicit pixel heights, preventing CSS-driven layout shifts.

6. **Error boundaries per test** — Wrap each cognitive test in an error boundary that allows retry.

---

## Section I — Flag Strategy

### I.1 — Current Flags

| Flag | Location | Used | Effect |
|------|----------|------|--------|
| `DEMOGUARD_ENABLED` | `constants.ts` L11-12 | ❌ Not checked in `DemoGuard.tsx` | Component always renders |
| `import.meta.env.DEV` | Various | ✅ Console logging in dev mode | Debug logs |

### I.2 — Recommended Flag Strategy for Rebuild

| Flag | Purpose | Default | Scope |
|------|---------|---------|-------|
| `VITE_DEMOGUARD_ENABLED` | Gate the entire DemoGuard route | `false` | Route level |
| `VITE_DG_BEHAVIOR_ENABLED` | Enable/disable touch behavior collection | `true` | Feature level |
| `VITE_DG_VOICE_ENABLED` | Enable/disable voice proof phase | `true` | Feature level |
| `VITE_DG_COGNITIVE_MODULES` | Comma-separated list of active modules | `reflex,stroop,digit_span,n_back,trail_tap` | Feature level |
| `VITE_DG_DEVICE_SIGNALS` | Enable/disable device signal collection | `true` | Feature level |
| `VITE_DG_SKIP_ALLOWED` | Allow skipping individual tests | `false` | UX level |

### I.3 — Migration Strategy

1. **Phase 1**: Add `VITE_DEMOGUARD_ENABLED` check at route level — prevents rendering if disabled
2. **Phase 2**: Add per-feature flags during rebuild — allows incremental rollout
3. **Phase 3**: Remove flags for stable features, keep only `VITE_DEMOGUARD_ENABLED`

---

## Section J — Test Plan

### J.1 — Unit Tests (Vitest)

| Test File | Scope | Priority |
|-----------|-------|----------|
| `behaviorScoring.test.ts` | `computeTaskBehavior()` + `computeBehaviorSummary()` with various interaction patterns | High |
| `touchBehaviorCollector.test.ts` | Singleton lifecycle: record → getPayload → getTouchDiagnostics → reset | High |
| `cognitiveScoring.test.ts` | `computeCognitiveSummary()` with 0-6 modules, various qualities | High |
| `signalCompleteness.test.ts` | `computeQuality()` with missing critical vs optional signals | Medium |
| `buildTouchDiagnosticsSafe.test.ts` | Fallback logic: behaviorDiag → touchSignal → missing | High |
| `buildVoiceDiagnosticsSafe.test.ts` | Three branches: diagnostic present, signal present, both absent | Medium |
| `useStableMobileViewport.test.ts` | `shouldIgnoreViewportResizeDuringCognitive()` with various deltas | Medium |

### J.2 — Integration Tests (Vitest + jsdom)

| Test | Scope | Priority |
|------|-------|----------|
| Payload assembly | Verify `handleSubmit` produces correct `DemoGuardPayload` shape with all fields | High |
| Zod schema validation | Verify HV API schema accepts/rejects payloads correctly — **must include behavior + touchDiagnosticsBehavior** | **Critical** |
| Proxy forwarding | Verify proxy forwards all fields without stripping | High |
| Sanitizer | Verify `sanitizeResponse()` strips forbidden keys but preserves safe diagnostics | Medium |

### J.3 — E2E Tests (Playwright)

| Test | Steps | Priority |
|------|-------|----------|
| Happy path submit | idle → prep → camera → all cognitive → voice → review → device-signals → readiness → submit → done | High |
| Skip camera | idle → prep → camera → skip → cognitive → voice → submit | Medium |
| Skip voice | idle → prep → camera → cognitive → voice-proof → skip → review → submit | Medium |
| Behavior block | Complete cognitive tests without touch interactions → verify submit blocked | High |
| Voice retake | Record voice → retake → verify first recording is cleared from sensitiveRef | Medium |
| Resize during cognitive | Start Stroop → trigger resize → verify test card doesn't shift layout | High |
| Resize during voice-proof | Record voice → trigger resize → submit → verify voice_b64 in payload | **Critical** |
| Touch chain E2E | Complete all cognitive tests → submit → verify behavior + touchDiagnosticsBehavior in HV API received payload | **Critical** |
| Vocal RAN absence | Verify `vocal_ran` is always `null` in payload (dead module) | Low |
| Reaction absence | Verify `reaction` is always `null` in payload (dead collector) | Low |

### J.4 — Regression Tests (Post-Fix)

| Test | Trigger | Expected |
|------|---------|----------|
| Zod fix | Send payload with `behavior` and `touchDiagnosticsBehavior` | HV API preserves both fields in `parsed.data` |
| Admin E2E trace | Submit DemoGuard → open admin E2E trace | `touchDiagnosticsBehavior` shows correct status and interaction count |
| Behavior status | Submit with 20+ interactions across 5 tasks | `behaviorStatus` = `ok` in admin trace |
| Behavior missing | Submit with 0 interactions | `behaviorStatus` = `missing` in admin trace |

---

## Summary of Critical Findings

| # | Finding | Severity | Section |
|---|---------|----------|---------|
| 1 | **Zod schema strips `behavior` and `touchDiagnosticsBehavior`** from signals in HV API — root cause of "Touch Missing" in admin | **Critical** | E |
| 2 | `reactionSignal` is dead state — `reaction` in `CRITICAL_SLOTS` makes `overall_ready` always `false` | High | A, B, G |
| 3 | `vocalRanChallenge.ts` and `reactionCollector.ts` are dead code — confirmed SUPPRIMER | Medium | A |
| 4 | `useStableMobileViewport` does not prevent CSS `100dvh` layout shifts during cognitive tests | Medium | F |
| 5 | `ResizeObserver` on trail area repositions nodes during resize without cognitive phase guard | Medium | F |
| 6 | `handleStartVoiceCountdown` has stale closure risk — `handleRecordVoice` not in deps | Medium | B |
| 7 | `touchBehaviorCollector` singleton survives component remount — stale data risk | Medium | A, E |
| 8 | 1695-line monolithic component with 38 useState — unmaintainable | Medium | B, H |
| 9 | Voice_b64 survives resize (ref stable) — vocal disappearance likely caused by button mis-tap or parent remount, not resize | Low | D |
| 10 | `DEMOGUARD_ENABLED` flag is defined but never checked | Low | A, I |

---

*End of audit report. No code was modified. All findings are descriptive and actionable for the rebuild phase.*
