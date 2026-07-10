# P10 — Voice Full Audio Pipeline Report

## Summary

Fixed the end-to-end voice verification pipeline across 4 repositories. The critical bug was that `audioCollector.ts` encoded only the first 1024 bytes of raw PCM float data as `voice_b64`, which the HCS backend's WAV decoder (`node-wav`) could not parse — causing every voice analysis to fail with `voice_checked_limited`.

## Root Cause

```
audioCollector.ts:89 (BEFORE)
  const voiceB64 = btoa(String.fromCharCode(...new Uint8Array(samples[0].buffer.slice(0, 1024))));
```

This produced 256 float samples (16ms of audio) in raw IEEE 754 format — not a valid WAV file. The HCS backend's `preprocessAudio()` calls `wav.decode(buffer)` which expects a RIFF/WAVE container, so it threw an error every time.

## Changes by Repository

### 1. PayGuard (mobile collector)

**`src/lib/audio.ts`**
- Added `encodeWav(samples: Float32Array, sampleRate: number): Uint8Array` — 16-bit PCM WAV encoder with proper RIFF/fmt/data chunks

**`src/demoguard/collectors/audioCollector.ts`**
- Replaced `buffer.slice(0, 1024)` with `encodeWav(samples[0], 16000)` — full audio encoded as WAV
- Chunked base64 encoding to avoid call stack overflow on large arrays
- Added diagnostic fields: `recordingSupported`, `recordingStarted`, `recordingStopped`, `mimeType`
- `mimeType` set to `'audio/wav'` on success, `null` on failure

**`src/demoguard/types.ts`**
- Added `recordingSupported`, `recordingStarted`, `recordingStopped`, `mimeType` to `DemoGuardVoiceDiagnostic`

**`src/pages/DemoGuard.tsx`**
- Strengthened submit warnings: explicit ⚠️ messages when voice missing, low quality, or step not completed

**`api/demoguard/verify.ts`**
- Added safe `hasVoiceB64` presence log (never logs the value)

### 2. Hybrid Vector API (relay layer)

**`src/services/hcsVocalRelay.ts`**
- Added `analysisMode`, `audioCaptured`, `livenessStatus`, `featuresExtracted` to `VocalRelayOutput`
- Added `analysisMode`, `audioAccepted`, `analysisCompleted`, `featuresExtracted`, `livenessStatus` to `HcsVocalResponse`
- Maps new fields from HCS response with safe fallbacks
- Added safe console logs: `[HCS-VOCAL-RELAY] audio present:`, `mode:`, `hcs response status:`
- All error return paths include the new fields

**`src/services/demoguardFusionTrigger.ts`**
- `vocalDiagnostic` in fusion output includes `analysisMode`, `audioCaptured`, `livenessStatus`, `featuresExtracted`
- Updated `DemoGuardFusionOutput` interface

**`src/types/demoguard.ts`**
- Updated `DemoGuardHybridFusion.vocalDiagnostic` with new optional fields

### 3. HCS Backend (voice analysis)

**`src/routes/demoguard-voice-analysis.routes.ts`**
- Added `analysisMode`, `audioAccepted`, `analysisCompleted`, `featuresExtracted`, `livenessStatus` to `SafeVoiceResponse`
- All 7 result assignment paths include the new fields:
  - Empty buffer → `metadata_only`, `audioAccepted: false`
  - No segments → `full_audio`, `audioAccepted: true`, `livenessStatus: absent`
  - Quick check failed → `full_audio`, `livenessStatus: absent`
  - Liveness passed → `full_audio`, `livenessStatus: present`
  - Liveness review → `full_audio`, `livenessStatus: review`
  - Catch block → `failed`, `analysisCompleted: false`
  - MFCC-only → `metadata_only`, `audioAccepted: false`
- Log includes all new diagnostic fields
- Added `'audio_missing'` and `'invalid_audio'` to `ReasonSafe` type

### 4. Admin UI (cognitive terminal)

**`lib/cognitive-terminal-utils.ts`**
- Added `livenessStatus` and `featuresExtracted` to `DemoGuardVocalInfo`
- `extractDemoGuardVocalInfo` maps new fields from event payload

