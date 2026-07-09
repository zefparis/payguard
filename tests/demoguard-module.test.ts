/**
 * DG-2: DemoGuard module tests
 *
 * Verifies:
 * - DemoGuard is hidden when VITE_DEMOGUARD_ENABLED=false
 * - hcs_session_public_id is required for submit
 * - payload source = demoguard_mobile
 * - no API key in client API code
 * - no sessionToken in payload
 * - signalCompleteness returns a score in [0, 1]
 * - response is type-safe and filtered
 * - No PII in demoguard source files
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Static file reads ─────────────────────────────────────────────

const DG_DIR = path.resolve(__dirname, '..', 'src', 'demoguard');
const API_FILE = path.resolve(DG_DIR, 'api.ts');
const TYPES_FILE = path.resolve(DG_DIR, 'types.ts');
const CONSTANTS_FILE = path.resolve(DG_DIR, 'constants.ts');
const DEVICE_FILE = path.resolve(DG_DIR, 'collectors', 'deviceCollector.ts');
const PERMISSION_FILE = path.resolve(DG_DIR, 'collectors', 'permissionCollector.ts');
const QUALITY_FILE = path.resolve(DG_DIR, 'quality', 'signalCompleteness.ts');
const PAGE_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'DemoGuard.tsx');
const APP_FILE = path.resolve(__dirname, '..', 'src', 'App.tsx');

const API_SRC = fs.readFileSync(API_FILE, 'utf-8');
const TYPES_SRC = fs.readFileSync(TYPES_FILE, 'utf-8');
const CONSTANTS_SRC = fs.readFileSync(CONSTANTS_FILE, 'utf-8');
const PAGE_SRC = fs.readFileSync(PAGE_FILE, 'utf-8');
const APP_SRC = fs.readFileSync(APP_FILE, 'utf-8');

// ─── Tests ─────────────────────────────────────────────────────────

describe('DG-2: DemoGuard feature gate', () => {
  it('constants.ts exports DEMOGUARD_ENABLED', () => {
    expect(CONSTANTS_SRC).toContain('DEMOGUARD_ENABLED');
  });

  it('DEMOGUARD_ENABLED reads VITE_DEMOGUARD_ENABLED env var', () => {
    expect(CONSTANTS_SRC).toContain('VITE_DEMOGUARD_ENABLED');
  });

  it('App.tsx always registers /demoguard route (not conditionally mounted)', () => {
    expect(APP_SRC).toContain('DEMOGUARD_ENABLED');
    expect(APP_SRC).toContain('DemoGuard');
    expect(APP_SRC).toContain("path={ROUTES.DEMOGUARD}");
    expect(APP_SRC).not.toMatch(/\{DEMOGUARD_ENABLED\s*&&\s*<Route/);
  });

  it('App.tsx renders disabled screen when DEMOGUARD_ENABLED is false', () => {
    expect(APP_SRC).toContain('DemoGuardDisabled');
  });

  it('App.tsx does not redirect /demoguard to home', () => {
    const demoguardRouteMatch = APP_SRC.match(/path=\{ROUTES\.DEMOGUARD\}[^}]*/);
    expect(demoguardRouteMatch).toBeDefined();
    expect(demoguardRouteMatch![0]).not.toContain('Navigate');
  });
});

describe('DG-2: DemoGuard types', () => {
  it('types.ts defines DemoGuardPayload', () => {
    expect(TYPES_SRC).toContain('DemoGuardPayload');
  });

  it('types.ts defines DemoGuardDeviceContext', () => {
    expect(TYPES_SRC).toContain('DemoGuardDeviceContext');
  });

  it('types.ts defines DemoGuardPermissions', () => {
    expect(TYPES_SRC).toContain('DemoGuardPermissions');
  });

  it('types.ts defines DemoGuardSignals', () => {
    expect(TYPES_SRC).toContain('DemoGuardSignals');
  });

  it('types.ts defines DemoGuardQuality', () => {
    expect(TYPES_SRC).toContain('DemoGuardQuality');
  });

  it('types.ts defines DemoGuardSafeResponse', () => {
    expect(TYPES_SRC).toContain('DemoGuardSafeResponse');
  });

  it('DemoGuardPayload has source field typed as demoguard_mobile', () => {
    expect(TYPES_SRC).toContain("source: 'demoguard_mobile'");
  });

  it('DemoGuardPayload has hcs_session_public_id field', () => {
    expect(TYPES_SRC).toContain('hcs_session_public_id');
  });

  it('DemoGuardPayload has demo_guard nested object', () => {
    expect(TYPES_SRC).toContain('demo_guard');
    expect(TYPES_SRC).toContain('version');
    expect(TYPES_SRC).toContain('started_at');
    expect(TYPES_SRC).toContain('completed_at');
  });
});

