/**
 * DemoGuard — Task behavior recorder
 *
 * Provides per-task recording helpers that the DemoGuard UI calls
 * during each cognitive module. Each helper feeds the singleton
 * TouchBehaviorCollector with safe aggregate data.
 *
 * No raw coordinates, raw paths, or raw traces stored.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { getTouchBehaviorCollector } from './touchBehaviorCollector';
import type { CognitiveTaskName } from './behaviorTypes';

export function recordTaskStart(task: CognitiveTaskName): void {
  getTouchBehaviorCollector().startTask(task);
}

export function recordReflexTap(_reactionMs: number, tooFast: boolean): void {
  const collector = getTouchBehaviorCollector();
  collector.recordInteraction('reflex', {
    isWrongTap: tooFast,
  });
}

export function recordStroopSelection(
  _color: string,
  isCorrect: boolean,
  _responseMs: number,
  isCorrection: boolean,
): void {
  const collector = getTouchBehaviorCollector();
  collector.recordInteraction('stroop', {
    isCorrection,
    isWrongTap: !isCorrect,
  });
}

export function recordDigitSpanKey(
  isDeletion: boolean,
): void {
  const collector = getTouchBehaviorCollector();
  collector.recordInteraction('digit_span', {
    isCorrection: isDeletion,
  });
}

export function recordDigitSpanSubmit(): void {
  const collector = getTouchBehaviorCollector();
  collector.recordInteraction('digit_span');
}

export function recordNBackDecision(
  isCorrect: boolean,
  _responseMs: number,
): void {
  const collector = getTouchBehaviorCollector();
  collector.recordInteraction('n_back', {
    isWrongTap: !isCorrect,
  });
}

export function recordTrailTap(
  isCorrect: boolean,
  pathSegmentDistance: number | null,
  optimalSegmentDistance: number | null,
): void {
  const collector = getTouchBehaviorCollector();
  collector.recordInteraction('trail_tap', {
    isWrongTap: !isCorrect,
    pathSegmentDistance,
    optimalSegmentDistance,
  });
}

export function recordVocalRanInteraction(): void {
  const collector = getTouchBehaviorCollector();
  collector.recordInteraction('vocal_ran');
}
