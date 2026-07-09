/**
 * DG-10: Smoke test — DemoGuard docs existence + forbidden terms
 *
 * Validates:
 * - All 4 DG-10 doc files exist
 * - No instruction to show raw selfie/audio in docs
 * - No instruction to expose raw logs in docs
 * - No instruction to expose env vars publicly
 * - Rollback flags documented
 * - No internal metrics exposed in runbook
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const HCS_ROOT = path.resolve(__dirname, '..', '..');

const DOC_FILES = [
  'DEMOGUARD_REAL_DEVICE_CHECKLIST.md',
  'DEMOGUARD_LEVY_RUNBOOK.md',
  'DEMOGUARD_ENV_CHECKLIST.md',
  'DEMOGUARD_FAILURE_MODES.md',
];

function readDoc(filename: string): string {
  const filePath = path.join(HCS_ROOT, filename);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── 1. All doc files exist ────────────────────────────────────────

describe('DG-10: Doc files exist', () => {
  for (const file of DOC_FILES) {
    it(`${file} exists`, () => {
      const filePath = path.join(HCS_ROOT, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  }
});

// ─── 2. No instruction to show raw selfie/audio ────────────────────

describe('DG-10: No instruction to show raw selfie/audio', () => {
  for (const file of DOC_FILES) {
    const content = readDoc(file);
    it(`${file} does not instruct to show raw selfie`, () => {
      expect(content).not.toContain('show raw selfie');
      expect(content).not.toContain('afficher selfie brut');
      expect(content).not.toContain('display raw selfie');
    });

    it(`${file} does not instruct to show raw audio`, () => {
      expect(content).not.toContain('show raw audio');
      expect(content).not.toContain('afficher audio brut');
      expect(content).not.toContain('play raw audio');
    });
  }
});

// ─── 3. No instruction to expose raw logs ──────────────────────────

describe('DG-10: No instruction to expose raw logs', () => {
  const runbook = readDoc('DEMOGUARD_LEVY_RUNBOOK.md');

  it('runbook does not instruct to show raw event log', () => {
    expect(runbook).not.toContain('show raw event log');
    expect(runbook).not.toContain('afficher raw event');
  });

  it('runbook does not instruct to show console with payload', () => {
    expect(runbook).not.toContain('open console with payload');
    expect(runbook).not.toContain('afficher console avec payload');
  });

  it('runbook explicitly forbids showing raw event log', () => {
    expect(runbook).toContain('Raw event log');
    expect(runbook).toContain('❌');
  });
});

// ─── 4. No instruction to expose env vars ──────────────────────────

describe('DG-10: No instruction to expose env vars', () => {
  const runbook = readDoc('DEMOGUARD_LEVY_RUNBOOK.md');

  it('runbook forbids showing Vercel env vars', () => {
    expect(runbook).toContain('Variables d\'environnement Vercel');
    expect(runbook).toContain('❌');
  });

  it('runbook forbids showing Render env vars', () => {
    expect(runbook).toContain('Variables d\'environnement Render');
    expect(runbook).toContain('❌');
  });
});

// ─── 5. Rollback flags documented ──────────────────────────────────

describe('DG-10: Rollback flags documented', () => {
  const runbook = readDoc('DEMOGUARD_LEVY_RUNBOOK.md');
  const envChecklist = readDoc('DEMOGUARD_ENV_CHECKLIST.md');

  const requiredFlags = [
    'VITE_DEMOGUARD_ENABLED',
    'NEXT_PUBLIC_HCS_DEMO_SHOW_RAW_EVENTS',
    'HCS_DEMO_LEVY_ENABLED',
    'HCS_DASHBOARD_PIPELINE_MODE',
    'HCS_DASHBOARD_ENFORCE_PERCENT',
  ];

  for (const flag of requiredFlags) {
    it(`runbook documents rollback flag ${flag}`, () => {
      expect(runbook).toContain(flag);
    });
  }

  for (const flag of requiredFlags) {
    it(`env checklist documents ${flag}`, () => {
      expect(envChecklist).toContain(flag);
    });
  }
});

// ─── 6. No internal metrics exposed in runbook ─────────────────────

describe('DG-10: No internal metrics exposed in runbook', () => {
  const runbook = readDoc('DEMOGUARD_LEVY_RUNBOOK.md');

  it('runbook does not expose FAR/FRR metrics', () => {
    expect(runbook).not.toContain('FAR');
    expect(runbook).not.toContain('FRR');
  });

  it('runbook does not expose calibration thresholds', () => {
    expect(runbook).not.toContain('calibration');
    expect(runbook).not.toContain('threshold');
  });
});

// ─── 7. Raw debug default false documented ─────────────────────────

describe('DG-10: Raw debug default false documented', () => {
  const checklist = readDoc('DEMOGUARD_REAL_DEVICE_CHECKLIST.md');
  const envChecklist = readDoc('DEMOGUARD_ENV_CHECKLIST.md');

  it('checklist mentions raw debug disabled', () => {
    expect(checklist).toContain('raw debug');
    expect(checklist.toLowerCase()).toContain('désactivé');
  });

  it('env checklist has NEXT_PUBLIC_HCS_DEMO_SHOW_RAW_EVENTS=false', () => {
    expect(envChecklist).toContain('NEXT_PUBLIC_HCS_DEMO_SHOW_RAW_EVENTS');
    expect(envChecklist).toContain('false');
  });
});

// ─── 8. Platform matrix documented ─────────────────────────────────

describe('DG-10: Platform matrix documented', () => {
  const checklist = readDoc('DEMOGUARD_REAL_DEVICE_CHECKLIST.md');

  it('checklist has platform matrix with Android Chrome', () => {
    expect(checklist).toContain('Android Chrome');
  });

  it('checklist has platform matrix with iPhone Safari', () => {
    expect(checklist).toContain('iPhone Safari');
  });

  it('checklist has platform matrix with Capacitor WebView', () => {
    expect(checklist).toContain('Capacitor WebView');
  });
});

// ─── 9. Failure modes documented ───────────────────────────────────

describe('DG-10: Failure modes documented', () => {
  const failureModes = readDoc('DEMOGUARD_FAILURE_MODES.md');

  const requiredModes = [
    'Camera denied',
    'Microphone denied',
    'MediaRecorder unsupported',
    'sessionPublicId invalid',
    'HCS session not found',
    'Render cold start',
    'SSE disconnected',
    'Raw debug accidentally enabled',
  ];

  for (const mode of requiredModes) {
    it(`failure modes documents: ${mode}`, () => {
      expect(failureModes).toContain(mode);
    });
  }
});
