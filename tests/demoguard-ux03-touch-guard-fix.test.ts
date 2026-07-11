/**
 * DemoGuard UX-03 — Touch Guard Fix Tests
 *
 * Verifies:
 * 1. Stroop practice button taps increment behavior interactions
 * 2. N-Back practice button taps increment behavior interactions
 * 3. Digit Span numeric buttons increment behavior interactions
 * 4. Trail Tap point taps increment behavior interactions
 * 5. Guard "BLOQUÉ" is not rendered during cognitive-stroop
 * 6. Guard "BLOQUÉ" is not rendered during cognitive-nback
 * 7. Guard "BLOQUÉ" is not rendered during cognitive-digit-span
 * 8. Guard "BLOQUÉ" is not rendered during cognitive-trail-tap
 * 9. Review blocks submit only when totalInteractions = 0
 * 10. Review warns but allows submit when totalInteractions is low but >0
 * 11. Review allows submit when interactions sufficient
 * 12. Snapshot not reset before submit
 * 13. No raw touch data exposed
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

// ── Helper: read DemoGuard.tsx source for static analysis ──
const demoguardSource = fs.readFileSync(
  path.resolve(__dirname, '../src/pages/DemoGuard.tsx'),
  'utf-8',
);

// ═══════════════════════════════════════════════════════════
// 1-4. Interaction Recording Tests
// ═══════════════════════════════════════════════════════════

describe('Interaction Recording — Cognitive Modules', () => {
  beforeEach(() => {
    resetTouchBehaviorCollector();
  });

  it('Stroop practice button taps increment behavior interactions', () => {
    const collector = getTouchBehaviorCollector();
    recordTaskStart('stroop');
    recordStroopSelection('red', true, 0, false);
    recordStroopSelection('blue', false, 0, false);
    expect(collector.getInteractionCount()).toBe(2);
    const summary = collector.getSummary();
    expect(summary.totalInteractions).toBe(2);
    expect(summary.tasksObserved).toBeGreaterThanOrEqual(1);
  });

  it('N-Back practice OUI/NON taps increment behavior interactions', () => {
    const collector = getTouchBehaviorCollector();
    recordTaskStart('n_back');
    recordNBackDecision(true, 0);
    recordNBackDecision(false, 0);
    recordNBackDecision(true, 0);
    expect(collector.getInteractionCount()).toBe(3);
    const summary = collector.getSummary();
    expect(summary.totalInteractions).toBe(3);
  });

  it('Digit Span numeric buttons increment behavior interactions', () => {
    const collector = getTouchBehaviorCollector();
    recordTaskStart('digit_span');
    recordDigitSpanKey(false); // pressing "1"
    recordDigitSpanKey(false); // pressing "2"
    recordDigitSpanKey(false); // pressing "3"
    recordDigitSpanKey(true);  // delete
    recordDigitSpanSubmit();   // submit
    expect(collector.getInteractionCount()).toBe(5);
    const summary = collector.getSummary();
    expect(summary.totalInteractions).toBe(5);
  });

  it('Trail Tap point taps increment behavior interactions', () => {
    const collector = getTouchBehaviorCollector();
    recordTaskStart('trail_tap');
    recordTrailTap(true, 100, 100);
    recordTrailTap(true, 150, 150);
    recordTrailTap(false, 200, 180);
    expect(collector.getInteractionCount()).toBe(3);
    const summary = collector.getSummary();
    expect(summary.totalInteractions).toBe(3);
  });

  it('Reflex tap increments behavior interactions', () => {
    const collector = getTouchBehaviorCollector();
    recordTaskStart('reflex');
    recordReflexTap(250, false);
    recordReflexTap(180, false);
    expect(collector.getInteractionCount()).toBe(2);
    const summary = collector.getSummary();
    expect(summary.totalInteractions).toBe(2);
  });

  it('All modules together produce correct totalInteractions', () => {
    const collector = getTouchBehaviorCollector();
    recordTaskStart('reflex');
    recordReflexTap(250, false);
    recordTaskStart('stroop');
    recordStroopSelection('red', true, 500, false);
    recordTaskStart('digit_span');
    recordDigitSpanKey(false);
    recordDigitSpanSubmit();
    recordTaskStart('n_back');
    recordNBackDecision(true, 600);
    recordTaskStart('trail_tap');
    recordTrailTap(true, 100, 100);
    const summary = collector.getSummary();
    expect(summary.totalInteractions).toBe(6);
    expect(summary.tasksObserved).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════
// 5-8. Guard Not Rendered During Cognitive Tests
// ═══════════════════════════════════════════════════════════

describe('Guard Not Rendered During Cognitive Tests', () => {
  it('behaviorBlocked is gated to readiness/review phases only', () => {
    expect(demoguardSource).toContain("(phase === 'readiness' || phase === 'review')");
  });

  it('Sticky bar only shows Bloqué during readiness phase', () => {
    expect(demoguardSource).toContain("phase === 'readiness' && submitBlockReasons.length > 0");
  });

  it('No Bloqué rendering during cognitive-stroop phase', () => {
    const stroopSection = demoguardSource.match(/phase === 'cognitive-stroop'[\s\S]*?\n      \)}/);
    expect(stroopSection).not.toBeNull();
    expect(stroopSection![0]).not.toContain('Bloqué');
    expect(stroopSection![0]).not.toContain('dg-error-box');
  });

  it('No Bloqué rendering during cognitive-nback phase', () => {
    const nbackSection = demoguardSource.match(/phase === 'cognitive-nback'[\s\S]*?\n      \)}/);
    expect(nbackSection).not.toBeNull();
    expect(nbackSection![0]).not.toContain('Bloqué');
    expect(nbackSection![0]).not.toContain('dg-error-box');
  });

  it('No Bloqué rendering during cognitive-digit-span phase', () => {
    const digitSection = demoguardSource.match(/phase === 'cognitive-digit-span'[\s\S]*?\n      \)}/);
    expect(digitSection).not.toBeNull();
    expect(digitSection![0]).not.toContain('Bloqué');
    expect(digitSection![0]).not.toContain('dg-error-box');
  });

  it('No Bloqué rendering during cognitive-trail-tap phase', () => {
    const trailSection = demoguardSource.match(/phase === 'cognitive-trail-tap'[\s\S]*?\n      \)}/);
    expect(trailSection).not.toBeNull();
    expect(trailSection![0]).not.toContain('Bloqué');
    expect(trailSection![0]).not.toContain('dg-error-box');
  });

  it('No Bloqué rendering during cognitive-intro (reflex) phase', () => {
    const reflexSection = demoguardSource.match(/phase === 'cognitive-intro'[\s\S]*?\n      \)}/);
    expect(reflexSection).not.toBeNull();
    expect(reflexSection![0]).not.toContain('Bloqué');
    expect(reflexSection![0]).not.toContain('dg-error-box');
  });
});

// ═══════════════════════════════════════════════════════════
// 9-11. Review Guard Logic
// ═══════════════════════════════════════════════════════════

describe('Review Guard Logic', () => {
  it('Review blocks submit only when totalInteractions = 0 (touch supported)', () => {
    expect(demoguardSource).toContain('behaviorTouchSupported && behaviorInteractions === 0');
    expect(demoguardSource).toContain("Refais les tests tactiles avant d'envoyer");
  });

  it('Review warns but allows submit when totalInteractions is low but >0', () => {
    expect(demoguardSource).toContain('behaviorInteractions > 0 && behaviorInteractions < 5');
    expect(demoguardSource).toContain('Signature tactile faible');
  });

  it('Review shows success message when interactions sufficient (>= 5)', () => {
    expect(demoguardSource).toContain('behaviorInteractions >= 5');
    expect(demoguardSource).toContain('Signature tactile détectée');
  });

  it('Review shows tasksObserved debug info', () => {
    expect(demoguardSource).toContain('Tests observés');
    expect(demoguardSource).toContain('behaviorSummary.tasksObserved');
  });

  it('behaviorBlocked does not trigger during cognitive phases', () => {
    // The guard must include phase check — not just behaviorTouchSupported && interactions === 0
    const guardLine = demoguardSource.match(/const behaviorBlocked = .+/);
    expect(guardLine).not.toBeNull();
    expect(guardLine![0]).toContain('phase');
    expect(guardLine![0]).toContain('readiness');
    expect(guardLine![0]).toContain('review');
  });
});

// ═══════════════════════════════════════════════════════════
// 12. Snapshot Not Reset Before Submit
// ═══════════════════════════════════════════════════════════

describe('Snapshot Not Reset Before Submit', () => {
  it('resetTouchBehaviorCollector is only called in handleStart, not before submit', () => {
    const resetMatches = demoguardSource.match(/resetTouchBehaviorCollector\(\)/g);
    expect(resetMatches).not.toBeNull();
    // Should appear exactly once — in handleStart
    expect(resetMatches!.length).toBe(1);
  });

  it('finishToReview captures behavior summary before review', () => {
    expect(demoguardSource).toContain('getTouchBehaviorCollector().getSummary()');
    expect(demoguardSource).toContain('setBehaviorSummary(bhSummary)');
  });

  it('handleSubmit reads from collector, does not reset', () => {
    const submitSection = demoguardSource.match(/const handleSubmit = useCallback[\s\S]*?\}, \[/);
    expect(submitSection).not.toBeNull();
    expect(submitSection![0]).not.toContain('resetTouchBehaviorCollector');
    expect(submitSection![0]).toContain('getTouchBehaviorCollector().getPayload()');
  });
});

// ═══════════════════════════════════════════════════════════
// 13. No Raw Touch Data Exposed
// ═══════════════════════════════════════════════════════════

describe('No Raw Touch Data Exposed', () => {
  it('DemoGuard.tsx does not store raw coordinates', () => {
    expect(demoguardSource).not.toContain('clientX');
    expect(demoguardSource).not.toContain('clientY');
    expect(demoguardSource).not.toContain('pageX');
    expect(demoguardSource).not.toContain('pageY');
  });

  it('DemoGuard.tsx does not store raw touch events', () => {
    expect(demoguardSource).not.toContain('TouchEvent');
    expect(demoguardSource).not.toContain('changedTouches');
    expect(demoguardSource).not.toContain('targetTouches');
  });

  it('DemoGuard.tsx does not store raw pressure values', () => {
    expect(demoguardSource).not.toContain('e.pressure');
    expect(demoguardSource).not.toContain('event.pressure');
    expect(demoguardSource).not.toContain('touch.force');
  });

  it('TouchBehaviorCollector stores only safe aggregates', () => {
    const collectorSource = fs.readFileSync(
      path.resolve(__dirname, '../src/demoguard/behavior/touchBehaviorCollector.ts'),
      'utf-8',
    );
    // InteractionRecord has no coordinate fields
    expect(collectorSource).not.toContain('clientX');
    expect(collectorSource).not.toContain('clientY');
    expect(collectorSource).not.toContain('rawPath');
    expect(collectorSource).not.toContain('rawTrace');
  });
});

// ═══════════════════════════════════════════════════════════
// 14. Practice Handlers Record Interactions
// ═══════════════════════════════════════════════════════════

describe('Practice Handlers Record Interactions', () => {
  it('handleStroopPracticeSelect calls recordStroopSelection', () => {
    const handlerMatch = demoguardSource.match(/handleStroopPracticeSelect = useCallback[\s\S]*?\}, \[/);
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch![0]).toContain('recordStroopSelection');
    expect(handlerMatch![0]).toContain('recordTaskStart');
  });

  it('handleNBackPracticeResponse calls recordNBackDecision', () => {
    const handlerMatch = demoguardSource.match(/handleNBackPracticeResponse = useCallback[\s\S]*?\}, \[/);
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch![0]).toContain('recordNBackDecision');
    expect(handlerMatch![0]).toContain('recordTaskStart');
  });
});
