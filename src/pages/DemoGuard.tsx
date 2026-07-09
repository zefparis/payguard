/**
 * DemoGuard Mobile — Page component
 *
 * UI flow:
 * 1. Enter hcs_session_public_id
 * 2. Start DemoGuard check (device + permissions)
 * 3. Camera capture (selfie)
 * 4. Reaction test
 * 5. Voice challenge
 * 6. Signal completeness
 * 7. Submit DemoGuard
 * 8. Display safe response
 *
 * Feature-gated by VITE_DEMOGUARD_ENABLED.
 * No PII, no API keys.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { Button } from '../ui/Button';
import { collectDeviceContext } from '../demoguard/collectors/deviceCollector';
import { collectPermissions } from '../demoguard/collectors/permissionCollector';
import { computeQuality } from '../demoguard/quality/signalCompleteness';
import { submitDemoGuard, DemoGuardApiError } from '../demoguard/api';
import { DEMOGUARD_VERSION, DEMOGUARD_SOURCE } from '../demoguard/constants';
import { requestCamera, stopCamera, captureSelfieFromVideo } from '../demoguard/collectors/cameraCollector';
import { evaluateRound, computeReactionResult, getRandomDelayMs, REACTION_ROUNDS } from '../demoguard/collectors/reactionCollector';
import { recordVoiceChallenge, generateChallengeId, generateChallengePhrase } from '../demoguard/collectors/audioCollector';
import { collectMotion, requestMotionPermission } from '../demoguard/collectors/motionCollector';
import { collectOrientation, requestOrientationPermission } from '../demoguard/collectors/orientationCollector';
import { collectTouch } from '../demoguard/collectors/touchCollector';
import { collectVisibility } from '../demoguard/collectors/visibilityCollector';
import { collectNetwork } from '../demoguard/collectors/networkCollector';
import type { ReactionRound } from '../demoguard/collectors/reactionCollector';
import type {
  DemoGuardDeviceContext,
  DemoGuardPermissions,
  DemoGuardSignals,
  DemoGuardSelfieSignal,
  DemoGuardReactionSignal,
  DemoGuardVoiceSignal,
  DemoGuardMotionSignal,
  DemoGuardOrientationSignal,
  DemoGuardTouchSignal,
  DemoGuardVisibilitySignal,
  DemoGuardNetworkSignal,
  DemoGuardQuality,
  DemoGuardSafeResponse,
  DemoGuardSensitive,
} from '../demoguard/types';

type Phase = 'idle' | 'device' | 'permissions' | 'camera' | 'reaction' | 'voice' | 'device-signals' | 'readiness' | 'submitting' | 'done' | 'error';

type ReactionPhase = 'ready' | 'wait' | 'go' | 'too_early' | 'done';

export function DemoGuard() {
  const navigate = useNavigate();
  const [sessionPublicId, setSessionPublicId] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [device, setDevice] = useState<DemoGuardDeviceContext | null>(null);
  const [permissions, setPermissions] = useState<DemoGuardPermissions | null>(null);
  const [selfieSignal, setSelfieSignal] = useState<DemoGuardSelfieSignal | null>(null);
  const [reactionSignal, setReactionSignal] = useState<DemoGuardReactionSignal | null>(null);
  const [voiceSignal, setVoiceSignal] = useState<DemoGuardVoiceSignal | null>(null);
  const [motionSignal, setMotionSignal] = useState<DemoGuardMotionSignal | null>(null);
  const [orientationSignal, setOrientationSignal] = useState<DemoGuardOrientationSignal | null>(null);
  const [touchSignal, setTouchSignal] = useState<DemoGuardTouchSignal | null>(null);
  const [visibilitySignal, setVisibilitySignal] = useState<DemoGuardVisibilitySignal | null>(null);
  const [networkSignal, setNetworkSignal] = useState<DemoGuardNetworkSignal | null>(null);
  const [quality, setQuality] = useState<DemoGuardQuality | null>(null);
  const [response, setResponse] = useState<DemoGuardSafeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensitiveRef = useRef<DemoGuardSensitive>({});

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Reaction state
  const [reactionPhase, setReactionPhase] = useState<ReactionPhase>('ready');
  const [reactionRound, setReactionRound] = useState(0);
  const [reactionResults, setReactionResults] = useState<ReactionRound[]>([]);
  const [lastReactionMs, setLastReactionMs] = useState<number | null>(null);
  const goAtRef = useRef<number>(0);
  const reactionTimerRef = useRef<number | null>(null);

  // Voice state
  const [voiceChallengeId] = useState(() => generateChallengeId());
  const [voiceRecording, setVoiceRecording] = useState(false);

  // ── Device + permissions ──
  const handleStart = useCallback(async () => {
    setError(null);
    setResponse(null);
    setSelfieSignal(null);
    setReactionSignal(null);
    setVoiceSignal(null);
    setMotionSignal(null);
    setOrientationSignal(null);
    setTouchSignal(null);
    setVisibilitySignal(null);
    setNetworkSignal(null);
    setQuality(null);
    sensitiveRef.current = {};
    try {
      setPhase('device');
      const dev = collectDeviceContext();
      setDevice(dev);

      setPhase('permissions');
      const perms = await collectPermissions();
      setPermissions(perms);

      setPhase('camera');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Collection failed');
    }
  }, []);

  // ── Camera ──
  useEffect(() => {
    if (phase !== 'camera') return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await requestCamera();
        if (cancelled) { stopCamera(stream); return; }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        setSelfieSignal({ captured: false, quality: 'missing' });
        setPhase('reaction');
      }
    })();
    return () => { cancelled = true; };
  }, [phase]);

  const handleCaptureSelfie = useCallback(async () => {
    if (!videoRef.current || !cameraReady) return;
    const result = await captureSelfieFromVideo(videoRef.current, cameraStreamRef.current);
    setSelfieSignal(result.safe);
    if (result.sensitive) {
      Object.assign(sensitiveRef.current, result.sensitive);
    }
    stopCamera(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraReady(false);
    setPhase('reaction');
    setReactionPhase('ready');
    setReactionRound(0);
    setReactionResults([]);
  }, [cameraReady]);

  const handleSkipCamera = useCallback(() => {
    stopCamera(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraReady(false);
    setSelfieSignal({ captured: false, quality: 'missing' });
    setPhase('reaction');
    setReactionPhase('ready');
    setReactionRound(0);
    setReactionResults([]);
  }, []);

  // ── Reaction ──
  useEffect(() => {
    if (phase !== 'reaction' || reactionPhase !== 'wait') return;
    const delay = getRandomDelayMs();
    reactionTimerRef.current = window.setTimeout(() => {
      goAtRef.current = performance.now();
      setReactionPhase('go');
    }, delay);
    return () => { if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current); };
  }, [phase, reactionPhase]);

  useEffect(() => {
    if (reactionPhase !== 'too_early') return;
    const t = window.setTimeout(() => setReactionPhase('ready'), 1200);
    return () => window.clearTimeout(t);
  }, [reactionPhase]);

  const handleReactionTap = useCallback(() => {
    if (phase !== 'reaction') return;
    if (reactionPhase === 'ready') {
      setLastReactionMs(null);
      setReactionPhase('wait');
      return;
    }
    if (reactionPhase === 'wait') {
      if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
      setReactionPhase('too_early');
      return;
    }
    if (reactionPhase === 'go') {
      const ms = performance.now() - goAtRef.current;
      const round = evaluateRound(ms);
      setLastReactionMs(round.ms);
      const next = [...reactionResults, round];
      setReactionResults(next);
      if (next.length >= REACTION_ROUNDS) {
        const result = computeReactionResult(next);
        setReactionSignal(result);
        setReactionPhase('done');
        setPhase('voice');
      } else {
        setReactionRound((r) => r + 1);
        setReactionPhase('ready');
      }
    }
  }, [phase, reactionPhase, reactionResults]);

  // ── Voice ──
  const handleRecordVoice = useCallback(async () => {
    setVoiceRecording(true);
    setError(null);
    try {
      const result = await recordVoiceChallenge(4000, voiceChallengeId);
      setVoiceSignal(result.safe);
      if (result.sensitive) {
        Object.assign(sensitiveRef.current, result.sensitive);
      }
    } catch (err) {
      setVoiceSignal({ recorded: false, quality: 'missing', challenge_id: voiceChallengeId });
      setError(err instanceof Error ? err.message : 'Voice recording failed');
    } finally {
      setVoiceRecording(false);
      setPhase('device-signals');
    }
  }, [voiceChallengeId]);

  const handleSkipVoice = useCallback(() => {
    setVoiceSignal({ recorded: false, quality: 'missing', challenge_id: voiceChallengeId });
    setPhase('device-signals');
  }, [voiceChallengeId]);

  // ── Device signals collection ──
  useEffect(() => {
    if (phase !== 'device-signals') return;
    let cancelled = false;
    (async () => {
      try {
        // Request iOS permissions if needed
        if (permissions?.motion === 'prompt') {
          await requestMotionPermission();
        }
        if (permissions?.orientation === 'prompt') {
          await requestOrientationPermission();
        }

        // Collect all device signals in parallel
        const [motion, orientation, touch, visibility, network] = await Promise.all([
          collectMotion(3000),
          collectOrientation(3000),
          collectTouch(3000),
          collectVisibility(3000),
          Promise.resolve(collectNetwork()),
        ]);

        if (cancelled) return;

        setMotionSignal(motion);
        setOrientationSignal(orientation);
        setTouchSignal(touch);
        setVisibilitySignal(visibility);
        setNetworkSignal(network);
        setPhase('readiness');
      } catch {
        if (cancelled) return;
        setPhase('readiness');
      }
    })();
    return () => { cancelled = true; };
  }, [phase, permissions]);

  // ── Readiness ──
  useEffect(() => {
    if (phase !== 'readiness' || !device || !permissions) return;
    const signals: DemoGuardSignals = {
      selfie: selfieSignal,
      reaction: reactionSignal,
      voice: voiceSignal,
      motion: motionSignal,
      orientation: orientationSignal,
      touch: touchSignal,
      visibility: visibilitySignal,
      network: networkSignal,
    };
    const q = computeQuality(signals, device, permissions);
    setQuality(q);
  }, [phase, device, permissions, selfieSignal, reactionSignal, voiceSignal, motionSignal, orientationSignal, touchSignal, visibilitySignal, networkSignal]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!sessionPublicId.trim()) {
      setError('hcs_session_public_id is required');
      return;
    }
    if (!device || !permissions) {
      setError('Run device check first');
      return;
    }

    setPhase('submitting');
    setError(null);

    const signals: DemoGuardSignals = {
      selfie: selfieSignal,
      reaction: reactionSignal,
      voice: voiceSignal,
      motion: motionSignal,
      orientation: orientationSignal,
      touch: touchSignal,
      visibility: visibilitySignal,
      network: networkSignal,
    };
    const q = quality ?? computeQuality(signals, device, permissions);

    const started_at = new Date().toISOString();
    try {
      const res = await submitDemoGuard({
        hcs_session_public_id: sessionPublicId.trim(),
        source: DEMOGUARD_SOURCE,
        demo_guard: {
          version: DEMOGUARD_VERSION,
          started_at,
          completed_at: new Date().toISOString(),
          device,
          permissions,
          signals,
          quality: q,
        },
        sensitive: Object.keys(sensitiveRef.current).length > 0 ? sensitiveRef.current : undefined,
      });
      setResponse(res);
      setPhase('done');
    } catch (err) {
      setPhase('error');
      if (err instanceof DemoGuardApiError) {
        setError(`[${err.code}] ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Submit failed');
      }
    }
  }, [sessionPublicId, device, permissions, quality, selfieSignal, reactionSignal, voiceSignal, motionSignal, orientationSignal, touchSignal, visibilitySignal, networkSignal]);

  // ── Cleanup camera on unmount ──
  useEffect(() => {
    return () => { stopCamera(cameraStreamRef.current); };
  }, []);

  const completeness = quality ? quality.signal_completeness : 0;

  const reactionBg =
    reactionPhase === 'go' ? '#34c759' :
    reactionPhase === 'wait' ? '#b91c1c' :
    reactionPhase === 'too_early' ? '#ff9f0a' :
    '#2563eb';

  const reactionLabel =
    reactionPhase === 'ready' ? 'DÉMARRER' :
    reactionPhase === 'wait' ? 'ATTENDEZ' :
    reactionPhase === 'go' ? 'APPUYEZ' :
    reactionPhase === 'too_early' ? 'TROP TÔT' :
    'Terminé';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 32, gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>DemoGuard Mobile</h1>
        <button
          type="button"
          onClick={() => navigate(ROUTES.HOME)}
          style={{ background: 'none', border: 'none', color: 'var(--secondary-label)', fontSize: 15, cursor: 'pointer' }}
        >
          ← Back
        </button>
      </div>

      <p style={{ color: 'var(--secondary-label)', fontSize: 14 }}>
        Collecteur mobile pour démo HCS-U7 / Hybrid Vector. v{DEMOGUARD_VERSION}
      </p>

      {/* Step 1: Session ID input */}
      <div>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          HCS Session Public ID
        </label>
        <input
          type="text"
          value={sessionPublicId}
          onChange={(e) => setSessionPublicId(e.target.value)}
          placeholder="hcs_sess_..."
          style={{
            width: '100%', height: 44, borderRadius: 10, fontSize: 16,
            border: '1px solid var(--separator)', padding: '0 12px',
            background: 'var(--background)', color: 'var(--label)',
          }}
        />
      </div>

      {/* Step 2: Start check */}
      {phase === 'idle' && (
        <Button onClick={handleStart}>Start DemoGuard check</Button>
      )}

      {/* Device check result */}
      {device && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Device Check</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Platform: {device.platform}</span>
            <span>Screen: {device.screenWidth}×{device.screenHeight}</span>
            <span>Online: {device.online ? '✅' : '❌'}</span>
            <span>Timezone: {device.timezone ?? 'unknown'}</span>
          </div>
        </div>
      )}

      {/* Permissions result */}
      {permissions && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Permissions</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Camera: {permissions.camera}</span>
            <span>Microphone: {permissions.microphone}</span>
          </div>
        </div>
      )}

      {/* Step 3: Camera capture */}
      {phase === 'camera' && (
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Camera — Selfie Capture</h3>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', maxWidth: 320, borderRadius: 16, marginBottom: 16, background: '#000' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleCaptureSelfie} disabled={!cameraReady}>Capture</Button>
            <Button onClick={handleSkipCamera} variant="secondary">Skip</Button>
          </div>
        </div>
      )}

      {/* Camera result */}
      {selfieSignal && phase !== 'camera' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Camera: {selfieSignal.captured ? '✅ OK' : '❌ Missing'}</h3>
          {selfieSignal.captured && (
            <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
              <span>Quality: {selfieSignal.quality}</span>
              {selfieSignal.width && <span> | {selfieSignal.width}×{selfieSignal.height}</span>}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Reaction test */}
      {phase === 'reaction' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Reaction Test</h3>
          <p style={{ color: 'var(--secondary-label)', fontSize: 14, marginBottom: 8 }}>
            Tour {reactionRound + 1} sur {REACTION_ROUNDS}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            {Array.from({ length: REACTION_ROUNDS }).map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: 5,
                background: i < reactionResults.length ? 'var(--green)' : i === reactionRound ? 'var(--blue)' : 'var(--separator)',
              }} />
            ))}
          </div>
          <button
            onClick={handleReactionTap}
            style={{
              width: '100%', height: 200, borderRadius: 20, border: 'none',
              background: reactionBg, color: '#ffffff', fontSize: 28, fontWeight: 800,
              cursor: 'pointer', touchAction: 'manipulation',
            }}
          >
            {reactionLabel}
          </button>
          {lastReactionMs !== null && reactionPhase === 'ready' && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--green)' }}>
              Dernier : {lastReactionMs} ms
            </p>
          )}
        </div>
      )}

      {/* Reaction result */}
      {reactionSignal && phase !== 'reaction' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Reaction: {reactionSignal.quality === 'ok' ? '✅ OK' : reactionSignal.quality === 'low' ? '⚠️ Low' : '❌ Missing'}</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {reactionSignal.reaction_ms != null && <span>Avg: {reactionSignal.reaction_ms} ms</span>}
            <span>Too fast: {reactionSignal.too_fast ? '⚠️' : '✅'}</span>
            <span>Too slow: {reactionSignal.too_slow ? '⚠️' : '✅'}</span>
          </div>
        </div>
      )}

      {/* Step 5: Voice challenge */}
      {phase === 'voice' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Voice Challenge</h3>
          <p style={{ color: 'var(--secondary-label)', fontSize: 14, marginBottom: 16 }}>
            Lisez cette phrase à voix haute :
          </p>
          <p style={{ fontWeight: 600, marginBottom: 16 }}>
            "{generateChallengePhrase(voiceChallengeId)}"
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleRecordVoice} disabled={voiceRecording}>
              {voiceRecording ? 'Recording...' : 'Record'}
            </Button>
            <Button onClick={handleSkipVoice} variant="secondary" disabled={voiceRecording}>Skip</Button>
          </div>
        </div>
      )}

      {/* Voice result */}
      {voiceSignal && phase !== 'voice' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Voice: {voiceSignal.recorded ? '✅ OK' : '❌ Missing'}</h3>
          {voiceSignal.recorded && (
            <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Duration: {voiceSignal.duration_ms} ms</span>
              <span>MFCC: {voiceSignal.mfcc_available ? '✅' : '❌'}</span>
              <span>Challenge: {voiceSignal.challenge_id}</span>
            </div>
          )}
        </div>
      )}

      {/* Device signals loading */}
      {phase === 'device-signals' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ color: 'var(--secondary-label)', fontSize: 14 }}>
            Collecting device signals...
          </p>
        </div>
      )}

      {/* Motion result */}
      {motionSignal && phase !== 'device-signals' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            Motion: {motionSignal.quality === 'ok' ? '✅ OK' : motionSignal.quality === 'unsupported' ? '⚠️ Unsupported' : motionSignal.quality === 'low' ? '⚠️ Low' : '❌ Missing'}
          </h3>
          {motionSignal.supported && (
            <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
              <span>Samples: {motionSignal.sample_count}</span>
            </div>
          )}
        </div>
      )}

      {/* Orientation result */}
      {orientationSignal && phase !== 'device-signals' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            Orientation: {orientationSignal.quality === 'ok' ? '✅ OK' : orientationSignal.quality === 'unsupported' ? '⚠️ Unsupported' : orientationSignal.quality === 'low' ? '⚠️ Low' : '❌ Missing'}
          </h3>
          {orientationSignal.supported && (
            <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
              <span>Changes: {orientationSignal.changes}</span>
            </div>
          )}
        </div>
      )}

      {/* Touch result */}
      {touchSignal && phase !== 'device-signals' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            Touch: {touchSignal.quality === 'ok' ? '✅ OK' : '❌ Missing'}
          </h3>
          {touchSignal.touch_count > 0 && (
            <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
              <span>Touches: {touchSignal.touch_count}</span>
              {touchSignal.multi_touch_detected && <span> | Multi: ✅</span>}
            </div>
          )}
        </div>
      )}

      {/* Visibility result */}
      {visibilitySignal && phase !== 'device-signals' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            Focus: {visibilitySignal.quality === 'ok' ? '✅ OK' : '⚠️ Warning'}
          </h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
            <span>Blur: {visibilitySignal.blur_count}</span>
            <span> | Hidden: {visibilitySignal.visibility_hidden_count}</span>
          </div>
        </div>
      )}

      {/* Network result */}
      {networkSignal && phase !== 'device-signals' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            Network: {networkSignal.quality === 'ok' ? '✅ OK' : networkSignal.quality === 'unsupported' ? '⚠️ Unsupported' : '❌ Missing'}
          </h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
            <span>Online: {networkSignal.online ? '✅' : '❌'}</span>
            {networkSignal.effective_type && <span> | {networkSignal.effective_type}</span>}
          </div>
        </div>
      )}

      {/* Step 6: Signal readiness */}
      {quality && (phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error') && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Signal Readiness</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Completeness: {(completeness * 100).toFixed(0)}%</span>
            <span>Device ready: {quality.device_ready ? '✅' : '❌'}</span>
            <span>Permissions ready: {quality.permissions_ready ? '✅' : '❌'}</span>
            <span>Overall ready: {quality.overall_ready ? '✅' : '❌'}</span>
          </div>
        </div>
      )}

      {/* Step 7: Submit */}
      {quality && phase === 'readiness' && (
        <Button
          onClick={handleSubmit}
          disabled={!sessionPublicId.trim()}
          variant="secondary"
        >
          Submit DemoGuard
        </Button>
      )}

      {/* Step 8: Safe response */}
      {response && (
        <div style={{ borderRadius: 10, border: '1px solid var(--green)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Response</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Received: {response.received ? '✅' : '❌'}</span>
            {response.quality_score != null && <span>Quality score: {(response.quality_score * 100).toFixed(0)}%</span>}
            <span>Ready: {response.ready ? '✅' : '❌'}</span>
            {response.message && <span>Message: {response.message}</span>}
            {response.hybridFusion && (
              <span>Fusion: {response.hybridFusion.triggered ? '✅' : '❌'}{response.hybridFusion.globalDecision ? ` | ${response.hybridFusion.globalDecision}` : ''}</span>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{ borderRadius: 10, border: '1px solid var(--red)', padding: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--red)' }}>{error}</p>
        </div>
      )}
    </div>
  );
}