describe('DG-2: No API key in client code', () => {
  it('api.ts does not contain HV_API_KEY', () => {
    expect(API_SRC).not.toContain('HV_API_KEY');
  });

  it('api.ts does not contain X-API-Key', () => {
    expect(API_SRC).not.toContain('X-API-Key');
  });

  it('api.ts does not contain Authorization header', () => {
    expect(API_SRC).not.toContain('Authorization');
  });

  it('api.ts calls /api/demoguard/verify (proxy), not hybrid-vector-api directly', () => {
    expect(API_SRC).toContain('/api/demoguard/verify');
    expect(API_SRC).not.toContain('hybrid-vector-api');
    expect(API_SRC).not.toContain('onrender.com');
    expect(API_SRC).not.toContain('fly.dev');
  });
});

describe('DG-2: No sessionToken in payload or code', () => {
  it('types.ts does not define sessionToken', () => {
    expect(TYPES_SRC).not.toContain('sessionToken');
    expect(TYPES_SRC).not.toContain('session_token');
  });

  it('api.ts does not send sessionToken', () => {
    expect(API_SRC).not.toContain('sessionToken');
    expect(API_SRC).not.toContain('session_token');
  });

  it('page does not reference sessionToken', () => {
    expect(PAGE_SRC).not.toContain('sessionToken');
    expect(PAGE_SRC).not.toContain('session_token');
  });
});

describe('DG-2: No PII in DemoGuard module', () => {
  // identity fields must never appear anywhere in DemoGuard source
  const identityFields = ['first_name', 'last_name', 'student_id'];
  const allFiles = [API_SRC, TYPES_SRC, CONSTANTS_SRC, PAGE_SRC];

  for (const file of allFiles) {
    for (const field of identityFields) {
      it(`${field} not present in DemoGuard source`, () => {
        expect(file).not.toContain(field);
      });
    }
  }

  // selfie_b64 and voice_b64 are allowed in types.ts (DemoGuardSensitive) but NOT in page or api or constants
  it('selfie_b64 not in page or constants', () => {
    expect(PAGE_SRC).not.toContain('selfie_b64');
    expect(CONSTANTS_SRC).not.toContain('selfie_b64');
  });

  it('voice_b64 not in page or constants', () => {
    expect(PAGE_SRC).not.toContain('voice_b64');
    expect(CONSTANTS_SRC).not.toContain('voice_b64');
  });

  it('selfie_b64 only in DemoGuardSensitive type in types.ts', () => {
    // types.ts may contain selfie_b64 only in the DemoGuardSensitive interface
    const sensitiveMatch = TYPES_SRC.match(/DemoGuardSensitive[\s\S]*?\}/);
    expect(sensitiveMatch).toBeDefined();
    expect(sensitiveMatch![0]).toContain('selfie_b64');
    // DemoGuardSafeResponse must NOT contain selfie_b64
    const safeMatch = TYPES_SRC.match(/DemoGuardSafeResponse[\s\S]*?\}/);
    expect(safeMatch).toBeDefined();
    expect(safeMatch![0]).not.toContain('selfie_b64');
    expect(safeMatch![0]).not.toContain('voice_b64');
  });

  it('no token/jwt in DemoGuard types', () => {
    expect(TYPES_SRC).not.toMatch(/\btoken\b/i);
    expect(TYPES_SRC).not.toMatch(/\bjwt\b/i);
  });
});

