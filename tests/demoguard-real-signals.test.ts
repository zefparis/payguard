/**
 * DG-3: DemoGuard real signals tests
 *
 * Verifies that real PayGuard signals (selfie, reaction, audio/MFCC)
 * are wired into the isolated DemoGuard module.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Static file reads ─────────────────────────────────────────────

const DG_DIR = path.resolve(__dirname, '..', 'src', 'demoguard');
const TYPES_FILE = path.resolve(DG_DIR, 'types.ts');
const PAGE_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'DemoGuard.tsx');
const CAMERA_FILE = path.resolve(DG_DIR, 'collectors', 'cameraCollector.ts');
const REACTION_FILE = path.resolve(DG_DIR, 'collectors', 'reactionCollector.ts');
const AUDIO_FILE = path.resolve(DG_DIR, 'collectors', 'audioCollector.ts');
const SELFIE_QUALITY_FILE = path.resolve(DG_DIR, 'quality', 'selfieQuality.ts');
const AUDIO_QUALITY_FILE = path.resolve(DG_DIR, 'quality', 'audioQuality.ts');
const SIGNAL_COMPLETENESS_FILE = path.resolve(DG_DIR, 'quality', 'signalCompleteness.ts');

const TYPES_SRC = fs.readFileSync(TYPES_FILE, 'utf-8');
const PAGE_SRC = fs.readFileSync(PAGE_FILE, 'utf-8');
const CAMERA_SRC = fs.readFileSync(CAMERA_FILE, 'utf-8');
const REACTION_SRC = fs.readFileSync(REACTION_FILE, 'utf-8');
const AUDIO_SRC = fs.readFileSync(AUDIO_FILE, 'utf-8');

// ─── Tests ─────────────────────────────────────────────────────────

describe('DG-3: Camera collector', () => {
  it('cameraCollector.ts exists', () => {
    expect(fs.existsSync(CAMERA_FILE)).toBe(true);
  });

  it('exports requestCamera, stopCamera, captureSelfieFromVideo', () => {
    expect(CAMERA_SRC).toContain('export async function requestCamera');
    expect(CAMERA_SRC).toContain('export function stopCamera');
    expect(CAMERA_SRC).toContain('export async function captureSelfieFromVideo');
  });

  it('calls getUserMedia via lib/camera startCameraStream', () => {
    expect(CAMERA_SRC).toContain('startCameraStream');
    expect(CAMERA_SRC).toContain('video');
  });

  it('returns safe metadata (captured, quality, width, height)', () => {
    expect(CAMERA_SRC).toContain('captured');
    expect(CAMERA_SRC).toContain('quality');
    expect(CAMERA_SRC).toContain('width');
    expect(CAMERA_SRC).toContain('height');
  });

  it('returns sensitive data separately', () => {
    expect(CAMERA_SRC).toContain('sensitive');
  });

  it('reuses lib/camera.ts (pure technical utility)', () => {
    expect(CAMERA_SRC).toContain('../../lib/camera');
  });
});

describe('DG-3: Reaction collector', () => {
  it('reactionCollector.ts exists', () => {
    expect(fs.existsSync(REACTION_FILE)).toBe(true);
  });

  it('exports evaluateRound, computeReactionResult, getRandomDelayMs', () => {
    expect(REACTION_SRC).toContain('export function evaluateRound');
    expect(REACTION_SRC).toContain('export function computeReactionResult');
    expect(REACTION_SRC).toContain('export function getRandomDelayMs');
  });

  it('detects too_fast (< 100ms)', async () => {
    const { evaluateRound } = await import('../src/demoguard/collectors/reactionCollector');
    const round = evaluateRound(50);
    expect(round.too_fast).toBe(true);
    expect(round.too_slow).toBe(false);
  });

  it('detects too_slow (> 1500ms)', async () => {
    const { evaluateRound } = await import('../src/demoguard/collectors/reactionCollector');
    const round = evaluateRound(2000);
    expect(round.too_slow).toBe(true);
    expect(round.too_fast).toBe(false);
  });

  it('normal reaction has neither too_fast nor too_slow', async () => {
    const { evaluateRound } = await import('../src/demoguard/collectors/reactionCollector');
    const round = evaluateRound(300);
    expect(round.too_fast).toBe(false);
    expect(round.too_slow).toBe(false);
    expect(round.ms).toBe(300);
  });

  it('computeReactionResult calculates average ms from valid rounds', async () => {
    const { computeReactionResult, evaluateRound } = await import('../src/demoguard/collectors/reactionCollector');
    const rounds = [evaluateRound(250), evaluateRound(350)];
    const result = computeReactionResult(rounds);
    expect(result.reaction_ms).toBe(300);
    expect(result.too_fast).toBe(false);
    expect(result.too_slow).toBe(false);
    expect(result.quality).toBe('ok');
  });

  it('computeReactionResult returns missing for empty rounds', async () => {
    const { computeReactionResult } = await import('../src/demoguard/collectors/reactionCollector');
    const result = computeReactionResult([]);
    expect(result.quality).toBe('missing');
  });

  it('getRandomDelayMs returns value in expected range', async () => {
    const { getRandomDelayMs } = await import('../src/demoguard/collectors/reactionCollector');
    const delay = getRandomDelayMs();
    expect(delay).toBeGreaterThanOrEqual(1500);
    expect(delay).toBeLessThan(4000);
  });
});

describe('DG-3: Audio collector', () => {
  it('audioCollector.ts exists', () => {
    expect(fs.existsSync(AUDIO_FILE)).toBe(true);
  });

  it('exports recordVoiceChallenge, generateChallengeId, generateChallengePhrase', () => {
    expect(AUDIO_SRC).toContain('export async function recordVoiceChallenge');
    expect(AUDIO_SRC).toContain('export function generateChallengeId');
    expect(AUDIO_SRC).toContain('export function generateChallengePhrase');
  });

  it('calls getUserMedia with audio', () => {
    expect(AUDIO_SRC).toContain('getUserMedia');
    expect(AUDIO_SRC).toContain('audio: true');
  });

  it('reuses lib/audio.ts for MFCC computation', () => {
    expect(AUDIO_SRC).toContain('../../lib/audio');
    expect(AUDIO_SRC).toContain('computeVocalEmbedding');
  });

  it('generateChallengeId returns dg_voice_ prefixed id', async () => {
    const { generateChallengeId } = await import('../src/demoguard/collectors/audioCollector');
    const id = generateChallengeId();
    expect(id).toMatch(/^dg_voice_/);
  });

  it('generateChallengePhrase contains HCS code', async () => {
    const { generateChallengeId, generateChallengePhrase } = await import('../src/demoguard/collectors/audioCollector');
    const id = generateChallengeId();
    const phrase = generateChallengePhrase(id);
    expect(phrase).toContain('HCS');
    expect(phrase).toContain('validation mobile');
  });

  it('returns safe metadata (recorded, duration_ms, challenge_id, quality, mfcc_available)', () => {
    expect(AUDIO_SRC).toContain('recorded');
    expect(AUDIO_SRC).toContain('duration_ms');
    expect(AUDIO_SRC).toContain('challenge_id');
    expect(AUDIO_SRC).toContain('mfcc_available');
  });

  it('returns sensitive data separately (voice_b64, mfcc_summary)', () => {
    expect(AUDIO_SRC).toContain('sensitive');
    expect(AUDIO_SRC).toContain('mfcc_summary');
  });
});

describe('DG-3: Selfie quality assessor', () => {
  it('selfieQuality.ts exists', () => {
    expect(fs.existsSync(SELFIE_QUALITY_FILE)).toBe(true);
  });

  it('assessSelfieQuality returns missing for null signal', async () => {
    const { assessSelfieQuality } = await import('../src/demoguard/quality/selfieQuality');
    expect(assessSelfieQuality(null)).toBe('missing');
  });

  it('assessSelfieQuality returns missing for uncaptured signal', async () => {
    const { assessSelfieQuality } = await import('../src/demoguard/quality/selfieQuality');
    expect(assessSelfieQuality({ captured: false, quality: 'missing' })).toBe('missing');
  });

  it('assessSelfieQuality returns low for small resolution', async () => {
    const { assessSelfieQuality } = await import('../src/demoguard/quality/selfieQuality');
    expect(assessSelfieQuality({ captured: true, quality: 'ok', width: 200, height: 150 })).toBe('low');
  });

  it('assessSelfieQuality returns ok for good resolution', async () => {
    const { assessSelfieQuality } = await import('../src/demoguard/quality/selfieQuality');
    expect(assessSelfieQuality({ captured: true, quality: 'ok', width: 640, height: 480 })).toBe('ok');
  });
});

describe('DG-3: Audio quality assessor', () => {
  it('audioQuality.ts exists', () => {
    expect(fs.existsSync(AUDIO_QUALITY_FILE)).toBe(true);
  });

  it('assessAudioQuality returns missing for null signal', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality(null)).toBe('missing');
  });

  it('assessAudioQuality returns missing for unrecorded signal', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality({ recorded: false, quality: 'missing' })).toBe('missing');
  });

  it('assessAudioQuality returns low for short duration', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality({ recorded: true, duration_ms: 500, quality: 'ok', mfcc_available: true })).toBe('low');
  });

  it('assessAudioQuality returns low when mfcc not available', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality({ recorded: true, duration_ms: 4000, quality: 'ok', mfcc_available: false })).toBe('low');
  });

  it('assessAudioQuality returns ok for good duration + mfcc', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality({ recorded: true, duration_ms: 4000, quality: 'ok', mfcc_available: true })).toBe('ok');
  });
});

describe('DG-3: Signal completeness increases with signals', () => {
  it('0% with no signals', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const score = computeSignalCompleteness({ selfie: null, reaction: null, voice: null, motion: null, orientation: null, touch: null, visibility: null, network: null });
    expect(score).toBe(0);
  });

  it('~1/14 with selfie only (1/14 with cognitive)', async () => {
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
    expect(score).toBeCloseTo(1 / 14, 5);
  });

  it('~2/14 with selfie + reaction (2/14 with cognitive)', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const score = computeSignalCompleteness({
      selfie: { captured: true, quality: 'ok', width: 640, height: 480 },
      reaction: { reaction_ms: 300, too_fast: false, too_slow: false, quality: 'ok' },
      voice: null,
      motion: null,
      orientation: null,
      touch: null,
      visibility: null,
      network: null,
    });
    expect(score).toBeCloseTo(2 / 14, 5);
  });

  it('100% with all signals + cognitive', async () => {
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
      cognitive: {
        reflex: { rounds: 5, avg_ms: 300, median_ms: 290, variance_ms: 100, min_ms: 200, max_ms: 400, too_fast_count: 0, too_slow_count: 0, regularity_score: 0.5, quality: 'ok' },
        stroop: { trials: 6, conflict_trials: 3, accuracy: 0.83, avg_response_ms: 600, conflict_cost_ms: 80, error_count: 1, quality: 'ok' },
        digit_span: { trials: 3, max_span: 7, accuracy: 0.67, positional_errors: 1, quality: 'ok' },
        n_back: { trials: 8, targets: 2, hits: 2, false_positives: 0, misses: 0, accuracy: 1, avg_response_ms: 500, quality: 'ok' },
        trail_tap: { nodes: 5, completion_ms: 3000, wrong_taps: 0, hesitation_count: 0, path_efficiency: 0.9, quality: 'ok' },
        vocal_ran: { items_count: 5, duration_ms: 3000, challenge_id: 'dg_vran_TEST', expected_hash: 'abc12345', audio_present: true, quality: 'ok' },
        summary: { completed_modules: 6, total_modules: 6, depth_score: 1, consistency_score: 0.9, anomaly_score: 0.1, human_likelihood: 'high', quality: 'ok' },
      },
    });
    expect(score).toBe(1);
  });
});

describe('DG-3: Types include real signal interfaces', () => {
  it('DemoGuardSelfieSignal defined', () => {
    expect(TYPES_SRC).toContain('DemoGuardSelfieSignal');
    expect(TYPES_SRC).toContain('captured');
    expect(TYPES_SRC).toContain('width');
    expect(TYPES_SRC).toContain('height');
  });

  it('DemoGuardReactionSignal defined', () => {
    expect(TYPES_SRC).toContain('DemoGuardReactionSignal');
    expect(TYPES_SRC).toContain('reaction_ms');
    expect(TYPES_SRC).toContain('too_fast');
    expect(TYPES_SRC).toContain('too_slow');
  });

  it('DemoGuardVoiceSignal defined', () => {
    expect(TYPES_SRC).toContain('DemoGuardVoiceSignal');
    expect(TYPES_SRC).toContain('recorded');
    expect(TYPES_SRC).toContain('duration_ms');
    expect(TYPES_SRC).toContain('challenge_id');
    expect(TYPES_SRC).toContain('mfcc_available');
  });

  it('DemoGuardSensitive defined with optional fields', () => {
    expect(TYPES_SRC).toContain('DemoGuardSensitive');
    expect(TYPES_SRC).toContain('selfie_b64?');
    expect(TYPES_SRC).toContain('voice_b64?');
    expect(TYPES_SRC).toContain('mfcc_summary?');
  });

  it('DemoGuardSafeResponse does NOT contain selfie_b64 or voice_b64', () => {
    const safeMatch = TYPES_SRC.match(/DemoGuardSafeResponse[\s\S]*?\}/);
    expect(safeMatch).toBeDefined();
    expect(safeMatch![0]).not.toContain('selfie_b64');
    expect(safeMatch![0]).not.toContain('voice_b64');
    expect(safeMatch![0]).not.toContain('mfcc_summary');
  });
});

describe('DG-3: Page wires real signals', () => {
  it('page imports cameraCollector', () => {
    expect(PAGE_SRC).toContain('cameraCollector');
    expect(PAGE_SRC).toContain('requestCamera');
    expect(PAGE_SRC).toContain('captureSelfieFromVideo');
  });

  it('page imports reactionCollector', () => {
    expect(PAGE_SRC).toContain('reactionCollector');
    expect(PAGE_SRC).toContain('evaluateRound');
    expect(PAGE_SRC).toContain('computeReactionResult');
  });

  it('page imports audioCollector', () => {
    expect(PAGE_SRC).toContain('audioCollector');
    expect(PAGE_SRC).toContain('recordVoiceChallenge');
    expect(PAGE_SRC).toContain('generateChallengePhrase');
  });

  it('page has camera, reaction, voice phases', () => {
    expect(PAGE_SRC).toContain("'camera'");
    expect(PAGE_SRC).toContain("'reaction'");
    expect(PAGE_SRC).toContain("'voice'");
  });

  it('page displays Camera OK/Missing', () => {
    expect(PAGE_SRC).toContain('Camera:');
    expect(PAGE_SRC).toContain('OK');
    expect(PAGE_SRC).toContain('Missing');
  });

  it('page displays Voice OK/Missing', () => {
    expect(PAGE_SRC).toContain('Voice:');
  });

  it('page displays Reaction OK/Missing', () => {
    expect(PAGE_SRC).toContain('Reaction:');
  });

  it('page displays Signal completeness %', () => {
    expect(PAGE_SRC).toContain('Completeness');
  });

  it('page does NOT display selfie_b64', () => {
    expect(PAGE_SRC).not.toContain('selfie_b64');
  });

  it('page does NOT display voice_b64', () => {
    expect(PAGE_SRC).not.toContain('voice_b64');
  });

  it('page does NOT log raw image/audio', () => {
    expect(PAGE_SRC).not.toMatch(/console\.(log|warn|error)/);
  });
});

describe('DG-3: No PII / no API key / no sessionToken', () => {
  const allDgFiles = [
    TYPES_SRC, PAGE_SRC, CAMERA_SRC, REACTION_SRC, AUDIO_SRC,
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

  it('selfie_b64 not in page source', () => {
    expect(PAGE_SRC).not.toContain('selfie_b64');
  });

  it('voice_b64 not in page source', () => {
    expect(PAGE_SRC).not.toContain('voice_b64');
  });
});

describe('DG-3: DemoGuard does not import PayGuard business modules', () => {
  it('page does not import from lib/api (PayGuard API)', () => {
    expect(PAGE_SRC).not.toContain("from '../lib/api'");
  });

  it('page does not import from types/flow', () => {
    expect(PAGE_SRC).not.toContain("from '../types/flow'");
  });

  it('page does not import PayGuard steps', () => {
    expect(PAGE_SRC).not.toContain("from '../steps/");
  });

  it('cameraCollector imports only from lib/camera (pure utility)', () => {
    expect(CAMERA_SRC).toContain('../../lib/camera');
    expect(CAMERA_SRC).not.toContain('../lib/api');
    expect(CAMERA_SRC).not.toContain('../types/flow');
  });

  it('audioCollector imports only from lib/audio (pure utility)', () => {
    expect(AUDIO_SRC).toContain('../../lib/audio');
    expect(AUDIO_SRC).not.toContain('../lib/api');
    expect(AUDIO_SRC).not.toContain('../types/flow');
  });
});