**`app/(admin)/cognitive-terminal/page.tsx`**
- Voice Integrity panel displays "Liveness status" with badge styling (present=ok, absent=failed, review=review)
- Displays "Features extracted" as Yes/No

## Data Flow (After Fix)

```
Mobile (PayGuard)
  audioCollector.ts
    ├─ recordAudio(4000ms) → Float32Array @ 16kHz
    ├─ computeVocalEmbedding(samples) → mfcc_summary
    ├─ encodeWav(samples[0], 16000) → Uint8Array (WAV 16-bit PCM)
    ├─ btoa(chunked) → voice_b64
    └─ sensitive: { voice_b64, mfcc_summary }

Proxy (Vercel)
  api/demoguard/verify.ts
    ├─ Receives full payload including sensitive
    ├─ Safe log: hasVoiceB64 (boolean, never value)
    ├─ Forwards to Hybrid Vector API with X-API-Key
    └─ sanitizeResponse() strips voice_b64, mfcc_summary from response

Hybrid Vector API
  routes/demoguard.ts → demoguardFusionTrigger.ts
    ├─ relayDemoGuardVoiceToHcs({ voiceB64, mfccSummary })
    │   ├─ POST to HCS /voice-analysis (body only, never logged)
    │   ├─ Maps: analysisMode, audioCaptured, livenessStatus, featuresExtracted
    │   └─ Returns safe VocalRelayOutput (no voice data)
    └─ vocalDiagnostic in fusion output

HCS Backend
  demoguard-voice-analysis.routes.ts
    ├─ Decodes base64 → Buffer
    ├─ preprocessAudio(buffer) → decodeWav → segments
    ├─ extractVoiceFeatures → quickLivenessCheck → detectLiveness
    └─ Returns SafeVoiceResponse:
        { status, confidence, reasonSafe,
          analysisMode, audioAccepted, analysisCompleted,
          featuresExtracted, livenessStatus }
```

## Security Guarantees (Unchanged)

- `voice_b64` is NEVER logged at any layer
- `mfcc_summary` is NEVER logged at any layer
- `vocal_embedding`, `voiceprint` are NEVER returned
- `FORBIDDEN_KEYS` sanitizer strips all sensitive fields from responses
- Server-to-server only: `X-API-Key` + `X-Worker-Auth` headers
- Safe logs use `sanitizeLogContext()` with forbidden key filtering
- Response contains only: `status`, `confidence`, `reasonSafe`, `analysisMode`, `audioAccepted`, `analysisCompleted`, `featuresExtracted`, `livenessStatus`

## Tests

| Repository | Test File | Tests | Status |
|---|---|---|---|
| PayGuard | `tests/p10-voice-full-audio.test.ts` | 23 | ✅ All pass |
| Hybrid Vector API | `tests/p10-voice-full-audio.test.ts` | 22 | ✅ All pass |
| HCS Backend | `tests/p10-voice-full-audio.test.ts` | 22 | ✅ All pass |
| Admin | `tests/p10-voice-full-audio.test.ts` | 14 | ✅ All pass |

Existing tests (`demoguard-vocal-relay.test.ts`) — 53/53 pass with extended timeout.

## Files Changed

| Repository | File | Change |
|---|---|---|
| payguard | `src/lib/audio.ts` | +39 lines (encodeWav) |
| payguard | `src/demoguard/collectors/audioCollector.ts` | WAV encoding + diagnostics |
| payguard | `src/demoguard/types.ts` | +4 diagnostic fields |
| payguard | `src/pages/DemoGuard.tsx` | Stronger submit warnings |
| payguard | `api/demoguard/verify.ts` | Safe voice_b64 presence log |
| hybrid-vector-api | `src/services/hcsVocalRelay.ts` | New output fields + mapping |
| hybrid-vector-api | `src/services/demoguardFusionTrigger.ts` | vocalDiagnostic mapping |
| hybrid-vector-api | `src/types/demoguard.ts` | Type updates |
| hcs-u7-backend | `src/routes/demoguard-voice-analysis.routes.ts` | Safe response fields |
| hcs-u7-admin | `lib/cognitive-terminal-utils.ts` | Type + extractor updates |
| hcs-u7-admin | `app/(admin)/cognitive-terminal/page.tsx` | UI display rows |

---
Copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
Patents Pending FR2514274 | FR2514546
