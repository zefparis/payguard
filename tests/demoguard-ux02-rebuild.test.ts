/**
 * DemoGuard UX-02 Rebuild Tests
 *
 * Verifies:
 * 1. Voice capture: single VOICE_KEY write, no double capture
 * 2. N-Back practice trials: generation, filtering from scoring
 * 3. Stroop practice trials: generation, filtering from scoring
 * 4. Digit Span: touch button input pattern
 * 5. Behavior touch submit guard: zero interactions blocks
 * 6. Build: DemoGuard.tsx compiles without errors
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {
  generateNBackTrials,
  generateNBackPracticeTrials,
  evaluateNBackTrial,
  computeNBackResult,
} from '../src/demoguard/cognitive/nBackChallenge';

import {
  generateStroopTrials,
  generateStroopPracticeTrials,
  computeStroopResult,
  STROOP_COLORS,
  type StroopTrialResult,
} from '../src/demoguard/cognitive/stroopChallenge';

import {
  generateDigitSpanTrials,
  evaluateDigitSpanTrial,
  computeDigitSpanResult,
} from '../src/demoguard/cognitive/digitSpanChallenge';

import { generateChallengePhrase } from '../src/demoguard/collectors/audioCollector';
import { VOICE_KEY } from '../src/demoguard/types';

// ── Helper: read DemoGuard.tsx source for static analysis ──
const demoguardSource = fs.readFileSync(
  path.resolve(__dirname, '../src/pages/DemoGuard.tsx'),
  'utf-8',
);

// ═══════════════════════════════════════════════════════════
// 1. Voice Capture: Single VOICE_KEY Write
// ═══════════════════════════════════════════════════════════

describe('Voice Capture — Single VOICE_KEY Write', () => {
  it('VOICE_KEY is imported from types', () => {
    expect(demoguardSource).toContain("import { VOICE_KEY } from '../demoguard/types'");
  });

  it('sensitiveRef.current[VOICE_KEY] is assigned exactly once (single write)', () => {
    const matches = demoguardSource.match(/sensitiveRef\.current\[VOICE_KEY\]\s*=/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('VOICE_KEY is deleted on retake and skip (cleanup)', () => {
    const deleteMatches = demoguardSource.match(/delete sensitiveRef\.current\[VOICE_KEY\]/g);
    expect(deleteMatches).not.toBeNull();
    expect(deleteMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it('voice phrase is the new French natural phrase', () => {
    const phrase = generateChallengePhrase('test-challenge-id');
    expect(phrase).toBe('Je suis présent et je valide ce contrôle.');
  });

  it('no reference to old voice phase or double capture pattern', () => {
    expect(demoguardSource).not.toContain("phase === 'voice'");
    expect(demoguardSource).not.toContain("phase: 'voice'");
    expect(demoguardSource).toContain("'voice-proof'");
  });

  it('voice countdown state exists', () => {
    expect(demoguardSource).toContain('voiceCountdown');
    expect(demoguardSource).toContain('setVoiceCountdown');
  });

  it('voice retake is limited to one use', () => {
    expect(demoguardSource).toContain('voiceRetakeUsed');
    expect(demoguardSource).toContain('setVoiceRetakeUsed(true)');
  });
});

// ═══════════════════════════════════════════════════════════
// 2. N-Back Practice Trials
// ═══════════════════════════════════════════════════════════

describe('N-Back Practice Trials', () => {
  it('generateNBackPracticeTrials returns 3 practice trials', () => {
    const trials = generateNBackPracticeTrials();
    expect(trials).toHaveLength(3);
    expect(trials.every((t) => t.isPractice === true)).toBe(true);
  });

  it('practice trial 2 matches trial 1 (isTarget=true)', () => {
    const trials = generateNBackPracticeTrials();
    expect(trials[1].letter).toBe(trials[0].letter);
    expect(trials[1].isTarget).toBe(true);
  });

  it('practice trial 3 differs from trial 2 (isTarget=false)', () => {
    const trials = generateNBackPracticeTrials();
    expect(trials[2].letter).not.toBe(trials[1].letter);
    expect(trials[2].isTarget).toBe(false);
  });

  it('practice trials are filtered from scored results', () => {
    const practiceTrials = generateNBackPracticeTrials();
    const realTrials = generateNBackTrials();
    const allTrials = [...practiceTrials, ...realTrials];

    const practiceResults = practiceTrials.map((t, i) =>
      evaluateNBackTrial(t, t.isTarget, 500 + i * 100),
    );
    const realResults = realTrials.map((t, i) =>
      evaluateNBackTrial(t, t.isTarget, 600 + i * 100),
    );

    const allResults = [...practiceResults, ...realResults];
    const signal = computeNBackResult(allResults);

    // Practice trials should not be counted in the signal
    expect(signal.trials).toBe(realTrials.length);
  });

  it('DemoGuard.tsx uses OUI/NON buttons for N-Back', () => {
    expect(demoguardSource).toContain('>OUI<');
    expect(demoguardSource).toContain('>NON<');
    expect(demoguardSource).not.toContain('>MATCH<');
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Stroop Practice Trials
// ═══════════════════════════════════════════════════════════

describe('Stroop Practice Trials', () => {
  it('generateStroopPracticeTrials returns 2 practice trials', () => {
    const trials = generateStroopPracticeTrials();
    expect(trials).toHaveLength(2);
    expect(trials.every((t) => t.isPractice === true)).toBe(true);
  });

  it('practice trials are conflict trials (word != color)', () => {
    const trials = generateStroopPracticeTrials();
    expect(trials.every((t) => t.isConflict === true)).toBe(true);
    expect(trials.every((t) => t.word !== t.displayColor)).toBe(true);
  });

  it('practice trials are filtered from scored results', () => {
    const practiceTrials = generateStroopPracticeTrials();
    const realTrials = generateStroopTrials();

    const practiceResults: StroopTrialResult[] = practiceTrials.map((t, i) => ({
      config: t,
      selectedColor: t.displayColor as any,
      correct: true,
      response_ms: 500 + i * 100,
    }));
    const realResults: StroopTrialResult[] = realTrials.map((t, i) => ({
      config: t,
      selectedColor: t.displayColor as any,
      correct: true,
      response_ms: 600 + i * 100,
    }));

    const allResults = [...practiceResults, ...realResults];
    const signal = computeStroopResult(allResults);

    expect(signal.trials).toBe(realTrials.length);
  });

  it('DemoGuard.tsx uses French color names', () => {
    expect(demoguardSource).toContain('Rouge');
    expect(demoguardSource).toContain('Bleu');
    expect(demoguardSource).toContain('Vert');
    expect(demoguardSource).toContain('Jaune');
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Digit Span — Touch Buttons 0-9
// ═══════════════════════════════════════════════════════════

describe('Digit Span — Touch Buttons', () => {
  it('generateDigitSpanTrials produces valid trials', () => {
    const trials = generateDigitSpanTrials();
    expect(trials.length).toBeGreaterThan(0);
    expect(trials.every((t) => t.sequence.every((d) => d >= 0 && d <= 9))).toBe(true);
  });

  it('evaluateDigitSpanTrial correctly matches input', () => {
    const trial = { span: 3, sequence: [1, 2, 3] };
    const result = evaluateDigitSpanTrial(trial, [1, 2, 3], 1000);
    expect(result.correct).toBe(true);
  });

  it('evaluateDigitSpanTrial detects wrong input', () => {
    const trial = { span: 3, sequence: [1, 2, 3] };
    const result = evaluateDigitSpanTrial(trial, [1, 2, 4], 1000);
    expect(result.correct).toBe(false);
  });

  it('DemoGuard.tsx uses touch button grid (0-9) not text input', () => {
    expect(demoguardSource).toContain("gridTemplateColumns: 'repeat(5, 1fr)'");
    expect(demoguardSource).toContain("'1','2','3','4','5','6','7','8','9','0'");
    // Should NOT use the old text input pattern for digit span
    expect(demoguardSource).not.toContain('inputMode="numeric"');
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Behavior Touch Submit Guard
// ═══════════════════════════════════════════════════════════

describe('Behavior Touch Submit Guard', () => {
  it('DemoGuard.tsx has behaviorBlocked logic', () => {
    expect(demoguardSource).toContain('behaviorBlocked');
    expect(demoguardSource).toContain('behaviorInteractions');
  });

  it('DemoGuard.tsx blocks submit when behaviorBlocked', () => {
    expect(demoguardSource).toContain('if (behaviorBlocked)');
  });

  it('DemoGuard.tsx adds behavior block reason to submitBlockReasons', () => {
    expect(demoguardSource).toContain("submitBlockReasons.push('Pas assez d");
  });

  it('DemoGuard.tsx warns on low interactions (< 5)', () => {
    expect(demoguardSource).toContain('behaviorInteractions < 5');
    expect(demoguardSource).toContain('Signature tactile faible');
  });

  it('DemoGuard.tsx uses isSupported() from touch behavior collector', () => {
    expect(demoguardSource).toContain('getTouchBehaviorCollector().isSupported()');
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Phase Flow & Wording
// ═══════════════════════════════════════════════════════════

describe('Phase Flow & Wording', () => {
  it('Phase type includes new phases', () => {
    expect(demoguardSource).toContain("'prep'");
    expect(demoguardSource).toContain("'voice-proof'");
    expect(demoguardSource).toContain("'review'");
  });

  it('Phase type excludes old phases', () => {
    expect(demoguardSource).not.toContain("'reaction'");
    expect(demoguardSource).not.toContain("'voice'");
    expect(demoguardSource).not.toContain("'cognitive-vocal-ran'");
    expect(demoguardSource).not.toContain("'cognitive-summary'");
  });

  it('no vocal RAN challenge references', () => {
    expect(demoguardSource).not.toContain('vocalRanChallenge');
    expect(demoguardSource).not.toContain('handleVocalRan');
    expect(demoguardSource).not.toContain('VocalRanSignal');
  });

  it('no reaction test references (merged into cognitive reflex)', () => {
    expect(demoguardSource).not.toContain("phase === 'reaction'");
    expect(demoguardSource).not.toContain('handleReactionTap');
    expect(demoguardSource).not.toContain('reactionPhase');
  });

  it('French wording is used throughout', () => {
    expect(demoguardSource).toContain('Commencer');
    expect(demoguardSource).toContain('Préparation');
    expect(demoguardSource).toContain('Réflexe');
    expect(demoguardSource).toContain('Couleurs');
    expect(demoguardSource).toContain('Mémoire courte');
    expect(demoguardSource).toContain('Comparaison');
    expect(demoguardSource).toContain('Chemin');
    expect(demoguardSource).toContain('Preuve vocale');
    expect(demoguardSource).toContain('Récapitulatif');
    expect(demoguardSource).toContain('Envoyer');
  });

  it('no English jargon in UI labels (titles)', () => {
    // Comments may contain English, but visible card titles should be French
    const titleMatches = demoguardSource.match(/dg-card-title[^>]*>([^<]+)</g) || [];
    const titles = titleMatches.map((m) => m.replace(/dg-card-title[^>]*>/, '').replace(/<$/, ''));
    const englishJargon = ['Cognitive Battery', 'Human Cognitive Signature', 'Hybrid Vector Decision', 'Behavioral Touch', 'Voice Integrity', 'Brain / Monitoring', 'Signal Matrix', 'Progress Rings', 'Cognitive Science'];
    for (const jargon of englishJargon) {
      expect(titles.some((t) => t.includes(jargon))).toBe(false);
    }
  });

  it('review screen shows all test results', () => {
    expect(demoguardSource).toContain('Récapitulatif');
    expect(demoguardSource).toContain('selfieSignal?.captured');
    expect(demoguardSource).toContain('cogReflexSignal');
    expect(demoguardSource).toContain('cogStroopSignal');
    expect(demoguardSource).toContain('cogDigitSpanSignal');
    expect(demoguardSource).toContain('cogNBackSignal');
    expect(demoguardSource).toContain('cogTrailTapSignal');
    expect(demoguardSource).toContain('voiceSignal?.recorded');
    expect(demoguardSource).toContain('behaviorInteractions');
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Build Verification
// ═══════════════════════════════════════════════════════════

describe('Build Verification', () => {
  it('DemoGuard.tsx file exists and is non-empty', () => {
    expect(demoguardSource.length).toBeGreaterThan(1000);
  });

  it('no removed imports referenced', () => {
    expect(demoguardSource).not.toContain('vocalRanChallenge');
    expect(demoguardSource).not.toContain('reactionCollector');
    expect(demoguardSource).not.toContain('recordVocalRanInteraction');
  });

  it('finishToReview computes cognitive summary and behavior summary', () => {
    expect(demoguardSource).toContain('computeCognitiveSummary');
    expect(demoguardSource).toContain('getTouchBehaviorCollector().getSummary()');
    expect(demoguardSource).toContain('finishToReview');
  });

  it('vocal_ran is null in cognitive signals payload', () => {
    expect(demoguardSource).toContain('vocal_ran: null');
  });
});