describe('DG-2: signalCompleteness returns score in [0, 1]', () => {
  it('computeSignalCompleteness is exported', () => {
    const qualitySrc = fs.readFileSync(QUALITY_FILE, 'utf-8');
    expect(qualitySrc).toContain('export function computeSignalCompleteness');
  });

  it('returns 0 for empty signals', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const score = computeSignalCompleteness({
      selfie: null,
      reaction: null,
      voice: null,
      motion: null,
      orientation: null,
      touch: null,
      visibility: null,
      network: null,
    });
    expect(score).toBe(0);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns ~0.125 for one critical signal filled (1/8)', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const score = computeSignalCompleteness({
      selfie: { captured: true, quality: 'ok', width: 640, height: 480 },
      reaction: null,
      voice: null,
      motion: null,
      orientation: null,
      touch: null,
      visibility: null,
      network: null,
    });
    expect(score).toBeCloseTo(1 / 8, 5);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns 1 for all signals filled', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const score = computeSignalCompleteness({
      selfie: { captured: true, quality: 'ok', width: 640, height: 480 },
      reaction: { reaction_ms: 300, too_fast: false, too_slow: false, quality: 'ok' },
      voice: { recorded: true, duration_ms: 4000, challenge_id: 'dg_voice_TEST01', quality: 'ok', mfcc_available: true },
      motion: { supported: true, permission: 'granted', sample_count: 50, variance: 0.5, quality: 'ok' },
      orientation: { supported: true, permission: 'granted', sample_count: 50, changes: 10, quality: 'ok' },
      touch: { touch_count: 5, pointer_type: 'touch', pressure_supported: true, pressure_avg: 0.5, touch_duration_ms: 200, move_distance: 100, multi_touch_detected: false, quality: 'ok' },
      visibility: { blur_count: 0, focus_count: 1, visibility_hidden_count: 0, hidden_duration_ms: 0, page_focus_lost: false, quality: 'ok' },
      network: { online: true, effective_type: '4g', rtt: 50, downlink: 10, quality: 'ok' },
    });
    expect(score).toBe(1);
  });
});

describe('DG-2: computeQuality returns valid quality object', () => {
  it('returns quality with all fields', async () => {
    const { computeQuality } = await import('../src/demoguard/quality/signalCompleteness');
    const q = computeQuality(
      { selfie: null, reaction: null, voice: null, motion: null, orientation: null, touch: null, visibility: null, network: null },
      {
        platform: 'test', osVersion: '1', model: null, manufacturer: null,
        screenWidth: 400, screenHeight: 800, pixelRatio: 2, language: 'en',
        timezone: 'UTC', online: true,
      },
      { camera: 'prompt', microphone: 'prompt', notifications: 'unknown', location: 'unknown', motion: 'unsupported', orientation: 'unsupported' },
    );
    expect(q).toHaveProperty('signal_completeness');
    expect(q).toHaveProperty('device_ready');
    expect(q).toHaveProperty('permissions_ready');
    expect(q).toHaveProperty('overall_ready');
    expect(q.signal_completeness).toBeGreaterThanOrEqual(0);
    expect(q.signal_completeness).toBeLessThanOrEqual(1);
    expect(typeof q.device_ready).toBe('boolean');
    expect(typeof q.permissions_ready).toBe('boolean');
    expect(typeof q.overall_ready).toBe('boolean');
  });
});

describe('DG-2: DemoGuard page requires hcs_session_public_id', () => {
  it('page has sessionPublicId state', () => {
    expect(PAGE_SRC).toContain('sessionPublicId');
  });

  it('page validates sessionPublicId before submit', () => {
    expect(PAGE_SRC).toContain('sessionPublicId.trim()');
  });

  it('page imports from demoguard module (not PayGuard)', () => {
    expect(PAGE_SRC).toContain('../demoguard/');
    expect(PAGE_SRC).not.toContain('../lib/api');
  });
});

describe('DG-2: DemoGuard isolation from PayGuard', () => {
  it('demoguard types do not import from PayGuard flow types', () => {
    expect(TYPES_SRC).not.toContain('flow');
    expect(TYPES_SRC).not.toContain('EnrollPayload');
    expect(TYPES_SRC).not.toContain('AuthPaymentPayload');
  });

  it('demoguard api does not import PayGuard api', () => {
    expect(API_SRC).not.toContain('../lib/api');
    expect(API_SRC).not.toContain('enroll');
    expect(API_SRC).not.toContain('payVerify');
  });
});

describe('DG-2: Proxy endpoint exists', () => {
  const proxyFile = path.resolve(__dirname, '..', 'api', 'demoguard', 'verify.ts');
  it('api/demoguard/verify.ts exists', () => {
    expect(fs.existsSync(proxyFile)).toBe(true);
  });

  if (fs.existsSync(proxyFile)) {
    const proxySrc = fs.readFileSync(proxyFile, 'utf-8');
    it('proxy exports default handler', () => {
      expect(proxySrc).toContain('export default');
    });
    it('proxy uses HV_API_KEY server-side', () => {
      expect(proxySrc).toContain('process.env.HV_API_KEY');
    });
    it('proxy sanitizes upstream response', () => {
      expect(proxySrc).toContain('sanitizeResponse');
    });
  }
});
