/**
 * P10-VOICE-FULL-AUDIO — Audio collector & pipeline tests
 *
 * Verifies:
 * - audioCollector encodes full WAV (not 1024 bytes raw PCM)
 * - encodeWav produces valid WAV header
 * - voice_b64 is base64-encoded WAV with RIFF header
 * - diagnostic fields include recordingSupported, recordingStarted, recordingStopped, mimeType
 * - sensitive payload contains voice_b64 and mfcc_summary
 * - no raw audio or voice_b64 in safe signal
 * - submit warnings include voice missing message
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const AUDIO_LIB = path.join(process.cwd(), 'src', 'lib', 'audio.ts');
const COLLECTOR = path.join(process.cwd(), 'src', 'demoguard', 'collectors', 'audioCollector.ts');
const TYPES = path.join(process.cwd(), 'src', 'demoguard', 'types.ts');
const DEMOGUARD_PAGE = path.join(process.cwd(), 'src', 'pages', 'DemoGuard.tsx');

const audioSrc = fs.readFileSync(AUDIO_LIB, 'utf8');
const collectorSrc = fs.readFileSync(COLLECTOR, 'utf8');
const typesSrc = fs.readFileSync(TYPES, 'utf8');
const pageSrc = fs.readFileSync(DEMOGUARD_PAGE, 'utf8');

describe('P10-VOICE-FULL-AUDIO — Audio encoding', () => {
  it('audio.ts exports encodeWav', () => {
    expect(audioSrc).toContain('export function encodeWav');
  });

  it('encodeWav writes RIFF header', () => {
    expect(audioSrc).toContain('0x52494646');
    expect(audioSrc).toContain('0x57415645');
  });

  it('encodeWav writes 16-bit PCM format', () => {
    expect(audioSrc).toContain('bitsPerSample = 16');
    expect(audioSrc).toContain('setInt16');
  });

  it('encodeWav writes fmt and data chunks', () => {
    expect(audioSrc).toContain('0x666d7420');
    expect(audioSrc).toContain('0x64617461');
  });
});

describe('P10-VOICE-FULL-AUDIO — Audio collector', () => {
  it('imports encodeWav from audio lib', () => {
    expect(collectorSrc).toContain('encodeWav');
  });

  it('does not use buffer.slice(0, 1024) for voice_b64', () => {
    expect(collectorSrc).not.toContain('buffer.slice(0, 1024)');
  });

  it('encodes full audio as WAV via encodeWav', () => {
    expect(collectorSrc).toContain('encodeWav(samples[0]');
  });

  it('encodes base64 in chunks to avoid stack overflow', () => {
    expect(collectorSrc).toContain('CHUNK');
    expect(collectorSrc).toContain('subarray');
  });

  it('safe signal does not contain voice_b64', () => {
    const safeMatch = collectorSrc.match(/safe:\s*\{[^}]*\}/);
    expect(safeMatch).toBeTruthy();
    expect(safeMatch![0]).not.toContain('voice_b64');
  });

  it('sensitive payload contains voice_b64 and mfcc_summary', () => {
    expect(collectorSrc).toContain('voice_b64: voiceB64');
    expect(collectorSrc).toContain('mfcc_summary: mfccSummary');
  });
});

describe('P10-VOICE-FULL-AUDIO — Diagnostic fields', () => {
  it('DemoGuardVoiceDiagnostic includes recordingSupported', () => {
    expect(typesSrc).toContain('recordingSupported: boolean');
  });

  it('DemoGuardVoiceDiagnostic includes recordingStarted', () => {
    expect(typesSrc).toContain('recordingStarted: boolean');
  });

  it('DemoGuardVoiceDiagnostic includes recordingStopped', () => {
    expect(typesSrc).toContain('recordingStopped: boolean');
  });

  it('DemoGuardVoiceDiagnostic includes mimeType', () => {
    expect(typesSrc).toContain('mimeType: string | null');
  });

  it('collector sets recordingSupported in success path', () => {
    expect(collectorSrc).toContain('recordingSupported: true');
  });

  it('collector sets mimeType to audio/wav in success path', () => {
    expect(collectorSrc).toContain("mimeType: 'audio/wav'");
  });

  it('collector sets recordingSupported false in permission-denied path', () => {
    expect(collectorSrc).toContain('recordingSupported: false');
  });
});

describe('P10-VOICE-FULL-AUDIO — Submit warnings', () => {
  it('DemoGuard page warns when voice sample missing', () => {
    expect(pageSrc).toContain('Voice sample missing');
    expect(pageSrc).toContain('vocal liveness analysis will be skipped');
  });

  it('DemoGuard page warns when voice step not completed', () => {
    expect(pageSrc).toContain('Voice capture step not completed');
  });

  it('DemoGuard page warns on low quality voice', () => {
    expect(pageSrc).toContain('Voice sample quality is low');
  });
});

describe('P10-VOICE-FULL-AUDIO — Proxy forwarding', () => {
  const PROXY = path.join(process.cwd(), 'api', 'demoguard', 'verify.ts');
  const proxySrc = fs.readFileSync(PROXY, 'utf8');

  it('proxy logs voice_b64 presence without value', () => {
    expect(proxySrc).toContain('hasVoiceB64');
    expect(proxySrc).toContain('demoguard_proxy_request');
  });

  it('proxy does not strip sensitive from body before forwarding', () => {
    expect(proxySrc).toContain('JSON.stringify(body)');
  });

  it('proxy forwards full body to upstream', () => {
    expect(proxySrc).toContain("getUpstreamUrl()");
    expect(proxySrc).toContain('X-API-Key');
  });
});
