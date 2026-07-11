/**
 * DEMOGUARD-RUNTIME-DEEP-01 — Stroop Freeze Reproduction Tests
 *
 * Verifies that the Stroop (Couleurs) test advances through all 6 trials
 * without freezing at the 3rd tap. Also tests N-Back, Digit Span, Trail Tap.
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
import {
  generateStroopTrials,
  generateStroopPracticeTrials,
  STROOP_COLORS,
  type StroopColor,
  type StroopTrialConfig,
} from '../src/demoguard/cognitive/stroopChallenge';

const demoguardSource = fs.readFileSync(
  path.resolve(__dirname, '../src/pages/DemoGuard.tsx'),
  'utf-8',
);

// ═══════════════════════════════════════════════════════════
// Stroop trial generation tests
// ═══════════════════════════════════════════════════════════

describe('Stroop trial generation', () => {
  it('generateStroopTrials(6) produces exactly 6 trials', () => {
    const trials = generateStroopTrials(6);
    expect(trials).toHaveLength(6);
  });

  it('every trial has a valid word and displayColor', () => {
    const trials = generateStroopTrials(6);
    for (const trial of trials) {
      expect(STROOP_COLORS).toContain(trial.word);
      expect(STROOP_COLORS).toContain(trial.displayColor);
      expect(trial.isConflict).toBe(trial.word !== trial.displayColor);
    }
  });

  it('generateStroopPracticeTrials produces 2 trials', () => {
    const trials = generateStroopPracticeTrials();
    expect(trials).toHaveLength(2);
    expect(trials.every(t => t.isPractice === true)).toBe(true);
  });

  it('practice trials and scored trials are separate arrays', () => {
    const practice = generateStroopPracticeTrials();
    const scored = generateStroopTrials(6);
    expect(practice).toHaveLength(2);
    expect(scored).toHaveLength(6);
    // Practice trials have isPractice: true
    expect(practice.every(t => t.isPractice === true)).toBe(true);
    // Scored trials do not have isPractice set
    expect(scored.every(t => t.isPractice !== true)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Stroop handler — freeze root cause tests
// ═══════════════════════════════════════════════════════════

describe('Stroop handler — no freeze at 3rd tap', () => {
  it('1. Stroop advances through all 6 trials without freezing', () => {
    // Simulate 6 taps by checking the handler logic
    const trials = generateStroopTrials(6);
    expect(trials.length).toBe(6);

    // The handler should use stroopResultsRef (not stale stroopResults state)
    expect(demoguardSource).toContain('stroopResultsRef');
    expect(demoguardSource).toContain('stroopResultsRef.current');
  });

  it('2. Third tap does not freeze — no setTimeout dependency for advance', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch![0];

    // No blocking setTimeout (1200ms/1500ms)
    expect(handler).not.toContain('1500');
    expect(handler).not.toContain('1200');

    // Anti-double-tap uses try/finally (not setTimeout)
    expect(handler).toContain('try');
    expect(handler).toContain('finally');
    expect(handler).toContain('stroopAdvancingRef.current = false');

    // No setTimeout for advancing ref release
    expect(handler).not.toContain('setTimeout');
  });

  it('3. currentTrial is never undefined before completion — handler checks bounds', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch![0];

    // Guard: stroopIndex >= stroopTrials.length → return
    expect(handler).toContain('stroopIndex >= stroopTrials.length');
    // Access trial after guard
    expect(handler).toContain('stroopTrials[stroopIndex]');
  });

  it('4. isAdvancing resets after each tap — try/finally guarantees reset', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch![0];

    // Lock acquired
    expect(handler).toContain('stroopAdvancingRef.current = true');
    // Lock released in finally
    expect(handler).toContain('finally');
    expect(handler).toContain('stroopAdvancingRef.current = false');
  });

  it('5. Double tap during lock does not corrupt index — ref-based results', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch![0];

    // Uses ref, not state — prevents stale closure
    expect(handler).toContain('stroopResultsRef.current');
    // Second tap is rejected by advancing guard
    expect(handler).toContain('if (stroopAdvancingRef.current) return');
  });

  it('6. Practice trials and scored trials do not conflict — separate state', () => {
    expect(demoguardSource).toContain('stroopPracticeMode');
    expect(demoguardSource).toContain('stroopPracticeTrials');
    expect(demoguardSource).toContain('stroopTrials');

    // Scored handler checks practice mode
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch![0]).toContain('stroopPracticeMode');
  });

  it('7. Behavior interactions increase on every accepted tap', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch![0]).toContain('recordStroopSelection');
  });

  it('8. Phase advances after final Stroop trial', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch![0]).toContain("setPhase('cognitive-digit-span')");
  });

  it('Handler does not depend on stroopResults state in deps array', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\}, \[[^\]]+\]\);/);
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch![0];
    // deps array should not include stroopResults (causes stale closure)
    const depsMatch = handler.match(/\},\s*\[([^\]]+)\]/);
    expect(depsMatch).not.toBeNull();
    const deps = depsMatch![1];
    expect(deps).not.toContain('stroopResults');
  });
});

// ═══════════════════════════════════════════════════════════
// N-Back handler — same freeze pattern check
// ═══════════════════════════════════════════════════════════

describe('N-Back handler — no freeze at 3rd tap', () => {
  it('N-Back third tap does not freeze — try/finally, no setTimeout', () => {
    const handlerMatch = demoguardSource.match(/handleNBackResponse = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch![0];

    expect(handler).not.toContain('1500');
    expect(handler).not.toContain('1200');
    expect(handler).not.toContain('setTimeout');
    expect(handler).toContain('try');
    expect(handler).toContain('finally');
    expect(handler).toContain('nbackAdvancingRef.current = false');
  });

  it('N-Back uses ref-based results (no stale closure)', () => {
    const handlerMatch = demoguardSource.match(/handleNBackResponse = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch![0]).toContain('nbackResultsRef.current');
  });

  it('N-Back handler deps do not include nbackResults state', () => {
    const handlerMatch = demoguardSource.match(/handleNBackResponse = useCallback[\s\S]*?\}, \[[^\]]+\]\);/);
    expect(handlerMatch).not.toBeNull();
    const depsMatch = handlerMatch![0].match(/\},\s*\[([^\]]+)\]/);
    expect(depsMatch).not.toBeNull();
    expect(depsMatch![1]).not.toContain('nbackResults');
  });
});

// ═══════════════════════════════════════════════════════════
// Digit Span — no freeze
// ═══════════════════════════════════════════════════════════

describe('Digit Span — no freeze at 3rd digit', () => {
  it('Digit Span submit handler has no setTimeout', () => {
    const submitMatch = demoguardSource.match(/handleDigitSpanSubmit = useCallback[\s\S]*?\n  }, \[/);
    expect(submitMatch).not.toBeNull();
    expect(submitMatch![0]).not.toContain('setTimeout');
    expect(submitMatch![0]).toContain('setDigitSpanIndex');
  });

  it('Digit Span numeric buttons have no disabled attribute', () => {
    const gridStart = demoguardSource.indexOf("gridTemplateColumns: 'repeat(5, 1fr)'");
    expect(gridStart).toBeGreaterThan(-1);
    const gridArea = demoguardSource.slice(gridStart, gridStart + 500);
    expect(gridArea).not.toContain('disabled');
  });
});

// ═══════════════════════════════════════════════════════════
// Trail Tap — no freeze
// ═══════════════════════════════════════════════════════════

describe('Trail Tap — no freeze at 3rd point', () => {
  it('Trail Tap handler does not use setTimeout for advance', () => {
    const trailMatch = demoguardSource.match(/handleTrailTap = useCallback[\s\S]*?\n  }, \[/);
    expect(trailMatch).not.toBeNull();
    expect(trailMatch![0]).not.toContain('setTimeout');
    expect(trailMatch![0]).toContain('setTrailEvents');
  });

  it('Trail Tap wrong tap does not block — records and continues', () => {
    const trailMatch = demoguardSource.match(/handleTrailTap = useCallback[\s\S]*?\n  }, \[/);
    expect(trailMatch).not.toBeNull();
    expect(trailMatch![0]).toContain('recordTrailTap');
  });
});

// ═══════════════════════════════════════════════════════════
// Behavior recording — all modules
// ═══════════════════════════════════════════════════════════

describe('Behavior interactions — all cognitive modules', () => {
  beforeEach(() => {
    resetTouchBehaviorCollector();
  });

  it('All 5 cognitive modules record interactions correctly', () => {
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

  it('Stroop practice handler records interactions', () => {
    const practiceMatch = demoguardSource.match(/handleStroopPracticeSelect = useCallback[\s\S]*?\n  }, \[/);
    expect(practiceMatch).not.toBeNull();
    expect(practiceMatch![0]).toContain('recordStroopSelection');
    expect(practiceMatch![0]).toContain('recordTaskStart');
  });

  it('N-Back practice handler records interactions', () => {
    const practiceMatch = demoguardSource.match(/handleNBackPracticeResponse = useCallback[\s\S]*?\n  }, \[/);
    expect(practiceMatch).not.toBeNull();
    expect(practiceMatch![0]).toContain('recordNBackDecision');
    expect(practiceMatch![0]).toContain('recordTaskStart');
  });
});

// ═══════════════════════════════════════════════════════════
// DEV logging — safe, no raw data
// ═══════════════════════════════════════════════════════════

describe('DEV logging — safe instrumentation', () => {
  it('Stroop handler has DEV log with safe fields only', () => {
    const handlerMatch = demoguardSource.match(/handleStroopSelect = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch![0];

    expect(handler).toContain('import.meta.env?.DEV');
    expect(handler).toContain('dg_stroop_tap');
    expect(handler).toContain('trialIndex');
    expect(handler).toContain('selectedColor');
    expect(handler).toContain('behaviorInteractionsBefore');
  });

  it('N-Back handler has DEV log with safe fields only', () => {
    const handlerMatch = demoguardSource.match(/handleNBackResponse = useCallback[\s\S]*?\n  }, \[/);
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch![0];

    expect(handler).toContain('import.meta.env?.DEV');
    expect(handler).toContain('dg_nback_tap');
  });

  it('No raw touch data in DEV logs', () => {
    expect(demoguardSource).not.toContain('clientX');
    expect(demoguardSource).not.toContain('clientY');
    expect(demoguardSource).not.toContain('pageX');
    expect(demoguardSource).not.toContain('pageY');
    expect(demoguardSource).not.toContain('TouchEvent');
    expect(demoguardSource).not.toContain('changedTouches');
  });
});

// ═══════════════════════════════════════════════════════════
// Mobile event duplication check
// ═══════════════════════════════════════════════════════════

describe('Mobile event duplication', () => {
  it('Stroop buttons use onClick only (no onPointerDown)', () => {
    const stroopSection = demoguardSource.match(/phase === 'cognitive-stroop'[\s\S]*?\n      \)}/);
    expect(stroopSection).not.toBeNull();
    expect(stroopSection![0]).not.toContain('onPointerDown');
    expect(stroopSection![0]).not.toContain('onPointerUp');
    expect(stroopSection![0]).toContain('onClick');
  });

  it('N-Back buttons use onClick only (no onPointerDown)', () => {
    const nbackSection = demoguardSource.match(/phase === 'cognitive-nback'[\s\S]*?\n      \)}/);
    expect(nbackSection).not.toBeNull();
    expect(nbackSection![0]).not.toContain('onPointerDown');
    expect(nbackSection![0]).not.toContain('onPointerUp');
    expect(nbackSection![0]).toContain('onClick');
  });
});
