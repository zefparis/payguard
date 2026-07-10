/**
 * DemoGuard — Touch behavior collector (singleton)
 *
 * Collects touch interaction events during cognitive tasks.
 * Stores only safe aggregates — no raw coordinates, paths, or traces.
 *
 * Each cognitive module calls recordInteraction() on every tap/selection.
 * At the end of the battery, getBehaviorSummary() produces the final summary.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { CognitiveTaskName, TaskTouchBehavior, BehaviorSummary, BehaviorPayload, TouchDiagnosticsBehaviorSafe } from './behaviorTypes';
import { computeBehaviorSummary, computeTaskBehavior } from './behaviorScoring';

interface InteractionRecord {
  task: CognitiveTaskName;
  timestamp: number;
  pressure: number | null;
  isCorrection: boolean;
  isWrongTap: boolean;
  pathSegmentDistance: number | null;
  optimalSegmentDistance: number | null;
}

const HESITATION_THRESHOLD_MS = 1500;

class TouchBehaviorCollector {
  private interactions: InteractionRecord[] = [];
  private taskStartedAt: Partial<Record<CognitiveTaskName, number>> = {};
  private touchSupported: boolean | null = null;

  constructor() {
    this.detectTouchSupport();
  }

  private detectTouchSupport(): void {
    if (typeof window !== 'undefined') {
      this.touchSupported = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
    } else {
      this.touchSupported = false;
    }
  }

  isSupported(): boolean {
    return this.touchSupported ?? false;
  }

  startTask(task: CognitiveTaskName): void {
    this.taskStartedAt[task] = performance.now();
  }

  recordInteraction(
    task: CognitiveTaskName,
    opts?: {
      pressure?: number | null;
      isCorrection?: boolean;
      isWrongTap?: boolean;
      pathSegmentDistance?: number | null;
      optimalSegmentDistance?: number | null;
    },
  ): void {
    const now = performance.now();
    this.interactions.push({
      task,
      timestamp: now,
      pressure: opts?.pressure ?? null,
      isCorrection: opts?.isCorrection ?? false,
      isWrongTap: opts?.isWrongTap ?? false,
      pathSegmentDistance: opts?.pathSegmentDistance ?? null,
      optimalSegmentDistance: opts?.optimalSegmentDistance ?? null,
    });
  }

  getInteractionsForTask(task: CognitiveTaskName): InteractionRecord[] {
    return this.interactions.filter((i) => i.task === task);
  }

  getTaskBehavior(task: CognitiveTaskName): TaskTouchBehavior | null {
    const records = this.getInteractionsForTask(task);
    if (records.length === 0) return null;
    return computeTaskBehavior(task, records);
  }

  getAllTaskBehaviors(): Partial<Record<CognitiveTaskName, TaskTouchBehavior>> {
    const result: Partial<Record<CognitiveTaskName, TaskTouchBehavior>> = {};
    const tasks: CognitiveTaskName[] = ['reflex', 'stroop', 'digit_span', 'n_back', 'trail_tap', 'vocal_ran'];
    for (const task of tasks) {
      const tb = this.getTaskBehavior(task);
      if (tb) result[task] = tb;
    }
    return result;
  }

  getSummary(): BehaviorSummary {
    const taskBehaviors = this.getAllTaskBehaviors();
    return computeBehaviorSummary(taskBehaviors);
  }

  getPayload(): BehaviorPayload {
    const taskBehaviors = this.getAllTaskBehaviors();
    const summary = computeBehaviorSummary(taskBehaviors);
    return { taskBehaviors, summary };
  }

  getTouchDiagnostics(): TouchDiagnosticsBehaviorSafe {
    const summary = this.getSummary();
    const supported = this.isSupported();

    if (!supported) {
      return {
        status: 'unsupported',
        supported: false,
        interactionCount: 0,
        tasksObserved: 0,
        quality: 'unsupported',
        reasonSafe: 'touch_unsupported',
        behaviorConsistency: 0,
        motorConfidence: 0,
      };
    }

    if (summary.totalInteractions > 0) {
      const diagQuality = summary.quality === 'ok' ? 'ok' : 'review';
      return {
        status: diagQuality,
        supported: true,
        interactionCount: summary.totalInteractions,
        tasksObserved: summary.tasksObserved,
        quality: diagQuality,
        reasonSafe: 'behavior_touch_captured',
        behaviorConsistency: summary.consistencyScore,
        motorConfidence: summary.motorConfidence,
      };
    }

    return {
      status: 'missing',
      supported: true,
      interactionCount: 0,
      tasksObserved: 0,
      quality: 'missing',
      reasonSafe: 'behavior_touch_missing',
      behaviorConsistency: 0,
      motorConfidence: 0,
    };
  }

  reset(): void {
    this.interactions = [];
    this.taskStartedAt = {};
  }

  getInteractionCount(): number {
    return this.interactions.length;
  }
}

let singleton: TouchBehaviorCollector | null = null;

export function getTouchBehaviorCollector(): TouchBehaviorCollector {
  if (!singleton) {
    singleton = new TouchBehaviorCollector();
  }
  return singleton;
}

export function resetTouchBehaviorCollector(): void {
  if (singleton) {
    singleton.reset();
  }
}

export { HESITATION_THRESHOLD_MS };
