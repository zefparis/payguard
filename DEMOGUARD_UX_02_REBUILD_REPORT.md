# DEMOGUARD UX-02 REBUILD REPORT

## Date: 2026-03-XX

## Summary

Complete rebuild of the DemoGuard mobile UX based on DEMOGUARD-UX-01 investigation findings. The entire user flow has been simplified, translated to French, and restructured around a clear guided progression with practice trials, single voice capture, and behavior touch guarding.

---

## Changes

### 1. Phase Flow Rebuilt

**Old flow:** idle → device-check → permissions → camera → reaction → voice → cognitive-intro → cognitive-stroop → cognitive-digit-span → cognitive-nback → cognitive-trail-tap → cognitive-vocal-ran → cognitive-summary → device-signals → readiness → submitting → done

**New flow:** idle → prep → camera → cognitive-intro → cognitive-stroop → cognitive-digit-span → cognitive-nback → cognitive-trail-tap → voice-proof → review → device-signals → readiness → submitting → done

- Merged device-check + permissions into single **prep** screen
- Removed standalone **reaction** test (merged into cognitive reflex)
- Removed **cognitive-vocal-ran** phase entirely
- Removed **cognitive-summary** phase (replaced by **review** screen)
- Replaced **voice** phase with **voice-proof** (single capture with countdown)
- Added **review** screen before device signals

### 2. Voice Capture — Single Write

- **Before:** Voice recorded in separate `voice` phase, then again during `cognitive-vocal-ran`
- **After:** Single voice capture in `voice-proof` phase with:
  - 3-second countdown before recording
  - Visual spinner during recording
  - Feedback on capture result (duration, success/failure)
  - Single retake allowed (`voiceRetakeUsed` flag)
  - Single `VOICE_KEY` write to `sensitiveRef`
  - Cleanup on retake/skip (`delete sensitiveRef.current[VOICE_KEY]`)

**Voice phrase:** `"Je suis présent et je valide ce contrôle."`

### 3. Cognitive Tests — Simplified & French

| Test | Old Name | New Name | Changes |
|------|----------|----------|---------|
| Reflex | Reflex | Réflexe | Merged with old reaction test, French wording |
| Stroop | Stroop | Couleurs | Practice trials (2), French color names (Rouge/Bleu/Vert/Jaune) |
| Digit Span | Digit Span | Mémoire courte | Touch button grid (0-9) instead of text input |
| N-Back | N-Back (1-back) | Comparaison | Practice trials (3), OUI/NON buttons instead of MATCH/NO |
| Trail Tap | Trail Tap | Chemin | Simplified wording |
| Vocal RAN | Vocal RAN | — | **Removed entirely** |

### 4. Practice Trials

**Stroop practice:** 2 conflict trials with `isPractice: true` flag. Filtered from `computeStroopResult` scoring.

**N-Back practice:** 3 trials (C→C→F) with known answers. Filtered from `computeNBackResult` scoring.

### 5. Behavior Touch Submit Guard

- `behaviorBlocked = getTouchBehaviorCollector().isSupported() && behaviorInteractions === 0`
- Blocks submission when touch is supported but zero interactions recorded
- Adds block reason: `"Pas assez d'interactions tactiles détectées"`
- Warns on low interactions (< 5): `"Signature tactile faible"`

### 6. Global Wording — French

All UI labels translated to French:
- Hero: "Contrôle de présence"
- Welcome: "Nous allons vérifier que vous êtes bien présent..."
- Prep: "Préparation — Autorisez les capteurs nécessaires"
- Camera: "Photo de présence"
- Tests: "Test 1 — Réflexe", "Test 2 — Couleurs", etc.
- Voice: "Preuve vocale — Lis cette phrase à voix haute"
- Review: "Récapitulatif"
- Submit: "Envoyer"
- Results: "Tests cognitifs", "Signaux", "Progression", "Analyse cognitive", "Signature tactile", "Intégrité vocale", "Décision", "Suivi"

### 7. Removed Code

- `vocalRanChallenge` import and all handlers
- `reactionCollector` import and reaction test state/handlers/UI
- `VocalRanSignal` type import
- `recordVocalRanInteraction` import
- `cogVocalRanSignal` state
- `ReactionRound` type import
- `reactionPhase`, `reactionRound`, `reactionResults`, `lastReactionMs` state
- `handleReactionTap`, `handleSkipReaction` handlers
- `handleVocalRanRecord`, `handleSkipVocalRan` handlers
- `finishCognitiveBattery` function (replaced by `finishToReview`)
- `cognitive-summary` phase and UI
- `reactionBg`, `reactionLabel` variables

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/DemoGuard.tsx` | Full UI rebuild: new phases, French wording, practice trials, single voice capture, behavior guard, removed vocal RAN and reaction test |
| `src/demoguard/cognitive/nBackChallenge.ts` | Added `generateNBackPracticeTrials()`, `isPractice` flag, filtering in `computeNBackResult` |
| `src/demoguard/cognitive/stroopChallenge.ts` | Added `generateStroopPracticeTrials()`, `isPractice` flag, filtering in `computeStroopResult` |
| `src/demoguard/collectors/audioCollector.ts` | Voice phrase changed to natural French |

## Files Created

| File | Purpose |
|------|---------|
| `tests/demoguard-ux02-rebuild.test.ts` | 36 tests verifying voice capture, practice trials, digit span buttons, behavior guard, phase flow, French wording, and build integrity |

---

## Test Results

```
✓ tests/demoguard-ux02-rebuild.test.ts (36 tests) 15ms
Test Files  1 passed (1)
Tests  36 passed (36)
```

### Test Coverage

1. **Voice Capture (6 tests):** Single VOICE_KEY write, cleanup on retake/skip, voice phrase, no old voice phase, countdown state, retake limit
2. **N-Back Practice (5 tests):** Trial generation, target logic, filtering from scoring, OUI/NON buttons
3. **Stroop Practice (4 tests):** Trial generation, conflict trials, filtering from scoring, French color names
4. **Digit Span (4 tests):** Trial generation, evaluation, touch button grid (0-9), no text input
5. **Behavior Guard (5 tests):** `behaviorBlocked` logic, submit blocking, block reasons, low interaction warnings, `isSupported()` usage
6. **Phase Flow (6 tests):** New phases present, old phases removed, no vocal RAN, no reaction test, French wording, review screen
7. **Build (4 tests):** File exists, no removed imports, `finishToReview` computes summaries, `vocal_ran: null` in payload

---

## TypeScript Compilation

```
npx tsc --noEmit → 0 errors
```

---

## No Backend Changes

- No modifications to backend logic, scoring formulas, or Brain ML
- No changes to API payloads or endpoint contracts
- `vocal_ran: null` sent in cognitive signals (backend already handles null)
- `reaction: null` sent in signals (was already null from removed reaction test)
- Behavior payload structure unchanged

---

## Copyright

(c) 2026 Benjamin BARRERE / IA SOLUTION
Patents Pending FR2514274 | FR2514546
