/**
 * DemoGuard — Audio collector
 *
 * Reuses technical utilities from lib/audio.ts (pure DSP functions, no PayGuard coupling).
 * Records voice, computes MFCC summary, returns safe metadata + sensitive data for proxy.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { recordAudio, computeVocalEmbedding } from '../../lib/audio';
import type { DemoGuardVoiceSignal } from '../types';

export const VOICE_DURATION_MS = 4000;

export type AudioCollectorError =
  | { kind: 'permission-denied' }
  | { kind: 'unavailable' }
  | { kind: 'other'; message: string };

export interface AudioCollectorResult {
  safe: DemoGuardVoiceSignal;
  sensitive: { voice_b64: string; mfcc_summary: number[] } | null;
  error: AudioCollectorError | null;
}

export function generateChallengeId(): string {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `dg_voice_${code}`;
}

export function generateChallengePhrase(challengeId: string): string {
  const code = challengeId.replace('dg_voice_', '');
  return `Code HCS ${code} — validation mobile`;
}

export async function requestMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export async function recordVoiceChallenge(
  durationMs: number = VOICE_DURATION_MS,
  challengeId: string = generateChallengeId(),
): Promise<AudioCollectorResult> {
  try {
    const samples = await recordAudio(durationMs);

    if (samples.length === 0) {
      return {
        safe: { recorded: false, quality: 'missing', challenge_id: challengeId },
        sensitive: null,
        error: { kind: 'other', message: 'No audio samples captured' },
      };
    }

    const mfccSummary = computeVocalEmbedding(samples);
    const mfccAvailable = mfccSummary.some((v) => v !== 0);

    const totalSamples = samples.reduce((s, a) => s + a.length, 0);
    const sampleRate = 16000;
    const durationMsActual = Math.round((totalSamples / sampleRate) * 1000);

    const quality: 'ok' | 'low' = durationMsActual > 2000 ? 'ok' : 'low';

    const voiceB64 = btoa(String.fromCharCode(...new Uint8Array(samples[0].buffer.slice(0, 1024))));

    return {
      safe: {
        recorded: true,
        duration_ms: durationMsActual,
        challenge_id: challengeId,
        quality,
        mfcc_available: mfccAvailable,
      },
      sensitive: {
        voice_b64: voiceB64,
        mfcc_summary: mfccSummary,
      },
      error: null,
    };
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        return {
          safe: { recorded: false, quality: 'missing', challenge_id: challengeId },
          sensitive: null,
          error: { kind: 'permission-denied' },
        };
      }
      return {
        safe: { recorded: false, quality: 'missing', challenge_id: challengeId },
        sensitive: null,
        error: { kind: 'unavailable' },
      };
    }
    return {
      safe: { recorded: false, quality: 'missing', challenge_id: challengeId },
      sensitive: null,
      error: { kind: 'other', message: err instanceof Error ? err.message : 'Audio capture failed' },
    };
  }
}
