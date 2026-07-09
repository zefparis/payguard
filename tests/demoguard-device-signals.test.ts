/**
 * DG-4: DemoGuard device signals tests
 *
 * Verifies mobile peripheral signals: DeviceMotion, DeviceOrientation,
 * touch dynamics, visibility/focus tracking, Network Information API.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const DG_DIR = path.resolve(__dirname, '..', 'src', 'demoguard');
const TYPES_FILE = path.resolve(DG_DIR, 'types.ts');
const PAGE_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'DemoGuard.tsx');
const MOTION_FILE = path.resolve(DG_DIR, 'collectors', 'motionCollector.ts');
const ORIENTATION_FILE = path.resolve(DG_DIR, 'collectors', 'orientationCollector.ts');
const TOUCH_FILE = path.resolve(DG_DIR, 'collectors', 'touchCollector.ts');
const VISIBILITY_FILE = path.resolve(DG_DIR, 'collectors', 'visibilityCollector.ts');
const NETWORK_FILE = path.resolve(DG_DIR, 'collectors', 'networkCollector.ts');
const DEVICE_QUALITY_FILE = path.resolve(DG_DIR, 'quality', 'deviceSignalQuality.ts');
const SIGNAL_COMPLETENESS_FILE = path.resolve(DG_DIR, 'quality', 'signalCompleteness.ts');

const TYPES_SRC = fs.readFileSync(TYPES_FILE, 'utf-8');
const PAGE_SRC = fs.readFileSync(PAGE_FILE, 'utf-8');
const MOTION_SRC = fs.readFileSync(MOTION_FILE, 'utf-8');
const ORIENTATION_SRC = fs.readFileSync(ORIENTATION_FILE, 'utf-8');
const TOUCH_SRC = fs.readFileSync(TOUCH_FILE, 'utf-8');
const VISIBILITY_SRC = fs.readFileSync(VISIBILITY_FILE, 'utf-8');
const NETWORK_SRC = fs.readFileSync(NETWORK_FILE, 'utf-8');

// ─── Motion collector ──────────────────────────────────────────────

describe('DG-4: Motion collector', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { DeviceMotionEvent: class {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('motionCollector.ts exists', () => {
    expect(fs.existsSync(MOTION_FILE)).toBe(true);
  });

  it('exports isMotionSupported, requestMotionPermission, collectMotion', () => {
    expect(MOTION_SRC).toContain('export function isMotionSupported');
    expect(MOTION_SRC).toContain('export async function requestMotionPermission');
    expect(MOTION_SRC).toContain('export function collectMotion');
  });

  it('handles unsupported DeviceMotion gracefully', async () => {
    vi.stubGlobal('window', {});
    const { collectMotion } = await import('../src/demoguard/collectors/motionCollector');
    const result = await collectMotion(100);
    expect(result.supported).toBe(false);
    expect(result.permission).toBe('unsupported');
    expect(result.quality).toBe('unsupported');
    expect(result.sample_count).toBe(0);
  });

  it('requestMotionPermission returns unsupported when no DeviceMotionEvent', async () => {
    vi.stubGlobal('window', {});
    const { requestMotionPermission } = await import('../src/demoguard/collectors/motionCollector');
    const result = await requestMotionPermission();
    expect(result).toBe('unsupported');
  });

  it('requestMotionPermission calls iOS requestPermission when available', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('window', {
      DeviceMotionEvent: class {
        static requestPermission = mockRequestPermission;
      },
    });
    const { requestMotionPermission } = await import('../src/demoguard/collectors/motionCollector');
    const result = await requestMotionPermission();
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(result).toBe('granted');
  });

  it('collectMotion returns safe metadata (no raw traces)', () => {
    expect(MOTION_SRC).toContain('sample_count');
    expect(MOTION_SRC).toContain('variance');
    expect(MOTION_SRC).toContain('quality');
    expect(MOTION_SRC).not.toContain('raw_motion_trace');
  });
});

// ─── Orientation collector ─────────────────────────────────────────

describe('DG-4: Orientation collector', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { DeviceOrientationEvent: class {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('orientationCollector.ts exists', () => {
    expect(fs.existsSync(ORIENTATION_FILE)).toBe(true);
  });

  it('exports isOrientationSupported, requestOrientationPermission, collectOrientation', () => {
    expect(ORIENTATION_SRC).toContain('export function isOrientationSupported');
    expect(ORIENTATION_SRC).toContain('export async function requestOrientationPermission');
    expect(ORIENTATION_SRC).toContain('export function collectOrientation');
  });

  it('handles unsupported DeviceOrientation gracefully', async () => {
    vi.stubGlobal('window', {});
    const { collectOrientation } = await import('../src/demoguard/collectors/orientationCollector');
    const result = await collectOrientation(100);
    expect(result.supported).toBe(false);
    expect(result.permission).toBe('unsupported');
    expect(result.quality).toBe('unsupported');
    expect(result.changes).toBe(0);
  });

  it('requestOrientationPermission returns unsupported when no DeviceOrientationEvent', async () => {
    vi.stubGlobal('window', {});
    const { requestOrientationPermission } = await import('../src/demoguard/collectors/orientationCollector');
    const result = await requestOrientationPermission();
    expect(result).toBe('unsupported');
  });

  it('requestOrientationPermission calls iOS requestPermission when available', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('window', {
      DeviceOrientationEvent: class {
        static requestPermission = mockRequestPermission;
      },
    });
    const { requestOrientationPermission } = await import('../src/demoguard/collectors/orientationCollector');
    const result = await requestOrientationPermission();
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(result).toBe('granted');
  });

  it('collectOrientation returns safe metadata (no raw traces)', () => {
    expect(ORIENTATION_SRC).toContain('sample_count');
    expect(ORIENTATION_SRC).toContain('changes');
    expect(ORIENTATION_SRC).toContain('quality');
    expect(ORIENTATION_SRC).not.toContain('raw_orientation_trace');
  });
});

// ─── Touch collector ───────────────────────────────────────────────

describe('DG-4: Touch collector', () => {
  it('touchCollector.ts exists', () => {
    expect(fs.existsSync(TOUCH_FILE)).toBe(true);
  });

  it('exports collectTouch', () => {
    expect(TOUCH_SRC).toContain('export function collectTouch');
  });

  it('listens to pointerdown, pointermove, pointerup', () => {
    expect(TOUCH_SRC).toContain("addEventListener('pointerdown'");
    expect(TOUCH_SRC).toContain("addEventListener('pointermove'");
    expect(TOUCH_SRC).toContain("addEventListener('pointerup'");
  });

  it('computes move_distance from pointer events', () => {
    expect(TOUCH_SRC).toContain('totalMoveDistance');
    expect(TOUCH_SRC).toContain('Math.sqrt');
  });

  it('detects pressure_supported', () => {
    expect(TOUCH_SRC).toContain('pressure_supported');
    expect(TOUCH_SRC).toContain('e.pressure');
  });

  it('detects multi_touch', () => {
    expect(TOUCH_SRC).toContain('multi_touch_detected');
    expect(TOUCH_SRC).toContain('isPrimary');
  });

  it('returns safe metadata (no raw_touch_trace)', () => {
    expect(TOUCH_SRC).toContain('touch_count');
    expect(TOUCH_SRC).toContain('quality');
    expect(TOUCH_SRC).not.toContain('raw_touch_trace');
  });

  it('pressure_supported is false when pressure is 0', async () => {
    vi.stubGlobal('performance', { now: () => Date.now() });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const { collectTouch } = await import('../src/demoguard/collectors/touchCollector');
    const result = await collectTouch(50);
    expect(result.pressure_supported).toBe(false);
    expect(result.touch_count).toBe(0);
    expect(result.quality).toBe('missing');
    vi.unstubAllGlobals();
  });
});

// ─── Visibility collector ──────────────────────────────────────────

describe('DG-4: Visibility collector', () => {
  it('visibilityCollector.ts exists', () => {
    expect(fs.existsSync(VISIBILITY_FILE)).toBe(true);
  });

  it('exports collectVisibility', () => {
    expect(VISIBILITY_SRC).toContain('export function collectVisibility');
  });

  it('listens to visibilitychange, blur, focus', () => {
    expect(VISIBILITY_SRC).toContain("addEventListener('visibilitychange'");
    expect(VISIBILITY_SRC).toContain("addEventListener('blur'");
    expect(VISIBILITY_SRC).toContain("addEventListener('focus'");
  });

  it('computes hidden_duration_ms', () => {
    expect(VISIBILITY_SRC).toContain('hidden_duration_ms');
    expect(VISIBILITY_SRC).toContain('performance.now()');
  });

  it('returns safe metadata', () => {
    expect(VISIBILITY_SRC).toContain('blur_count');
    expect(VISIBILITY_SRC).toContain('focus_count');
    expect(VISIBILITY_SRC).toContain('visibility_hidden_count');
    expect(VISIBILITY_SRC).toContain('page_focus_lost');
    expect(VISIBILITY_SRC).toContain('quality');
  });

  it('quality is ok when no blur events', async () => {
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('performance', { now: () => 0 });
    const { collectVisibility } = await import('../src/demoguard/collectors/visibilityCollector');
    const result = await collectVisibility(50);
    expect(result.blur_count).toBe(0);
    expect(result.quality).toBe('ok');
    vi.unstubAllGlobals();
  });
});

// ─── Network collector ─────────────────────────────────────────────

describe('DG-4: Network collector', () => {
  it('networkCollector.ts exists', () => {
    expect(fs.existsSync(NETWORK_FILE)).toBe(true);
  });

  it('exports collectNetwork, isNetworkInfoSupported', () => {
    expect(NETWORK_SRC).toContain('export function collectNetwork');
    expect(NETWORK_SRC).toContain('export function isNetworkInfoSupported');
  });

  it('falls back gracefully when navigator.connection is absent', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const { collectNetwork } = await import('../src/demoguard/collectors/networkCollector');
    const result = collectNetwork();
    expect(result.quality).toBe('unsupported');
    expect(result.online).toBe(true);
    expect(result.effective_type).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('returns safe metadata when connection is available', async () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      connection: { effectiveType: '4g', rtt: 50, downlink: 10 },
    });
    const { collectNetwork } = await import('../src/demoguard/collectors/networkCollector');
    const result = collectNetwork();
    expect(result.quality).toBe('ok');
    expect(result.online).toBe(true);
    expect(result.effective_type).toBe('4g');
    expect(result.rtt).toBe(50);
    expect(result.downlink).toBe(10);
    vi.unstubAllGlobals();
  });
});

// ─── Device signal quality ─────────────────────────────────────────

describe('DG-4: Device signal quality assessor', () => {
  it('deviceSignalQuality.ts exists', () => {
    expect(fs.existsSync(DEVICE_QUALITY_FILE)).toBe(true);
  });

  it('assessMotionQuality returns missing for null', async () => {
    const { assessMotionQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessMotionQuality(null)).toBe('missing');
  });

  it('assessMotionQuality returns unsupported for unsupported signal', async () => {
    const { assessMotionQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessMotionQuality({ supported: false, permission: 'unsupported', sample_count: 0, quality: 'unsupported' })).toBe('unsupported');
  });

  it('assessOrientationQuality returns missing for null', async () => {
    const { assessOrientationQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessOrientationQuality(null)).toBe('missing');
  });

  it('assessTouchQuality returns missing for null', async () => {
    const { assessTouchQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessTouchQuality(null)).toBe('missing');
  });

  it('assessVisibilityQuality returns missing for null', async () => {
    const { assessVisibilityQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessVisibilityQuality(null)).toBe('missing');
  });

  it('assessNetworkQuality returns missing for null', async () => {
    const { assessNetworkQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessNetworkQuality(null)).toBe('missing');
  });
});

// ─── Signal completeness v2 ────────────────────────────────────────

describe('DG-4: Signal completeness v2 with device signals', () => {
  it('0% with no signals', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const score = computeSignalCompleteness({
      selfie: null, reaction: null, voice: null,
      motion: null, orientation: null, touch: null, visibility: null, network: null,
    });
    expect(score).toBe(0);
  });

  it('increases with device signals added', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const base = {
      selfie: null, reaction: null, voice: null,
      motion: null, orientation: null, touch: null, visibility: null, network: null,
    };
    const score0 = computeSignalCompleteness(base);
    const score1 = computeSignalCompleteness({
      ...base,
      motion: { supported: true, permission: 'granted', sample_count: 50, variance: 0.5, quality: 'ok' },
    });
    expect(score1).toBeGreaterThan(score0);
  });

  it('unsupported optional does not penalize like missing critical', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const withUnsupported = {
      selfie: null, reaction: null, voice: null,
      motion: { supported: false, permission: 'unsupported', sample_count: 0, quality: 'unsupported' } as const,
      orientation: { supported: false, permission: 'unsupported', sample_count: 0, changes: 0, quality: 'unsupported' } as const,
      touch: null, visibility: null, network: null,
    };
    const scoreUnsupported = computeSignalCompleteness(withUnsupported);
    // unsupported slots count as filled, so score should be > 0
    expect(scoreUnsupported).toBeGreaterThan(0);
  });

  it('100% when all 8 slots filled', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const score = computeSignalCompleteness({
      selfie: { captured: true, quality: 'ok', width: 640, height: 480 },
      reaction: { reaction_ms: 300, too_fast: false, too_slow: false, quality: 'ok' },
      voice: { recorded: true, duration_ms: 4000, challenge_id: 'dg_voice_TEST', quality: 'ok', mfcc_available: true },
      motion: { supported: true, permission: 'granted', sample_count: 50, variance: 0.5, quality: 'ok' },
      orientation: { supported: true, permission: 'granted', sample_count: 50, changes: 10, quality: 'ok' },
      touch: { touch_count: 5, pointer_type: 'touch', pressure_supported: true, pressure_avg: 0.5, touch_duration_ms: 200, move_distance: 100, multi_touch_detected: false, quality: 'ok' },
      visibility: { blur_count: 0, focus_count: 1, visibility_hidden_count: 0, hidden_duration_ms: 0, page_focus_lost: false, quality: 'ok' },
      network: { online: true, effective_type: '4g', rtt: 50, downlink: 10, quality: 'ok' },
    });
    expect(score).toBe(1);
  });

  it('computeQuality returns critical_missing and missing_optional', async () => {
    const { computeQuality } = await import('../src/demoguard/quality/signalCompleteness');
    const q = computeQuality(
      { selfie: null, reaction: null, voice: null, motion: null, orientation: null, touch: null, visibility: null, network: null },
      { platform: 'test', osVersion: '1', model: null, manufacturer: null, screenWidth: 400, screenHeight: 800, pixelRatio: 2, language: 'en', timezone: 'UTC', online: true },
      { camera: 'prompt', microphone: 'prompt', notifications: 'unknown', location: 'unknown', motion: 'unsupported', orientation: 'unsupported' },
    );
    expect(q.critical_missing).toContain('selfie');
    expect(q.critical_missing).toContain('reaction');
    expect(q.critical_missing).toContain('voice');
    expect(q.missing_optional).toContain('touch');
    expect(q.missing_optional).toContain('visibility');
    expect(q.missing_optional).toContain('network');
  });
});

// ─── Types ─────────────────────────────────────────────────────────

describe('DG-4: Types include device signal interfaces', () => {
  it('DemoGuardMotionSignal defined', () => {
    expect(TYPES_SRC).toContain('DemoGuardMotionSignal');
    expect(TYPES_SRC).toContain('sample_count');
    expect(TYPES_SRC).toContain('variance');
  });

  it('DemoGuardOrientationSignal defined', () => {
    expect(TYPES_SRC).toContain('DemoGuardOrientationSignal');
    expect(TYPES_SRC).toContain('changes');
  });

  it('DemoGuardTouchSignal defined', () => {
    expect(TYPES_SRC).toContain('DemoGuardTouchSignal');
    expect(TYPES_SRC).toContain('touch_count');
    expect(TYPES_SRC).toContain('pressure_supported');
    expect(TYPES_SRC).toContain('multi_touch_detected');
    expect(TYPES_SRC).toContain('move_distance');
  });

  it('DemoGuardVisibilitySignal defined', () => {
    expect(TYPES_SRC).toContain('DemoGuardVisibilitySignal');
    expect(TYPES_SRC).toContain('blur_count');
    expect(TYPES_SRC).toContain('hidden_duration_ms');
    expect(TYPES_SRC).toContain('page_focus_lost');
  });

  it('DemoGuardNetworkSignal defined', () => {
    expect(TYPES_SRC).toContain('DemoGuardNetworkSignal');
    expect(TYPES_SRC).toContain('effective_type');
    expect(TYPES_SRC).toContain('rtt');
    expect(TYPES_SRC).toContain('downlink');
  });

  it('SignalQuality includes unsupported', () => {
    expect(TYPES_SRC).toContain("'unsupported'");
  });

  it('DemoGuardPermissions includes motion and orientation', () => {
    expect(TYPES_SRC).toContain('motion:');
    expect(TYPES_SRC).toContain('orientation:');
  });

  it('DemoGuardQuality includes critical_missing and missing_optional', () => {
    expect(TYPES_SRC).toContain('critical_missing');
    expect(TYPES_SRC).toContain('missing_optional');
  });

  it('DemoGuardSignals includes all 8 slots', () => {
    expect(TYPES_SRC).toContain('motion:');
    expect(TYPES_SRC).toContain('orientation:');
    expect(TYPES_SRC).toContain('touch:');
    expect(TYPES_SRC).toContain('visibility:');
    expect(TYPES_SRC).toContain('network:');
  });

  it('DemoGuardSafeResponse does NOT contain raw traces', () => {
    const safeMatch = TYPES_SRC.match(/DemoGuardSafeResponse[\s\S]*?\}/);
    expect(safeMatch).toBeDefined();
    expect(safeMatch![0]).not.toContain('raw_motion_trace');
    expect(safeMatch![0]).not.toContain('raw_touch_trace');
  });
});

// ─── Page integration ──────────────────────────────────────────────

describe('DG-4: Page integrates device signals', () => {
  it('page imports motionCollector', () => {
    expect(PAGE_SRC).toContain('motionCollector');
    expect(PAGE_SRC).toContain('collectMotion');
  });

  it('page imports orientationCollector', () => {
    expect(PAGE_SRC).toContain('orientationCollector');
    expect(PAGE_SRC).toContain('collectOrientation');
  });

  it('page imports touchCollector', () => {
    expect(PAGE_SRC).toContain('touchCollector');
    expect(PAGE_SRC).toContain('collectTouch');
  });

  it('page imports visibilityCollector', () => {
    expect(PAGE_SRC).toContain('visibilityCollector');
    expect(PAGE_SRC).toContain('collectVisibility');
  });

  it('page imports networkCollector', () => {
    expect(PAGE_SRC).toContain('networkCollector');
    expect(PAGE_SRC).toContain('collectNetwork');
  });

  it('page has device-signals phase', () => {
    expect(PAGE_SRC).toContain("'device-signals'");
  });

  it('page displays Motion status', () => {
    expect(PAGE_SRC).toContain('Motion:');
  });

  it('page displays Orientation status', () => {
    expect(PAGE_SRC).toContain('Orientation:');
  });

  it('page displays Touch status', () => {
    expect(PAGE_SRC).toContain('Touch:');
  });

  it('page displays Focus status', () => {
    expect(PAGE_SRC).toContain('Focus:');
  });

  it('page displays Network status', () => {
    expect(PAGE_SRC).toContain('Network:');
  });

  it('page does NOT display raw_motion_trace', () => {
    expect(PAGE_SRC).not.toContain('raw_motion_trace');
  });

  it('page does NOT display raw_touch_trace', () => {
    expect(PAGE_SRC).not.toContain('raw_touch_trace');
  });

  it('page does NOT console.log', () => {
    expect(PAGE_SRC).not.toMatch(/console\.(log|warn|error)/);
  });
});

// ─── Security: no PII / no raw traces / no API keys ────────────────

describe('DG-4: No PII / no raw traces / no API key', () => {
  const allDgFiles = [
    TYPES_SRC, PAGE_SRC, MOTION_SRC, ORIENTATION_SRC, TOUCH_SRC,
    VISIBILITY_SRC, NETWORK_SRC,
    fs.readFileSync(DEVICE_QUALITY_FILE, 'utf-8'),
    fs.readFileSync(SIGNAL_COMPLETENESS_FILE, 'utf-8'),
  ];

  it('no first_name in any DemoGuard file', () => {
    for (const f of allDgFiles) expect(f).not.toContain('first_name');
  });

  it('no last_name in any DemoGuard file', () => {
    for (const f of allDgFiles) expect(f).not.toContain('last_name');
  });

  it('no student_id in any DemoGuard file', () => {
    for (const f of allDgFiles) expect(f).not.toContain('student_id');
  });

  it('no HV_API_KEY in any DemoGuard file', () => {
    for (const f of allDgFiles) expect(f).not.toContain('HV_API_KEY');
  });

  it('no sessionToken in any DemoGuard file', () => {
    for (const f of allDgFiles) expect(f).not.toContain('sessionToken');
  });

  it('no raw_motion_trace in any DemoGuard file', () => {
    for (const f of allDgFiles) expect(f).not.toContain('raw_motion_trace');
  });

  it('no raw_touch_trace in any DemoGuard file', () => {
    for (const f of allDgFiles) expect(f).not.toContain('raw_touch_trace');
  });

  it('no localStorage usage in DemoGuard files', () => {
    for (const f of allDgFiles) expect(f).not.toContain('localStorage');
  });
});

// ─── DemoGuard isolation from PayGuard ─────────────────────────────

describe('DG-4: DemoGuard does not import PayGuard business modules', () => {
  it('page does not import from lib/api (PayGuard API)', () => {
    expect(PAGE_SRC).not.toContain("from '../lib/api'");
  });

  it('page does not import PayGuard steps', () => {
    expect(PAGE_SRC).not.toContain("from '../steps/");
  });

  it('motionCollector does not import PayGuard modules', () => {
    expect(MOTION_SRC).not.toContain('../lib/api');
    expect(MOTION_SRC).not.toContain('../types/flow');
  });

  it('orientationCollector does not import PayGuard modules', () => {
    expect(ORIENTATION_SRC).not.toContain('../lib/api');
    expect(ORIENTATION_SRC).not.toContain('../types/flow');
  });

  it('touchCollector does not import PayGuard modules', () => {
    expect(TOUCH_SRC).not.toContain('../lib/api');
    expect(TOUCH_SRC).not.toContain('../types/flow');
  });

  it('visibilityCollector does not import PayGuard modules', () => {
    expect(VISIBILITY_SRC).not.toContain('../lib/api');
    expect(VISIBILITY_SRC).not.toContain('../types/flow');
  });

  it('networkCollector does not import PayGuard modules', () => {
    expect(NETWORK_SRC).not.toContain('../lib/api');
    expect(NETWORK_SRC).not.toContain('../types/flow');
  });
});
