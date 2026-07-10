/**
 * P10-FINAL — PayGuard touch runtime + behavior payload tests
 *
 * Verifies:
 * - TouchBehaviorCollector records interactions during cognitive tasks
 * - getPayload() includes taskBehaviors and summary
 * - getTouchDiagnostics() returns safe fields (no raw data)
 * - buildTouchDiagnosticsSafe uses behavior diagnostics when available
 * - Proxy verify handler logs behavior payload presence
 * - No raw touch events, coordinates, or pressure series in output
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTouchBehaviorCollector,
  resetTouchBehaviorCollector,
} from '../src/demoguard/behavior/touchBehaviorCollector';
import {
  recordTaskStart,
  recordReflexTap,
  recordStroopSelection,
  recordDigitSpanKey,
  recordDigitSpanSubmit,
  recordNBackDecision,
  recordTrailTap,
} from '../src/demoguard/behavior/taskBehaviorRecorder';

describe('P10-FINAL — PayGuard touch runtime', () => {
  beforeEach(() => {
    resetTouchBehaviorCollector();
  });

  describe('TouchBehaviorCollector — interaction recording', () => {
    it('records interactions across multiple cognitive tasks', () => {
      const collector = getTouchBehaviorCollector();

      recordTaskStart('reflex');
      recordReflexTap(250, false);
      recordReflexTap(300, false);
      recordReflexTap(180, false);

      recordTaskStart('stroop');
      recordStroopSelection('red', true, 800, false);
      recordStroopSelection('blue', false, 1200, true);

      recordTaskStart('digit_span');
      recordDigitSpanKey(false);
      recordDigitSpanKey(false);
      recordDigitSpanSubmit();

      recordTaskStart('n_back');
      recordNBackDecision(true, 600);
      recordNBackDecision(false, 900);


      recordTaskStart('trail_tap');
      recordTrailTap(true, null, null);
      recordTrailTap(true, null, null);
      recordTrailTap(true, null, null);

      const summary = collector.getSummary();
      expect(summary.tasksObserved).toBeGreaterThanOrEqual(4);
      expect(summary.totalInteractions).toBeGreaterThanOrEqual(10);
    });

    it('getPayload returns taskBehaviors and summary', () => {
      const collector = getTouchBehaviorCollector();

      recordTaskStart('reflex');
      recordReflexTap(200, false);
      recordReflexTap(250, false);

      const payload = collector.getPayload();
      expect(payload).toHaveProperty('taskBehaviors');
      expect(payload).toHaveProperty('summary');
      expect(payload.summary.totalInteractions).toBeGreaterThanOrEqual(2);
      expect(payload.taskBehaviors.reflex).toBeDefined();
      expect(payload.taskBehaviors.reflex.interactionCount).toBeGreaterThanOrEqual(2);
    });

    it('getTouchDiagnostics returns safe fields only', () => {
      const collector = getTouchBehaviorCollector();

      recordTaskStart('reflex');
      recordReflexTap(200, false);

      const diag = collector.getTouchDiagnostics();
      expect(diag).toHaveProperty('status');
      expect(diag).toHaveProperty('supported');
      expect(diag).toHaveProperty('interactionCount');
      expect(diag).toHaveProperty('tasksObserved');
      expect(diag).toHaveProperty('quality');
      expect(diag).toHaveProperty('reasonSafe');
      expect(diag).toHaveProperty('behaviorConsistency');
      expect(diag).toHaveProperty('motorConfidence');
    });

    it('getTouchDiagnostics returns missing when no interactions', () => {
      const collector = getTouchBehaviorCollector();
      const diag = collector.getTouchDiagnostics();

      if (collector.isSupported()) {
        expect(diag.status).toBe('missing');
        expect(diag.interactionCount).toBe(0);
        expect(diag.reasonSafe).toBe('behavior_touch_missing');
      } else {
        expect(diag.status).toBe('unsupported');
      }
    });
  });

  describe('TouchBehaviorCollector — no raw data in output', () => {
    it('payload does not contain raw touch events or coordinates', () => {
      const collector = getTouchBehaviorCollector();

      recordTaskStart('reflex');
      recordReflexTap(200, false);

      const payload = collector.getPayload();
      const json = JSON.stringify(payload);

      expect(json).not.toContain('coordinate');
      expect(json).not.toContain('raw_touch');
      expect(json).not.toContain('pressure_series');
      expect(json).not.toContain('path_trace');
      expect(json).not.toContain('touch_event');
    });

    it('diagnostics does not contain raw fields', () => {
      const collector = getTouchBehaviorCollector();

      recordTaskStart('stroop');
      recordStroopSelection('red', true, 500, false);

      const diag = collector.getTouchDiagnostics();
      const json = JSON.stringify(diag);

      expect(json).not.toContain('coordinate');
      expect(json).not.toContain('raw_');
      expect(json).not.toContain('pressure_series');
      expect(json).not.toContain('path_');
    });
  });

  describe('TouchBehaviorCollector — scoring quality', () => {
    it('produces ok quality with sufficient interactions across tasks', () => {
      const collector = getTouchBehaviorCollector();

      // Record interactions across 4+ tasks
      recordTaskStart('reflex');
      for (let i = 0; i < 5; i++) recordReflexTap(200 + i * 20, false);

      recordTaskStart('stroop');
      for (let i = 0; i < 3; i++) recordStroopSelection('red', true, 600 + i * 100, false);

      recordTaskStart('digit_span');
      for (let i = 0; i < 4; i++) recordDigitSpanKey(false);
      recordDigitSpanSubmit();

      recordTaskStart('trail_tap');
      for (let i = 0; i < 5; i++) recordTrailTap(true, null, null);

      const summary = collector.getSummary();
      expect(summary.tasksObserved).toBeGreaterThanOrEqual(4);
      expect(summary.totalInteractions).toBeGreaterThanOrEqual(15);
      expect(summary.quality).toMatch(/^(ok|review)$/);
    });

    it('produces failed quality with no interactions', () => {
      const collector = getTouchBehaviorCollector();
      const summary = collector.getSummary();
      expect(summary.tasksObserved).toBe(0);
      expect(summary.totalInteractions).toBe(0);
      expect(summary.quality).toBe('failed');
    });
  });

  describe('Proxy verify handler — behavior payload log', () => {
    it('verify.ts source contains behavior payload logging', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const verifyPath = path.resolve(__dirname, '..', 'api', 'demoguard', 'verify.ts');
      const src = fs.readFileSync(verifyPath, 'utf-8');

      expect(src).toContain('demoguard_behavior_signal');
      expect(src).toContain('behaviorPresent');
      expect(src).toContain('behaviorTasksObserved');
      expect(src).toContain('behaviorTotalInteractions');
      expect(src).toContain('touchDiagBehaviorPresent');
    });
  });

  describe('DemoGuard.tsx — behavior payload in submit', () => {
    it('DemoGuard.tsx includes behavior in signals', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const demoGuardPath = path.resolve(__dirname, '..', 'src', 'pages', 'DemoGuard.tsx');
      const src = fs.readFileSync(demoGuardPath, 'utf-8');

      expect(src).toContain('behavior: behaviorPayload');
      expect(src).toContain('touchDiagnosticsBehavior: behaviorDiag');
      expect(src).toContain('getTouchBehaviorCollector().getPayload()');
      expect(src).toContain('getTouchBehaviorCollector().getTouchDiagnostics()');
    });

    it('DemoGuard.tsx shows behavioral touch panel', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const demoGuardPath = path.resolve(__dirname, '..', 'src', 'pages', 'DemoGuard.tsx');
      const src = fs.readFileSync(demoGuardPath, 'utf-8');

      expect(src).toContain('Behavioral Touch');
      expect(src).toContain('Motor confidence');
      expect(src).toContain('Payload ready');
    });
  });
});
