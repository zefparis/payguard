/**
 * DemoGuard — Reaction time collector
 *
 * Extracted from ReflexStep logic — pure functions, no React dependency.
 * Measures reaction time with too_fast/too_slow detection.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardReactionSignal } from '../types';

export const REACTION_TOO_FAST_MS = 100;
export const REACTION_TOO_SLOW_MS = 1500;
export const REACTION_ROUNDS = 2;

export interface ReactionRound {
  ms: number;
  too_fast: boolean;
  too_slow: boolean;
}

export interface ReactionCollectorResult {
  safe: DemoGuardReactionSignal;
  rounds: ReactionRound[];
}

export function evaluateRound(ms: number): ReactionRound {
  return {
    ms: Math.round(ms),
    too_fast: ms < REACTION_TOO_FAST_MS,
    too_slow: ms > REACTION_TOO_SLOW_MS,
  };
}

export function computeReactionResult(rounds: ReactionRound[]): DemoGuardReactionSignal {
  if (rounds.length === 0) {
    return { too_fast: false, too_slow: false, quality: 'missing' };
  }

  const validRounds = rounds.filter((r) => !r.too_fast && !r.too_slow);
  const hasTooFast = rounds.some((r) => r.too_fast);
  const hasTooSlow = rounds.some((r) => r.too_slow);

  if (validRounds.length === 0) {
    return {
      too_fast: hasTooFast,
      too_slow: hasTooSlow,
      quality: 'low',
    };
  }

  const avgMs = validRounds.reduce((sum, r) => sum + r.ms, 0) / validRounds.length;
  const quality = avgMs < 600 ? 'ok' : avgMs < 1000 ? 'low' : 'low';

  return {
    reaction_ms: Math.round(avgMs),
    too_fast: hasTooFast,
    too_slow: hasTooSlow,
    quality,
  };
}

export function getRandomDelayMs(): number {
  return 1500 + Math.random() * 2500;
}
