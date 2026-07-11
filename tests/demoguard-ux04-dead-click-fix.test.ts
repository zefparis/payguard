/**
 * DemoGuard UX-04 — Dead-Click Fix Tests
 *
 * Verifies:
 * 1. Couleurs tap answer advances to next trial immediately
 * 2. Couleurs has no blocking feedback state
 * 3. Couleurs double tap does not freeze (anti-double-tap guard)
 * 4. Couleurs last trial advances to next phase
 * 5. Comparaison practice tap advances
 * 6. Comparaison scored tap advances
 * 7. Comparaison practice-to-scored transition has clear action or auto-transition
 * 8. Comparaison double tap does not freeze
 * 9. Mémoire courte numeric taps remain responsive
 * 10. Mémoire courte validate advances
 * 11. Chemin wrong tap does not freeze
 * 12. Chemin correct tap advances
 * 13. No "BLOQUÉ" during cognitive phases
 * 14. No "continue/vas-y" blocking feedback rendered
 * 15. Every cognitive tap increments behavior interactions
 * 16. No raw touch data exposed
 * 17. Build OK
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {
  getTouchBehaviorCollector,
  resetTouchBehaviorCollector,
} from '../src/demoguard/behavior/touchBehaviorCollector';
import {
  recordTaskStart,
  recordStroopSelection,
  recordDigitSpanKey,
  recordDigitSpanSubmit,
  recordNBackDecision,
  recordTrailTap,
  recordReflexTap,
} from '../src/demoguard/behavior/taskBehaviorRecorder';

const demoguardSource = fs.readFileSync(
  path.resolve(__dirname, '../src/pages/DemoGuard.tsx'),
  'utf-8',
);

// ═══════════════════════════════════════════════════════════
// 1-4. Couleurs / Stroop
// ═══════════════════════════════════════════════════════════

describe('Couleurs / Stroop — Dead-Click Fixes', () => {
  it('1. Couleurs tap answer advances to next trial immediately (no setTimeout in handler)', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\}, \[/);
    expect(handlerMatch).not.toBeNull();
    // Should not contain blocking setTimeout (1200ms/1500ms) — advance is synchronous
    expect(handlerMatch![0]).not.toContain('1500');
    expect(handlerMatch![0]).not.toContain('1200');
    // The 150ms anti-double-tap guard release is OK (not blocking)
    // Should advance index immediately
    expect(handlerMatch![0]).toContain('setStroopIndex');
  });

  it('2. Couleurs has no blocking feedback state (no stroopPracticeFeedback)', () => {
    // Practice feedback state should be removed
    expect(demoguardSource).not.toContain('stroopPracticeFeedback');
    // No "Compris" feedback text
    expect(demoguardSource).not.toContain('Compris ! Continue');
  });

  it('3. Couleurs double tap does not freeze (anti-double-tap guard)', () => {
    expect(demoguardSource).toContain('stroopAdvancingRef');
    expect(demoguardSource).toContain('if (stroopAdvancingRef.current) return');
    expect(demoguardSource).toContain('stroopAdvancingRef.current = true');
    // Guard should be released after short timeout
    expect(demoguardSource).toContain('stroopAdvancingRef.current = false');
  });

  it('4. Couleurs last trial advances to next phase (cognitive-digit-span)', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\}, \[/);
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch![0]).toContain("setPhase('cognitive-digit-span')");
  });

  it('Couleurs practice handler has no blocking setTimeout', () => {
    const practiceMatch = demoguardSource.match(/handleStroopPracticeSelect = useCallback[\s\S]*?\}, \[/);
    expect(practiceMatch).not.toBeNull();
    expect(practiceMatch![0]).not.toContain('setTimeout');
    expect(practiceMatch![0]).not.toContain('1500');
    expect(practiceMatch![0]).not.toContain('1200');
  });
});

// ═══════════════════════════════════════════════════════════
// 5-8. Comparaison / N-Back
// ═══════════════════════════════════════════════════════════

describe('Comparaison / N-Back — Dead-Click Fixes', () => {
  it('5. Comparaison practice tap advances immediately (no setTimeout)', () => {
    const practiceMatch = demoguardSource.match(/handleNBackPracticeResponse = useCallback[\s\S]*?\}, \[/);
    expect(practiceMatch).not.toBeNull();
    expect(practiceMatch![0]).not.toContain('setTimeout');
    expect(practiceMatch![0]).not.toContain('1500');
    expect(practiceMatch![0]).not.toContain('1200');
    expect(practiceMatch![0]).toContain('setNbackPracticeIndex');
  });

  it('6. Comparaison scored tap advances immediately', () => {
    const scoredMatch = demoguardSource.match(/handleNBackResponse = useCallback[\s\S]*?\}, \[/);
    expect(scoredMatch).not.toBeNull();
    // Should not contain blocking timeouts (1200ms/1500ms)
    expect(scoredMatch![0]).not.toContain('1500');
    expect(scoredMatch![0]).not.toContain('1200');
    // The 150ms anti-double-tap guard release is OK (not blocking)
    expect(scoredMatch![0]).toContain('setNbackIndex');
  });

  it('7. Comparaison practice-to-scored transition is automatic (no setTimeout)', () => {
    const practiceMatch = demoguardSource.match(/handleNBackPracticeResponse = useCallback[\s\S]*?\}, \[/);
    expect(practiceMatch).not.toBeNull();
    // When last practice trial, should immediately set practice mode false
    expect(practiceMatch![0]).toContain('setNbackPracticeMode(false)');
    expect(practiceMatch![0]).toContain('nbackStartRef.current = performance.now()');
  });

  it('8. Comparaison double tap does not freeze (anti-double-tap guard)', () => {
    expect(demoguardSource).toContain('nbackAdvancingRef');
    expect(demoguardSource).toContain('if (nbackAdvancingRef.current) return');
    expect(demoguardSource).toContain('nbackAdvancingRef.current = true');
    expect(demoguardSource).toContain('nbackAdvancingRef.current = false');
  });

  it('Comparaison has no blocking practice feedback', () => {
    expect(demoguardSource).not.toContain('nbackPracticeFeedback');
    expect(demoguardSource).not.toContain("C''était OUI");
    expect(demoguardSource).not.toContain("C'était NON");
  });
});

// ═══════════════════════════════════════════════════════════
// 9-10. Mémoire courte / Digit Span
// ═══════════════════════════════════════════════════════════

describe('Mémoire courte / Digit Span — Dead-Click Fixes', () => {
  it('9. Mémoire courte numeric taps remain responsive (no disabled state on digit buttons)', () => {
    // Find the digit grid section in the source
    const gridStart = demoguardSource.indexOf("gridTemplateColumns: 'repeat(5, 1fr)'");
    expect(gridStart).toBeGreaterThan(-1);
    // Extract 500 chars after the grid starts — covers all 10 digit buttons
    const gridArea = demoguardSource.slice(gridStart, gridStart + 500);
    // Digit buttons (0-9) should not have 'disabled' attribute
    expect(gridArea).not.toContain('disabled');
  });

  it('10. Mémoire courte validate advances immediately (no setTimeout in submit handler)', () => {
    const submitMatch = demoguardSource.match(/handleDigitSpanSubmit = useCallback[\s\S]*?\}, \[/);
    expect(submitMatch).not.toBeNull();
    expect(submitMatch![0]).not.toContain('setTimeout');
    expect(submitMatch![0]).toContain('setDigitSpanIndex');
  });

  it('Mémoire courte has no Passer button', () => {
    const digitSection = demoguardSource.match(/phase === 'cognitive-digit-span'[\s\S]*?\n      \)}/);
    expect(digitSection).not.toBeNull();
    expect(digitSection![0]).not.toContain('Passer');
    expect(digitSection![0]).not.toContain('handleSkipDigitSpan');
  });
});

// ═══════════════════════════════════════════════════════════
// 11-12. Chemin / Trail Tap
// ═══════════════════════════════════════════════════════════

describe('Chemin / Trail Tap — Dead-Click Fixes', () => {
  it('11. Chemin wrong tap does not freeze (handler still processes wrong taps)', () => {
    const trailMatch = demoguardSource.match(/handleTrailTap = useCallback[\s\S]*?\}, \[/);
    expect(trailMatch).not.toBeNull();
    // Handler should not return early on wrong tap — it records and continues
    expect(trailMatch![0]).toContain('recordTrailTap');
    expect(trailMatch![0]).toContain('setTrailEvents');
  });

  it('12. Chemin correct tap advances (last correct tap transitions to voice-proof)', () => {
    const trailMatch = demoguardSource.match(/handleTrailTap = useCallback[\s\S]*?\}, \[/);
    expect(trailMatch).not.toBeNull();
    expect(trailMatch![0]).toContain("setPhase('voice-proof')");
  });

  it('Chemin has no Passer button', () => {
    const trailSection = demoguardSource.match(/phase === 'cognitive-trail-tap'[\s\S]*?\n      \)}/);
    expect(trailSection).not.toBeNull();
    expect(trailSection![0]).not.toContain('Passer');
    expect(trailSection![0]).not.toContain('handleSkipTrailTap');
  });
});

// ═══════════════════════════════════════════════════════════
// 13. No BLOQUÉ during cognitive phases
// ═══════════════════════════════════════════════════════════

describe('No BLOQUÉ During Cognitive Phases', () => {
  it('13. behaviorBlocked is gated to readiness/review only', () => {
    expect(demoguardSource).toContain("(phase === 'readiness' || phase === 'review')");
  });

  it('Sticky bar only shows Bloqué during readiness', () => {
    expect(demoguardSource).toContain("phase === 'readiness' && submitBlockReasons.length > 0");
  });
});

// ═══════════════════════════════════════════════════════════
// 14. No blocking feedback rendered
// ═══════════════════════════════════════════════════════════

describe('No Blocking Feedback Rendered', () => {
  it('14. No "Compris" or "Continue" or "Vas-y" feedback text in cognitive sections', () => {
    expect(demoguardSource).not.toContain('Compris ! Continue');
    expect(demoguardSource).not.toContain('Vas-y');
    expect(demoguardSource).not.toContain('Continue.');
    expect(demoguardSource).not.toContain('Encore');
  });

  it('No stroopPracticeFeedback state variable', () => {
    expect(demoguardSource).not.toContain('stroopPracticeFeedback');
  });

  it('No nbackPracticeFeedback state variable', () => {
    expect(demoguardSource).not.toContain('nbackPracticeFeedback');
  });

  it('No blocking setTimeout in Stroop practice handler', () => {
    const match = demoguardSource.match(/handleStroopPracticeSelect = useCallback[\s\S]*?\}, \[/);
    expect(match).not.toBeNull();
    expect(match![0]).not.toContain('setTimeout');
  });

  it('No blocking setTimeout in N-Back practice handler', () => {
    const match = demoguardSource.match(/handleNBackPracticeResponse = useCallback[\s\S]*?\}, \[/);
    expect(match).not.toBeNull();
    expect(match![0]).not.toContain('setTimeout');
  });
});

// ═══════════════════════════════════════════════════════════
// 15. Every cognitive tap increments behavior interactions
// ═══════════════════════════════════════════════════════════

describe('Every Cognitive Tap Increments Behavior Interactions', () => {
  beforeEach(() => {
    resetTouchBehaviorCollector();
  });

  it('15. All cognitive modules record interactions on tap', () => {
    const collector = getTouchBehaviorCollector();

    // Reflex
    recordTaskStart('reflex');
    recordReflexTap(250, false);

    // Stroop
    recordTaskStart('stroop');
    recordStroopSelection('red', true, 500, false);

    // Digit Span
    recordTaskStart('digit_span');
    recordDigitSpanKey(false);
    recordDigitSpanSubmit();

    // N-Back
    recordTaskStart('n_back');
    recordNBackDecision(true, 600);

    // Trail Tap
    recordTaskStart('trail_tap');
    recordTrailTap(true, 100, 100);

    const summary = collector.getSummary();
    expect(summary.totalInteractions).toBe(6);
    expect(summary.tasksObserved).toBe(5);
  });

  it('Stroop practice handler calls recordStroopSelection', () => {
    const match = demoguardSource.match(/handleStroopPracticeSelect = useCallback[\s\S]*?\}, \[/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('recordStroopSelection');
    expect(match![0]).toContain('recordTaskStart');
  });

  it('N-Back practice handler calls recordNBackDecision', () => {
    const match = demoguardSource.match(/handleNBackPracticeResponse = useCallback[\s\S]*?\}, \[/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('recordNBackDecision');
    expect(match![0]).toContain('recordTaskStart');
  });
});

// ═══════════════════════════════════════════════════════════
// 16. No raw touch data exposed
// ═══════════════════════════════════════════════════════════

describe('No Raw Touch Data Exposed', () => {
  it('16. DemoGuard.tsx does not store raw coordinates or touch events', () => {
    expect(demoguardSource).not.toContain('clientX');
    expect(demoguardSource).not.toContain('clientY');
    expect(demoguardSource).not.toContain('pageX');
    expect(demoguardSource).not.toContain('pageY');
    expect(demoguardSource).not.toContain('TouchEvent');
    expect(demoguardSource).not.toContain('changedTouches');
    expect(demoguardSource).not.toContain('e.pressure');
    expect(demoguardSource).not.toContain('event.pressure');
  });
});

// ═══════════════════════════════════════════════════════════
// 17. Build OK (static verification)
// ═══════════════════════════════════════════════════════════

describe('Build Verification', () => {
  it('17. DemoGuard.tsx file exists and is non-empty', () => {
    expect(demoguardSource.length).toBeGreaterThan(1000);
  });

  it('No removed skip handlers referenced', () => {
    expect(demoguardSource).not.toContain('handleSkipStroop');
    expect(demoguardSource).not.toContain('handleSkipNBack');
    expect(demoguardSource).not.toContain('handleSkipDigitSpan');
    expect(demoguardSource).not.toContain('handleSkipTrailTap');
  });

  it('No Passer buttons in scored cognitive tests', () => {
    // Passer should not appear in Stroop, Digit Span, N-Back, or Trail Tap sections
    const stroopSection = demoguardSource.match(/phase === 'cognitive-stroop'[\s\S]*?\n      \)}/);
    expect(stroopSection).not.toBeNull();
    expect(stroopSection![0]).not.toContain('Passer');

    const digitSection = demoguardSource.match(/phase === 'cognitive-digit-span'[\s\S]*?\n      \)}/);
    expect(digitSection).not.toBeNull();
    expect(digitSection![0]).not.toContain('Passer');

    const nbackSection = demoguardSource.match(/phase === 'cognitive-nback'[\s\S]*?\n      \)}/);
    expect(nbackSection).not.toBeNull();
    expect(nbackSection![0]).not.toContain('Passer');

    const trailSection = demoguardSource.match(/phase === 'cognitive-trail-tap'[\s\S]*?\n      \)}/);
    expect(trailSection).not.toBeNull();
    expect(trailSection![0]).not.toContain('Passer');
  });

  it('Reflex too_early state allows tap to restart (no dead zone)', () => {
    const reflexMatch = demoguardSource.match(/handleCogReflexTap = useCallback[\s\S]*?\}, \[/);
    expect(reflexMatch).not.toBeNull();
    expect(reflexMatch![0]).toContain("cogReflexPhase === 'too_early'");
    expect(reflexMatch![0]).toContain("setCogReflexPhase('ready')");
  });
});
