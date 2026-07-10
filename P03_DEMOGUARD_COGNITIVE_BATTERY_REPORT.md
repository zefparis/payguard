# P-03: DemoGuard Cognitive Battery — Implementation Report

## Overview

Implemented a patent-grade cognitive battery with 6 modules inside DemoGuard mobile in the `payguard` repository. The battery replaces weak single-round cognitive checks with robust, reproducible, mobile-friendly challenges totaling 60–120 seconds.

## Modules

### 1. Reflex (multi-round)
- **File**: `src/demoguard/cognitive/reflexChallenge.ts`
- 5 rounds with random delays (1500–4000ms)
- Detects too-fast (<120ms) and too-slow (>1800ms) responses
- Computes avg, median, variance, min, max, regularity score
- Quality: `failed` if too_fast ≥ 3 or too_slow ≥ 3; `review` if too_fast ≥ 1 or too_slow ≥ 2 or regularity < 0.15

### 2. Stroop
- **File**: `src/demoguard/cognitive/stroopChallenge.ts`
- 6 trials with ~50% conflict trials (word ≠ color)
- 4 colors: red, blue, green, yellow
- Computes accuracy, avg response time, conflict cost (conflict RT − non-conflict RT)
- Quality: `failed` if accuracy < 0.4; `review` if accuracy < 0.6

### 3. Digit Span
- **File**: `src/demoguard/cognitive/digitSpanChallenge.ts`
- 3 trials with progressive span (4 → 5 → 6 digits)
- 3-second display, then user retypes sequence
- Computes max span, accuracy, positional errors
- Quality: `failed` if accuracy < 0.33; `review` if accuracy < 0.67

### 4. N-Back (1-back)
- **File**: `src/demoguard/cognitive/nBackChallenge.ts`
- 8 trials with ~30% targets (letter matches previous)
- User responds "match" or "no match"
- Computes hits, false positives, misses, accuracy, avg response time
- Quality: `failed` if accuracy < 0.4; `review` if accuracy < 0.6

### 5. Trail Tap
- **File**: `src/demoguard/cognitive/trailTapChallenge.ts`
- 5 numbered nodes at random positions
- User taps in order 1 → 5
- Computes completion time, wrong taps, hesitation count (gaps > 1500ms), path efficiency
- Quality: `failed` if wrong_taps ≥ 3; `review` if wrong_taps ≥ 1 or hesitation ≥ 2

### 6. Vocal RAN
- **File**: `src/demoguard/cognitive/vocalRanChallenge.ts`
- 5 random digits displayed, user reads aloud
- Records duration, challenge ID, expected hash (non-cryptographic), audio present
- Raw sequence never exposed in safe output (only hash)
- Quality: `failed` if no audio; `review` if duration < 1000ms or > 15000ms

## Scoring

- **File**: `src/demoguard/cognitive/cognitiveScoring.ts`
- `computeCognitiveSummary()` aggregates all 6 modules
- **depth_score**: completed_modules / total_modules (0–1)
- **consistency_score**: fraction of completed modules with quality 'ok'
- **anomaly_score**: weighted sum of too_fast, robotic regularity, low accuracy, high false positives, wrong taps
- **human_likelihood**: 'high' if depth ≥ 0.5 and anomaly < 0.4; 'medium' if depth ≥ 0.3 or anomaly < 0.6; 'low' otherwise
- **quality**: 'failed' if completed < 3; 'review' if anomaly ≥ 0.4; 'ok' otherwise

## UI Integration

- **File**: `src/pages/DemoGuard.tsx`
- Flow: voice → cognitive-intro (reflex) → stroop → digit-span → nback → trail-tap → vocal-ran → cognitive-summary → device-signals → readiness → submit
- Each module has interactive UI with skip option
- Cognitive proof summary shows modules completed, depth, consistency, anomaly, human likelihood
- Sensor readiness and cognitive depth displayed as separate sections
- Submit button shows warnings when:
  - Cognitive depth < 65%
  - Completed modules < 4

## Data Privacy

- No PII, raw audio, raw sequences, tokens, JWT, sessionToken, hcsCode, or API keys in UI/logs/responses
- Vocal RAN uses `expected_hash` (not `expected_sequence_hash`) to avoid substring "sequence" in safe output
- All cognitive signals use safe summarized metrics only
- Sensitive data (audio) only sent to proxy via `sensitiveRef`, never in UI

## Signal Completeness

- **File**: `src/demoguard/quality/signalCompleteness.ts`
- Total slots: 14 (8 original + 6 cognitive modules)
- Cognitive modules counted as filled when non-null

## Tests

- **File**: `tests/demoguard-cognitive-battery.test.ts` — 39 tests covering all modules, scoring, and UI safety
- Updated `tests/demoguard-module.test.ts`, `tests/demoguard-device-signals.test.ts`, `tests/demoguard-real-signals.test.ts` for new 14-slot completeness
- **All 429 tests pass**, 0 TypeScript errors

## Files Created/Modified

### Created
- `src/demoguard/cognitive/cognitiveTypes.ts`
- `src/demoguard/cognitive/reflexChallenge.ts`
- `src/demoguard/cognitive/stroopChallenge.ts`
- `src/demoguard/cognitive/digitSpanChallenge.ts`
- `src/demoguard/cognitive/nBackChallenge.ts`
- `src/demoguard/cognitive/trailTapChallenge.ts`
- `src/demoguard/cognitive/vocalRanChallenge.ts`
- `src/demoguard/cognitive/cognitiveScoring.ts`
- `tests/demoguard-cognitive-battery.test.ts`

### Modified
- `src/demoguard/types.ts` — added `cognitive?: CognitiveSignals | null`
- `src/demoguard/quality/signalCompleteness.ts` — added cognitive slot counting
- `src/pages/DemoGuard.tsx` — full cognitive battery UI integration
- `tests/demoguard-module.test.ts` — updated completeness expectations
- `tests/demoguard-device-signals.test.ts` — updated completeness expectations
- `tests/demoguard-real-signals.test.ts` — updated completeness expectations

## Mobile Limitations

- Trail Tap uses absolute positioning within a 300×400 container — may need responsive scaling on very small screens
- Vocal RAN reuses existing audio recording infrastructure — requires microphone permission
- Digit Span 3-second display may be too fast for users with cognitive impairments (could be made configurable)
- Total battery duration: ~90–120s depending on user speed

## Impact on P-04

The cognitive battery outputs are now included in the DemoGuard payload under `signals.cognitive`. The next task (P-04) can leverage:
- `cognitive.summary.depth_score` for fusion weighting
- `cognitive.summary.human_likelihood` for decision gating
- Individual module quality flags for granular anomaly analysis
- The `expected_hash` field for Vocal RAN verification without exposing raw sequences

---
@copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
Patents Pending FR2514274 | FR2514546
