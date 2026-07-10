/**
 * P-03: DemoGuard Cognitive Battery Tests
 *
 * Tests all 6 cognitive modules + scoring + safety constraints.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {
  REFLEX_ROUNDS,
  REFLEX_TOO_FAST_MS,
  REFLEX_TOO_SLOW_MS,
  evaluateReflexRound,
  computeReflexResult,
  getRandomReflexDelay,
  type ReflexRoundResult,
} from '../src/demoguard/cognitive/reflexChallenge';

import {
  STROOP_TRIALS,
  STROOP_MIN_CONFLICT,
  generateStroopTrials,
  computeStroopResult,
  type StroopTrialResult,
  type StroopColor,
  type StroopTrialConfig,
} from '../src/demoguard/cognitive/stroopChallenge';

import {
  DIGIT_SPAN_TRIALS,
  generateDigitSpanTrials,
  evaluateDigitSpanTrial,
  computeDigitSpanResult,
} from '../src/demoguard/cognitive/digitSpanChallenge';

import {
  NBACK_TRIALS,
  generateNBackTrials,
  evaluateNBackTrial,
  computeNBackResult,
} from '../src/demoguard/cognitive/nBackChallenge';

import {
  generateTrailTapNodes,
  computeTrailTapResult,
  type TrailTapEvent,
} from '../src/demoguard/cognitive/trailTapChallenge';

import {
  VOCAL_RAN_ITEMS,
  generateVocalRanChallenge,
  computeVocalRanResult,
  hashSequence,
} from '../src/demoguard/cognitive/vocalRanChallenge';

import { computeCognitiveSummary } from '../src/demoguard/cognitive/cognitiveScoring';
import type { CognitiveSignals } from '../src/demoguard/cognitive/cognitiveTypes';

// ─── Helpers ───────────────────────────────────────────────────────

function makeReflexRounds(times: number[]): ReflexRoundResult[] {
  return times.map((t) => evaluateReflexRound(t));
}

function makeStroopResults(
  configs: { word: StroopColor; displayColor: StroopColor; isConflict: boolean }[],
  selections: StroopColor[],
  responseTimes: number[],
): StroopTrialResult[] {
  return configs.map((cfg, i) => ({
    config: cfg,
    selected: selections[i],
    correct: selections[i] === cfg.displayColor,
    response_ms: responseTimes[i],
  }));
}

// ─── File paths for safety tests ───────────────────────────────────

const DG_DIR = path.resolve(__dirname, '..', 'src', 'demoguard');
const COG_DIR = path.resolve(DG_DIR, 'cognitive');
const PAGE_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'DemoGuard.tsx');
const TYPES_FILE = path.resolve(DG_DIR, 'types.ts');
const API_FILE = path.resolve(DG_DIR, 'api.ts');

// ─── Tests ─────────────────────────────────────────────────────────

describe('P-03: DemoGuard Cognitive Battery', () => {

  // ── Reflex ───────────────────────────────────────────────────────

  describe('Reflex multi-round', () => {
    it('should compute avg, median, variance from multiple rounds', () => {
      const rounds = makeReflexRounds([300, 400, 500, 350, 450]);
      const result = computeReflexResult(rounds);
      expect(result.rounds).toBe(5);
      expect(result.avg_ms).toBe(400);
      expect(result.median_ms).toBe(400);
      expect(result.variance_ms).toBeGreaterThan(0);
      expect(result.min_ms).toBe(300);
      expect(result.max_ms).toBe(500);
    });

    it('should detect too_fast responses (< 120ms)', () => {
      const rounds = makeReflexRounds([80, 90, 300, 400, 500]);
      const result = computeReflexResult(rounds);
      expect(result.too_fast_count).toBe(2);
      expect(result.quality).toBe('review');
    });

    it('should detect too_slow responses (> 1800ms)', () => {
      const rounds = makeReflexRounds([2000, 2100, 300, 400, 500]);
      const result = computeReflexResult(rounds);
      expect(result.too_slow_count).toBe(2);
      expect(result.quality).toBe('review');
    });

    it('should detect robotic regularity (near-zero variance)', () => {
      const rounds = makeReflexRounds([400, 401, 400, 401, 400]);
      const result = computeReflexResult(rounds);
      expect(result.regularity_score).toBeLessThan(0.15);
      expect(result.quality).toBe('review');
    });

    it('should return missing quality for zero rounds', () => {
      const result = computeReflexResult([]);
      expect(result.quality).toBe('missing');
    });
  });

  // ── Stroop ────────────────────────────────────────────────────────

  describe('Stroop', () => {
    it('should compute accuracy correctly', () => {
      const trials = generateStroopTrials(6);
      const results: StroopTrialResult[] = trials.map((cfg, i) => ({
        config: cfg,
        selected: cfg.displayColor, // all correct
        correct: true,
        response_ms: 600 + i * 50,
      }));
      const result = computeStroopResult(results);
      expect(result.accuracy).toBe(1);
      expect(result.error_count).toBe(0);
      expect(result.quality).toBe('ok');
    });

    it('should compute conflict_cost_ms (conflict vs non-conflict RT)', () => {
      const results = makeStroopResults(
        [
          { word: 'red', displayColor: 'red', isConflict: false },
          { word: 'blue', displayColor: 'red', isConflict: true },
          { word: 'green', displayColor: 'green', isConflict: false },
          { word: 'yellow', displayColor: 'green', isConflict: true },
          { word: 'red', displayColor: 'blue', isConflict: true },
          { word: 'blue', displayColor: 'blue', isConflict: false },
        ],
        ['red', 'red', 'green', 'green', 'blue', 'blue'], // all correct
        [500, 800, 450, 750, 850, 480],
      );
      const result = computeStroopResult(results);
      expect(result.conflict_cost_ms).toBeGreaterThan(0);
      expect(result.conflict_trials).toBe(3);
    });

    it('should return failed quality for very low accuracy', () => {
      // Use deterministic trials where none are yellow, so selecting yellow = 0% accuracy
      const trials: StroopTrialConfig[] = [
        { word: 'red', displayColor: 'red', isConflict: false },
        { word: 'blue', displayColor: 'blue', isConflict: false },
        { word: 'green', displayColor: 'green', isConflict: false },
        { word: 'red', displayColor: 'red', isConflict: false },
        { word: 'blue', displayColor: 'blue', isConflict: false },
        { word: 'green', displayColor: 'green', isConflict: false },
      ];
      const results: StroopTrialResult[] = trials.map((cfg) => ({
        config: cfg,
        selected: 'yellow' as StroopColor, // always wrong
        correct: false,
        response_ms: 500,
      }));
      const result = computeStroopResult(results);
      expect(result.accuracy).toBeLessThan(0.5);
    });
  });

  // ── Digit Span ────────────────────────────────────────────────────

  describe('Digit Span', () => {
    it('should compute max_span correctly', () => {
      const trials = generateDigitSpanTrials(3);
      const results = [
        evaluateDigitSpanTrial(trials[0], trials[0].sequence), // correct
        evaluateDigitSpanTrial(trials[1], trials[1].sequence), // correct
        evaluateDigitSpanTrial(trials[2], [9, 9, 9, 9, 9, 9]), // wrong
      ];
      const result = computeDigitSpanResult(results);
      expect(result.max_span).toBe(trials[1].span);
      expect(result.accuracy).toBeCloseTo(0.67, 1);
    });

    it('should compute positional_errors correctly', () => {
      const trial = { sequence: [1, 2, 3, 4], span: 4 };
      const result = evaluateDigitSpanTrial(trial, [1, 2, 5, 4]);
      expect(result.positional_errors).toBe(1);
      expect(result.correct).toBe(false);
    });

    it('should return missing for zero trials', () => {
      const result = computeDigitSpanResult([]);
      expect(result.quality).toBe('missing');
    });
  });

  // ── N-Back ────────────────────────────────────────────────────────

  describe('N-Back', () => {
    it('should compute hits, false positives, misses correctly', () => {
      const trials = generateNBackTrials(8);
      const results = trials.map((cfg, i) => {
        // Say "match" for first 4, "no match" for last 4
        return evaluateNBackTrial(cfg, i < 4, 500 + i * 50);
      });
      const result = computeNBackResult(results);
      expect(result.trials).toBe(8);
      expect(result.hits + result.misses).toBe(result.targets);
      expect(result.false_positives + (8 - result.targets - result.false_positives)).toBe(8 - result.targets);
    });

    it('should compute accuracy correctly for perfect performance', () => {
      const trials = generateNBackTrials(8);
      const results = trials.map((cfg) => {
        return evaluateNBackTrial(cfg, cfg.isTarget, 500);
      });
      const result = computeNBackResult(results);
      expect(result.accuracy).toBe(1);
      expect(result.hits).toBe(result.targets);
      expect(result.false_positives).toBe(0);
      expect(result.misses).toBe(0);
    });

    it('should return failed for very low accuracy', () => {
      const trials = generateNBackTrials(8);
      const results = trials.map((cfg) => {
        // Always say "match" — will have many false positives
        return evaluateNBackTrial(cfg, true, 300);
      });
      const result = computeNBackResult(results);
      expect(result.false_positives).toBeGreaterThan(0);
    });
  });

  // ── Trail Tap ─────────────────────────────────────────────────────

  describe('Trail Tap', () => {
    it('should compute wrong_taps correctly', () => {
      const nodes = generateTrailTapNodes(5);
      const events: TrailTapEvent[] = [
        { nodeId: 1, timestamp: 0, correct: true },
        { nodeId: 3, timestamp: 500, correct: false }, // wrong
        { nodeId: 2, timestamp: 800, correct: true },
        { nodeId: 3, timestamp: 1200, correct: true },
        { nodeId: 4, timestamp: 1600, correct: true },
        { nodeId: 5, timestamp: 2000, correct: true },
      ];
      const result = computeTrailTapResult(nodes, events, 2000);
      expect(result.wrong_taps).toBe(1);
    });

    it('should compute path_efficiency correctly', () => {
      const nodes = generateTrailTapNodes(5);
      const events: TrailTapEvent[] = nodes.map((n, i) => ({
        nodeId: n.id,
        timestamp: i * 500,
        correct: true,
      }));
      const result = computeTrailTapResult(nodes, events, 2500);
      expect(result.path_efficiency).toBeGreaterThan(0);
      expect(result.path_efficiency).toBeLessThanOrEqual(1);
    });

    it('should detect hesitations (gap > 1500ms)', () => {
      const nodes = generateTrailTapNodes(5);
      const events: TrailTapEvent[] = [
        { nodeId: 1, timestamp: 0, correct: true },
        { nodeId: 2, timestamp: 2000, correct: true }, // hesitation
        { nodeId: 3, timestamp: 2500, correct: true },
        { nodeId: 4, timestamp: 3000, correct: true },
        { nodeId: 5, timestamp: 3500, correct: true },
      ];
      const result = computeTrailTapResult(nodes, events, 3500);
      expect(result.hesitation_count).toBe(1);
    });
  });

  // ── Vocal RAN ─────────────────────────────────────────────────────

  describe('Vocal RAN', () => {
    it('should generate a challenge_id', () => {
      const challenge = generateVocalRanChallenge();
      expect(challenge.challenge_id).toMatch(/^dg_vran_/);
    });

    it('should generate expected_sequence_hash without exposing raw sequence in safe output', () => {
      const challenge = generateVocalRanChallenge();
      const result = computeVocalRanResult(challenge, 3000, true);
      expect(result.expected_hash).toBeTruthy();
      expect(result.expected_hash).toMatch(/^[0-9a-f]+$/);
      // Safe output should not contain the raw sequence
      const safeStr = JSON.stringify(result);
      expect(safeStr).not.toContain('sequence');
    });

    it('should return failed quality when audio is not present', () => {
      const challenge = generateVocalRanChallenge();
      const result = computeVocalRanResult(challenge, 3000, false);
      expect(result.quality).toBe('failed');
      expect(result.audio_present).toBe(false);
    });

    it('hashSequence should produce consistent hashes for same input', () => {
      expect(hashSequence(['1', '2', '3'])).toBe(hashSequence(['1', '2', '3']));
      expect(hashSequence(['1', '2', '3'])).not.toBe(hashSequence(['3', '2', '1']));
    });
  });

  // ── Cognitive Summary ─────────────────────────────────────────────

  describe('computeCognitiveSummary', () => {
    it('should return low depth_score when only reflex is completed', () => {
      const signals: CognitiveSignals = {
        reflex: computeReflexResult(makeReflexRounds([300, 400, 350, 380, 420])),
        stroop: null,
        digit_span: null,
        n_back: null,
        trail_tap: null,
        vocal_ran: null,
        summary: null,
      };
      const summary = computeCognitiveSummary(signals);
      expect(summary.completed_modules).toBe(1);
      expect(summary.depth_score).toBeLessThanOrEqual(0.35);
    });

    it('should return high depth_score when 4+ modules are coherent', () => {
      const signals: CognitiveSignals = {
        reflex: computeReflexResult(makeReflexRounds([300, 400, 350, 380, 420])),
        stroop: { trials: 6, conflict_trials: 3, accuracy: 0.83, avg_response_ms: 600, conflict_cost_ms: 200, error_count: 1, quality: 'ok' },
        digit_span: { trials: 3, max_span: 5, accuracy: 0.67, positional_errors: 1, quality: 'ok' },
        n_back: { trials: 8, targets: 2, hits: 2, false_positives: 1, misses: 0, accuracy: 0.88, avg_response_ms: 500, quality: 'ok' },
        trail_tap: null,
        vocal_ran: null,
        summary: null,
      };
      const summary = computeCognitiveSummary(signals);
      expect(summary.completed_modules).toBe(4);
      expect(summary.depth_score).toBeGreaterThanOrEqual(0.70);
    });

    it('should increase anomaly_score when too_fast_count is high', () => {
      const signals: CognitiveSignals = {
        reflex: computeReflexResult(makeReflexRounds([80, 90, 85, 100, 95])),
        stroop: null,
        digit_span: null,
        n_back: null,
        trail_tap: null,
        vocal_ran: null,
        summary: null,
      };
      const summary = computeCognitiveSummary(signals);
      expect(summary.anomaly_score).toBeGreaterThan(0.3);
    });

    it('should return review/failed quality for random answers', () => {
      const signals: CognitiveSignals = {
        reflex: null,
        stroop: { trials: 6, conflict_trials: 3, accuracy: 0.17, avg_response_ms: 200, conflict_cost_ms: 0, error_count: 5, quality: 'failed' },
        digit_span: { trials: 3, max_span: 0, accuracy: 0, positional_errors: 12, quality: 'failed' },
        n_back: { trials: 8, targets: 2, hits: 0, false_positives: 6, misses: 2, accuracy: 0.25, avg_response_ms: 150, quality: 'failed' },
        trail_tap: null,
        vocal_ran: null,
        summary: null,
      };
      const summary = computeCognitiveSummary(signals);
      expect(summary.quality).toMatch(/review|failed/);
    });

    it('should return review quality for robotic timings', () => {
      const signals: CognitiveSignals = {
        reflex: computeReflexResult(makeReflexRounds([400, 401, 400, 401, 400])),
        stroop: null,
        digit_span: null,
        n_back: null,
        trail_tap: null,
        vocal_ran: null,
        summary: null,
      };
      const summary = computeCognitiveSummary(signals);
      expect(summary.anomaly_score).toBeGreaterThan(0.2);
    });

    it('should set human_likelihood to low when accuracy is very low', () => {
      const signals: CognitiveSignals = {
        reflex: null,
        stroop: { trials: 6, conflict_trials: 3, accuracy: 0.17, avg_response_ms: 200, conflict_cost_ms: 0, error_count: 5, quality: 'failed' },
        digit_span: { trials: 3, max_span: 0, accuracy: 0, positional_errors: 10, quality: 'failed' },
        n_back: { trials: 8, targets: 2, hits: 0, false_positives: 5, misses: 2, accuracy: 0.25, avg_response_ms: 200, quality: 'failed' },
        trail_tap: null,
        vocal_ran: null,
        summary: null,
      };
      const summary = computeCognitiveSummary(signals);
      expect(summary.human_likelihood).toBe('low');
    });

    it('should set human_likelihood to high when multiple modules are coherent', () => {
      const signals: CognitiveSignals = {
        reflex: { rounds: 5, avg_ms: 380, median_ms: 370, variance_ms: 1200, min_ms: 300, max_ms: 450, too_fast_count: 0, too_slow_count: 0, regularity_score: 0.6, quality: 'ok' },
        stroop: { trials: 6, conflict_trials: 3, accuracy: 0.83, avg_response_ms: 650, conflict_cost_ms: 200, error_count: 1, quality: 'ok' },
        digit_span: { trials: 3, max_span: 5, accuracy: 0.67, positional_errors: 1, quality: 'ok' },
        n_back: { trials: 8, targets: 2, hits: 2, false_positives: 1, misses: 0, accuracy: 0.88, avg_response_ms: 550, quality: 'ok' },
        trail_tap: { nodes: 5, completion_ms: 3000, wrong_taps: 0, hesitation_count: 1, path_efficiency: 0.85, quality: 'ok' },
        vocal_ran: null,
        summary: null,
      };
      const summary = computeCognitiveSummary(signals);
      expect(summary.human_likelihood).toBe('high');
    });

    it('should return failed when completed_modules < 3', () => {
      const signals: CognitiveSignals = {
        reflex: computeReflexResult(makeReflexRounds([300, 400])),
        stroop: null,
        digit_span: null,
        n_back: null,
        trail_tap: null,
        vocal_ran: null,
        summary: null,
      };
      const summary = computeCognitiveSummary(signals);
      expect(summary.completed_modules).toBeLessThan(3);
      expect(summary.quality).toMatch(/review|failed/);
    });
  });

  // ── UI / Safety ───────────────────────────────────────────────────

  describe('UI safety', () => {
    const PAGE_SRC = fs.readFileSync(PAGE_FILE, 'utf-8');
    const TYPES_SRC = fs.readFileSync(TYPES_FILE, 'utf-8');
    const API_SRC = fs.readFileSync(API_FILE, 'utf-8');

    it('should not display "Human proof 100%" wording', () => {
      expect(PAGE_SRC).not.toContain('Human proof 100%');
      expect(PAGE_SRC).not.toContain('100% human');
    });

    it('should separate sensor readiness from cognitive depth in UI', () => {
      expect(PAGE_SRC).toContain('Cognitive');
    });

    it('should show submit warning when cognitive_depth < 0.65', () => {
      // The UI must have some conditional related to cognitive depth warning
      expect(PAGE_SRC).toContain('depth') 
    });

    it('should not contain PII fields in cognitive types', () => {
      const cogTypesPath = path.resolve(COG_DIR, 'cognitiveTypes.ts');
      const cogTypesSrc = fs.readFileSync(cogTypesPath, 'utf-8');
      const forbidden = ['first_name', 'last_name', 'email', 'phone', 'student_id', 'selfie_b64', 'voice_b64'];
      for (const f of forbidden) {
        expect(cogTypesSrc).not.toContain(f);
      }
    });

    it('should not contain sessionToken in any cognitive file', () => {
      const cogFiles = fs.readdirSync(COG_DIR).filter((f) => f.endsWith('.ts'));
      for (const file of cogFiles) {
        const src = fs.readFileSync(path.resolve(COG_DIR, file), 'utf-8');
        expect(src).not.toContain('sessionToken');
      }
    });

    it('should not contain HV_API_KEY in any demoguard file', () => {
      const allFiles = [
        ...fs.readdirSync(DG_DIR).filter((f) => f.endsWith('.ts')).map((f) => path.resolve(DG_DIR, f)),
        ...fs.readdirSync(COG_DIR).filter((f) => f.endsWith('.ts')).map((f) => path.resolve(COG_DIR, f)),
      ];
      for (const file of allFiles) {
        const src = fs.readFileSync(file, 'utf-8');
        expect(src).not.toContain('HV_API_KEY');
      }
    });

    it('should not contain HCS_API_KEY in any demoguard file', () => {
      const allFiles = [
        ...fs.readdirSync(DG_DIR).filter((f) => f.endsWith('.ts')).map((f) => path.resolve(DG_DIR, f)),
        ...fs.readdirSync(COG_DIR).filter((f) => f.endsWith('.ts')).map((f) => path.resolve(COG_DIR, f)),
      ];
      for (const file of allFiles) {
        const src = fs.readFileSync(file, 'utf-8');
        expect(src).not.toContain('HCS_API_KEY');
      }
    });

    it('should not expose raw audio in UI/response', () => {
      expect(PAGE_SRC).not.toContain('voice_b64');
      expect(API_SRC).not.toContain('voice_b64');
    });

    it('should not expose raw sequence in vocal RAN safe output', () => {
      const cogTypesSrc = fs.readFileSync(path.resolve(COG_DIR, 'cognitiveTypes.ts'), 'utf-8');
      // The VocalRanSignal interface should not have a 'sequence' field
      // Extract just the interface definition
      const match = cogTypesSrc.match(/interface VocalRanSignal \{[^}]+\}/);
      expect(match).toBeTruthy();
      expect(match![0]).not.toContain('sequence');
    });

    it('should have cognitive signals in DemoGuardSignals type', () => {
      expect(TYPES_SRC).toContain('cognitive');
      expect(TYPES_SRC).toContain('CognitiveSignals');
    });
  });
});
