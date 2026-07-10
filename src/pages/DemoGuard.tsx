/**
 * DemoGuard Mobile — Page component
 *
 * UI flow:
 * 1. Enter hcs_session_public_id
 * 2. Start DemoGuard check (device + permissions)
 * 3. Camera capture (selfie)
 * 4. Reaction test (reflex multi-round)
 * 5. Voice challenge
 * 6. Cognitive battery (Stroop, Digit Span, N-Back, Trail Tap, Vocal RAN)
 * 7. Signal completeness + Cognitive proof summary
 * 8. Submit DemoGuard
 * 9. Display safe response
 *
 * Feature-gated by VITE_DEMOGUARD_ENABLED.
 * No PII, no API keys.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './demoguard-premium.css';
import { ROUTES } from '../constants/routes';
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
  DemoGuardVoiceDiagnostic,
  DemoGuardMotionSignal,
  DemoGuardOrientationSignal,
  DemoGuardTouchSignal,
  DemoGuardVisibilitySignal,
  DemoGuardNetworkSignal,
  DemoGuardQuality,
  DemoGuardSafeResponse,
  DemoGuardSensitive,
  VoiceDiagnosticsSafe,
  TouchDiagnosticsSafe,
} from '../demoguard/types';
import type {
  CognitiveSignals,
  ReflexSignal,
  StroopSignal,
  DigitSpanSignal,
  NBackSignal,
  TrailTapSignal,
  VocalRanSignal,
  CognitiveSummary,
} from '../demoguard/cognitive/cognitiveTypes';
import {
  REFLEX_ROUNDS as COG_REFLEX_ROUNDS,
  evaluateReflexRound,
  computeReflexResult,
  getRandomReflexDelay,
  type ReflexRoundResult,
} from '../demoguard/cognitive/reflexChallenge';
import {
  generateStroopTrials,
  computeStroopResult,
  STROOP_COLORS,
  type StroopColor,
  type StroopTrialConfig,
  type StroopTrialResult,
} from '../demoguard/cognitive/stroopChallenge';
import {
  generateDigitSpanTrials,
  evaluateDigitSpanTrial,
  computeDigitSpanResult,
  type DigitSpanTrialConfig,
  type DigitSpanTrialResult,
} from '../demoguard/cognitive/digitSpanChallenge';
import {
  generateNBackTrials,
  evaluateNBackTrial,
  computeNBackResult,
  type NBackTrialConfig,
  type NBackTrialResult,
} from '../demoguard/cognitive/nBackChallenge';
import {
  generateTrailTapNodes,
  computeTrailTapResult,
  type TrailTapNode,
  type TrailTapEvent,
} from '../demoguard/cognitive/trailTapChallenge';
import {
  generateVocalRanChallenge,
  computeVocalRanResult,
  type VocalRanChallenge,
} from '../demoguard/cognitive/vocalRanChallenge';
import { computeCognitiveSummary } from '../demoguard/cognitive/cognitiveScoring';

const VOICE_KEY = 'voice_b64' as const;

function buildVoiceDiagnosticsSafe(
  voiceSignal: DemoGuardVoiceSignal | null,
  voiceDiagnostic: DemoGuardVoiceDiagnostic | null,
  hasVoiceB64: boolean,
): VoiceDiagnosticsSafe {
  if (voiceDiagnostic) {
    return {
      status: voiceDiagnostic.vocalStatus,
      reasonSafe: voiceDiagnostic.reasonSafe,
      analysisMode: voiceDiagnostic.analysisMode,
      audioCaptured: voiceDiagnostic.audioCaptured,
      payloadPrepared: voiceDiagnostic.payloadPrepared || hasVoiceB64,
      relayAttempted: voiceDiagnostic.relayAttempted,
      relayAccepted: voiceDiagnostic.relayAccepted,
      hcsAnalyzed: voiceDiagnostic.analyzed,
      featuresExtracted: false,
      livenessStatus: voiceDiagnostic.vocalStatus === 'passed' ? 'present' : voiceDiagnostic.vocalStatus === 'failed' ? 'absent' : 'unknown',
      confidence: null,
      latencyMs: voiceDiagnostic.latencyMs,
    };
  }
  if (voiceSignal && voiceSignal.recorded) {
    return {
      status: 'not_checked',
      reasonSafe: 'not_attempted',
      analysisMode: 'skipped',
      audioCaptured: true,
      payloadPrepared: hasVoiceB64,
      relayAttempted: false,
      relayAccepted: false,
      hcsAnalyzed: false,
      featuresExtracted: false,
      livenessStatus: 'unknown',
      confidence: null,
      latencyMs: null,
    };
  }
  return {
    status: 'not_checked',
    reasonSafe: 'voice_missing',
    analysisMode: 'skipped',
    audioCaptured: false,
    payloadPrepared: false,
    relayAttempted: false,
    relayAccepted: false,
    hcsAnalyzed: false,
    featuresExtracted: false,
    livenessStatus: 'unknown',
    confidence: null,
    latencyMs: null,
  };
}

function buildTouchDiagnosticsSafe(
  touchSignal: DemoGuardTouchSignal | null,
): TouchDiagnosticsSafe {
  if (!touchSignal) {
    return {
      status: 'missing',
      supported: false,
      interactionCount: 0,
      quality: 'missing',
      reasonSafe: 'touch_not_collected',
    };
  }
  const interactionCount = touchSignal.touch_count;
  const quality = touchSignal.quality;
  const supported = interactionCount > 0 || quality !== 'unsupported';
  return {
    status: quality === 'ok' ? 'ok' : quality === 'missing' ? 'missing' : quality === 'unsupported' ? 'unsupported' : 'review',
    supported,
    interactionCount,
    quality: quality as 'ok' | 'review' | 'missing' | 'unsupported',
    reasonSafe: interactionCount > 0 ? 'touch_captured' : 'touch_missing',
  };
}

type Phase = 'idle' | 'device' | 'permissions' | 'camera' | 'reaction' | 'voice' | 'cognitive-intro' | 'cognitive-stroop' | 'cognitive-digit-span' | 'cognitive-nback' | 'cognitive-trail-tap' | 'cognitive-vocal-ran' | 'cognitive-summary' | 'device-signals' | 'readiness' | 'submitting' | 'done' | 'error';

type ReactionPhase = 'ready' | 'wait' | 'go' | 'too_early' | 'done';

export function DemoGuard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sessionPublicId, setSessionPublicId] = useState('');

  // Pre-fill sessionPublicId from URL query param (?sessionPublicId=hcs_sess_...)
  // Does NOT auto-submit — user must still click "Start DemoGuard Check"
  useEffect(() => {
    const querySession = searchParams.get('sessionPublicId');
    if (querySession && /^hcs_sess_[A-Za-z0-9_-]+$/.test(querySession)) {
      setSessionPublicId(querySession);
    }
  }, [searchParams]);
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
  const [voiceDiagnostic, setVoiceDiagnostic] = useState<DemoGuardVoiceDiagnostic | null>(null);

  // ── Cognitive battery state ──
  const [cogReflexSignal, setCogReflexSignal] = useState<ReflexSignal | null>(null);
  const [cogStroopSignal, setCogStroopSignal] = useState<StroopSignal | null>(null);
  const [cogDigitSpanSignal, setCogDigitSpanSignal] = useState<DigitSpanSignal | null>(null);
  const [cogNBackSignal, setCogNBackSignal] = useState<NBackSignal | null>(null);
  const [cogTrailTapSignal, setCogTrailTapSignal] = useState<TrailTapSignal | null>(null);
  const [cogVocalRanSignal, setCogVocalRanSignal] = useState<VocalRanSignal | null>(null);
  const [cogSummary, setCogSummary] = useState<CognitiveSummary | null>(null);

  // Cognitive reflex state
  const [cogReflexPhase, setCogReflexPhase] = useState<ReactionPhase>('ready');
  const [cogReflexRound, setCogReflexRound] = useState(0);
  const [cogReflexResults, setCogReflexResults] = useState<ReflexRoundResult[]>([]);
  const [cogLastReflexMs, setCogLastReflexMs] = useState<number | null>(null);
  const cogGoAtRef = useRef<number>(0);
  const cogReflexTimerRef = useRef<number | null>(null);

  // Cognitive Stroop state
  const [stroopTrials, setStroopTrials] = useState<StroopTrialConfig[]>([]);
  const [stroopIndex, setStroopIndex] = useState(0);
  const [stroopResults, setStroopResults] = useState<StroopTrialResult[]>([]);
  const stroopStartRef = useRef<number>(0);

  // Cognitive Digit Span state
  const [digitSpanTrials, setDigitSpanTrials] = useState<DigitSpanTrialConfig[]>([]);
  const [digitSpanIndex, setDigitSpanIndex] = useState(0);
  const [digitSpanInput, setDigitSpanInput] = useState('');
  const [digitSpanResults, setDigitSpanResults] = useState<DigitSpanTrialResult[]>([]);
  const [digitSpanShowDigits, setDigitSpanShowDigits] = useState(true);

  // Cognitive N-Back state
  const [nbackTrials, setNbackTrials] = useState<NBackTrialConfig[]>([]);
  const [nbackIndex, setNbackIndex] = useState(0);
  const [nbackResults, setNbackResults] = useState<NBackTrialResult[]>([]);
  const nbackStartRef = useRef<number>(0);

  // Cognitive Trail Tap state
  const [trailNodes, setTrailNodes] = useState<TrailTapNode[]>([]);
  const [trailEvents, setTrailEvents] = useState<TrailTapEvent[]>([]);
  const trailStartRef = useRef<number>(0);

  // Cognitive Vocal RAN state
  const [vocalRanChallenge, setVocalRanChallenge] = useState<VocalRanChallenge | null>(null);
  const [vocalRanRecording, setVocalRanRecording] = useState(false);
  const vocalRanStartRef = useRef<number>(0);

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
      setVoiceDiagnostic(result.diagnostic);
      if (result.sensitive) {
        Object.assign(sensitiveRef.current, result.sensitive);
      }
    } catch (err) {
      setVoiceSignal({ recorded: false, quality: 'missing', challenge_id: voiceChallengeId });
      setVoiceDiagnostic(null);
      setError(err instanceof Error ? err.message : 'Voice recording failed');
    } finally {
      setVoiceRecording(false);
      setPhase('cognitive-intro');
    }
  }, [voiceChallengeId]);

  const handleSkipVoice = useCallback(() => {
    setVoiceSignal({ recorded: false, quality: 'missing', challenge_id: voiceChallengeId });
    setVoiceDiagnostic(null);
    setPhase('cognitive-intro');
  }, [voiceChallengeId]);

  // ── Cognitive Reflex ──
  useEffect(() => {
    if (phase !== 'cognitive-intro' || cogReflexPhase !== 'wait') return;
    const delay = getRandomReflexDelay();
    cogReflexTimerRef.current = window.setTimeout(() => {
      cogGoAtRef.current = performance.now();
      setCogReflexPhase('go');
    }, delay);
    return () => { if (cogReflexTimerRef.current) window.clearTimeout(cogReflexTimerRef.current); };
  }, [phase, cogReflexPhase]);

  useEffect(() => {
    if (cogReflexPhase !== 'too_early') return;
    const t = window.setTimeout(() => setCogReflexPhase('ready'), 1200);
    return () => window.clearTimeout(t);
  }, [cogReflexPhase]);

  const handleCogReflexTap = useCallback(() => {
    if (phase !== 'cognitive-intro') return;
    if (cogReflexPhase === 'ready') {
      setCogLastReflexMs(null);
      setCogReflexPhase('wait');
      return;
    }
    if (cogReflexPhase === 'wait') {
      if (cogReflexTimerRef.current) window.clearTimeout(cogReflexTimerRef.current);
      setCogReflexPhase('too_early');
      return;
    }
    if (cogReflexPhase === 'go') {
      const ms = performance.now() - cogGoAtRef.current;
      const round = evaluateReflexRound(ms);
      setCogLastReflexMs(round.ms);
      const next = [...cogReflexResults, round];
      setCogReflexResults(next);
      if (next.length >= COG_REFLEX_ROUNDS) {
        const result = computeReflexResult(next);
        setCogReflexSignal(result);
        setCogReflexPhase('done');
        setPhase('cognitive-stroop');
        setStroopTrials(generateStroopTrials(6));
        setStroopIndex(0);
        setStroopResults([]);
      } else {
        setCogReflexRound((r) => r + 1);
        setCogReflexPhase('ready');
      }
    }
  }, [phase, cogReflexPhase, cogReflexResults]);

  const handleSkipCogReflex = useCallback(() => {
    setCogReflexSignal(null);
    setPhase('cognitive-stroop');
    setStroopTrials(generateStroopTrials(6));
    setStroopIndex(0);
    setStroopResults([]);
  }, []);

  // ── Cognitive Stroop ──
  const handleStroopSelect = useCallback((color: StroopColor) => {
    if (phase !== 'cognitive-stroop' || stroopIndex >= stroopTrials.length) return;
    const rt = performance.now() - stroopStartRef.current;
    const trial = stroopTrials[stroopIndex];
    const result: StroopTrialResult = {
      config: trial,
      selected: color,
      correct: color === trial.displayColor,
      response_ms: Math.round(rt),
    };
    const next = [...stroopResults, result];
    setStroopResults(next);
    if (next.length >= stroopTrials.length) {
      const sig = computeStroopResult(next);
      setCogStroopSignal(sig);
      setPhase('cognitive-digit-span');
      setDigitSpanTrials(generateDigitSpanTrials(3));
      setDigitSpanIndex(0);
      setDigitSpanInput('');
      setDigitSpanResults([]);
      setDigitSpanShowDigits(true);
    } else {
      setStroopIndex((i) => i + 1);
      stroopStartRef.current = performance.now();
    }
  }, [phase, stroopIndex, stroopTrials, stroopResults]);

  const handleSkipStroop = useCallback(() => {
    setCogStroopSignal(null);
    setPhase('cognitive-digit-span');
    setDigitSpanTrials(generateDigitSpanTrials(3));
    setDigitSpanIndex(0);
    setDigitSpanInput('');
    setDigitSpanResults([]);
    setDigitSpanShowDigits(true);
  }, []);

  // ── Cognitive Digit Span ──
  useEffect(() => {
    if (phase === 'cognitive-digit-span' && digitSpanShowDigits) {
      const t = window.setTimeout(() => setDigitSpanShowDigits(false), 3000);
      return () => window.clearTimeout(t);
    }
  }, [phase, digitSpanShowDigits, digitSpanIndex]);

  const handleDigitSpanSubmit = useCallback(() => {
    if (phase !== 'cognitive-digit-span' || digitSpanIndex >= digitSpanTrials.length) return;
    const trial = digitSpanTrials[digitSpanIndex];
    const input = digitSpanInput.split('').map(Number).filter((n) => !isNaN(n));
    const result = evaluateDigitSpanTrial(trial, input);
    const next = [...digitSpanResults, result];
    setDigitSpanResults(next);
    if (next.length >= digitSpanTrials.length) {
      const sig = computeDigitSpanResult(next);
      setCogDigitSpanSignal(sig);
      setPhase('cognitive-nback');
      setNbackTrials(generateNBackTrials(8));
      setNbackIndex(0);
      setNbackResults([]);
    } else {
      setDigitSpanIndex((i) => i + 1);
      setDigitSpanInput('');
      setDigitSpanShowDigits(true);
    }
  }, [phase, digitSpanIndex, digitSpanTrials, digitSpanInput, digitSpanResults]);

  const handleSkipDigitSpan = useCallback(() => {
    setCogDigitSpanSignal(null);
    setPhase('cognitive-nback');
    setNbackTrials(generateNBackTrials(8));
    setNbackIndex(0);
    setNbackResults([]);
  }, []);

  // ── Cognitive N-Back ──
  const handleNBackResponse = useCallback((saidMatch: boolean) => {
    if (phase !== 'cognitive-nback' || nbackIndex >= nbackTrials.length) return;
    const rt = performance.now() - nbackStartRef.current;
    const trial = nbackTrials[nbackIndex];
    const result = evaluateNBackTrial(trial, saidMatch, rt);
    const next = [...nbackResults, result];
    setNbackResults(next);
    if (next.length >= nbackTrials.length) {
      const sig = computeNBackResult(next);
      setCogNBackSignal(sig);
      const nodes = generateTrailTapNodes(5);
      setTrailNodes(nodes);
      setTrailEvents([]);
      setPhase('cognitive-trail-tap');
      trailStartRef.current = 0;
    } else {
      setNbackIndex((i) => i + 1);
      nbackStartRef.current = performance.now();
    }
  }, [phase, nbackIndex, nbackTrials, nbackResults]);

  const handleSkipNBack = useCallback(() => {
    setCogNBackSignal(null);
    const nodes = generateTrailTapNodes(5);
    setTrailNodes(nodes);
    setTrailEvents([]);
    setPhase('cognitive-trail-tap');
  }, []);

  // ── Cognitive Trail Tap ──
  const handleTrailTap = useCallback((nodeId: number) => {
    if (phase !== 'cognitive-trail-tap') return;
    const now = performance.now();
    if (trailStartRef.current === 0) {
      trailStartRef.current = now;
    }
    const expectedId = trailEvents.filter((e) => e.correct).length + 1;
    const correct = nodeId === expectedId;
    const event: TrailTapEvent = { nodeId, timestamp: now - (trailStartRef.current || now), correct };
    const next = [...trailEvents, event];
    setTrailEvents(next);
    if (correct && expectedId === trailNodes.length) {
      const completionMs = now - trailStartRef.current;
      const sig = computeTrailTapResult(trailNodes, next, completionMs);
      setCogTrailTapSignal(sig);
      const challenge = generateVocalRanChallenge(5);
      setVocalRanChallenge(challenge);
      setPhase('cognitive-vocal-ran');
    }
  }, [phase, trailEvents, trailNodes]);

  const handleSkipTrailTap = useCallback(() => {
    setCogTrailTapSignal(null);
    const challenge = generateVocalRanChallenge(5);
    setVocalRanChallenge(challenge);
    setPhase('cognitive-vocal-ran');
  }, []);

  // ── Cognitive Vocal RAN ──
  const handleVocalRanRecord = useCallback(async () => {
    if (!vocalRanChallenge) return;
    setVocalRanRecording(true);
    vocalRanStartRef.current = performance.now();
    try {
      const result = await recordVoiceChallenge(5000, vocalRanChallenge.challenge_id);
      const durationMs = performance.now() - vocalRanStartRef.current;
      const sig = computeVocalRanResult(vocalRanChallenge, durationMs, result.safe.recorded);
      setCogVocalRanSignal(sig);
      if (result.sensitive) {
        Object.assign(sensitiveRef.current, result.sensitive);
      }
    } catch {
      const durationMs = performance.now() - vocalRanStartRef.current;
      const sig = computeVocalRanResult(vocalRanChallenge, durationMs, false);
      setCogVocalRanSignal(sig);
    } finally {
      setVocalRanRecording(false);
      finishCognitiveBattery();
    }
  }, [vocalRanChallenge]);

  const handleSkipVocalRan = useCallback(() => {
    if (vocalRanChallenge) {
      const sig = computeVocalRanResult(vocalRanChallenge, 0, false);
      setCogVocalRanSignal(sig);
    }
    finishCognitiveBattery();
  }, [vocalRanChallenge]);

  const finishCognitiveBattery = useCallback(() => {
    const cogSignals: CognitiveSignals = {
      reflex: cogReflexSignal,
      stroop: cogStroopSignal,
      digit_span: cogDigitSpanSignal,
      n_back: cogNBackSignal,
      trail_tap: cogTrailTapSignal,
      vocal_ran: cogVocalRanSignal,
      summary: null,
    };
    const summary = computeCognitiveSummary(cogSignals);
    cogSignals.summary = summary;
    setCogSummary(summary);
    setPhase('cognitive-summary');
  }, [cogReflexSignal, cogStroopSignal, cogDigitSpanSignal, cogNBackSignal, cogTrailTapSignal, cogVocalRanSignal]);

  const handleCognitiveContinue = useCallback(() => {
    setPhase('device-signals');
  }, []);

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
    const cogSignals: CognitiveSignals | null = cogSummary ? {
      reflex: cogReflexSignal,
      stroop: cogStroopSignal,
      digit_span: cogDigitSpanSignal,
      n_back: cogNBackSignal,
      trail_tap: cogTrailTapSignal,
      vocal_ran: cogVocalRanSignal,
      summary: cogSummary,
    } : null;
    const signals: DemoGuardSignals = {
      selfie: selfieSignal,
      reaction: reactionSignal,
      voice: voiceSignal,
      motion: motionSignal,
      orientation: orientationSignal,
      touch: touchSignal,
      visibility: visibilitySignal,
      network: networkSignal,
      cognitive: cogSignals,
    };
    const q = computeQuality(signals, device, permissions);
    setQuality(q);
  }, [phase, device, permissions, selfieSignal, reactionSignal, voiceSignal, motionSignal, orientationSignal, touchSignal, visibilitySignal, networkSignal, cogSummary, cogReflexSignal, cogStroopSignal, cogDigitSpanSignal, cogNBackSignal, cogTrailTapSignal, cogVocalRanSignal]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (phase === 'submitting') return;
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

    const cogSignals: CognitiveSignals | null = cogSummary ? {
      reflex: cogReflexSignal,
      stroop: cogStroopSignal,
      digit_span: cogDigitSpanSignal,
      n_back: cogNBackSignal,
      trail_tap: cogTrailTapSignal,
      vocal_ran: cogVocalRanSignal,
      summary: cogSummary,
    } : null;
    const signals: DemoGuardSignals = {
      selfie: selfieSignal,
      reaction: reactionSignal,
      voice: voiceSignal,
      motion: motionSignal,
      orientation: orientationSignal,
      touch: touchSignal,
      visibility: visibilitySignal,
      network: networkSignal,
      cognitive: cogSignals,
      voiceDiagnostics: buildVoiceDiagnosticsSafe(voiceSignal, voiceDiagnostic, !!sensitiveRef.current[VOICE_KEY]),
      touchDiagnostics: buildTouchDiagnosticsSafe(touchSignal),
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
  }, [sessionPublicId, device, permissions, quality, selfieSignal, reactionSignal, voiceSignal, motionSignal, orientationSignal, touchSignal, visibilitySignal, networkSignal, cogSummary, cogReflexSignal, cogStroopSignal, cogDigitSpanSignal, cogNBackSignal, cogTrailTapSignal, cogVocalRanSignal]);

  // ── Cleanup camera on unmount ──
  useEffect(() => {
    return () => { stopCamera(cameraStreamRef.current); };
  }, []);

  // ── Submit workflow state ──
  const [reconciledVocalDiag, setReconciledVocalDiag] = useState<DemoGuardVoiceDiagnostic | null>(null);

  // ── Submit block reasons ──
  const submitBlockReasons: string[] = [];
  if (!sessionPublicId.trim()) submitBlockReasons.push('Missing session public ID');
  if (!device || !permissions) submitBlockReasons.push('Device check not completed');
  if (phase === 'submitting') submitBlockReasons.push('Submission in progress');

  // ── Submit warnings (not blocking) ──
  const submitWarnings: string[] = [];
  if (voiceSignal && !voiceSignal.recorded) submitWarnings.push('⚠️ Voice sample missing — vocal liveness analysis will be skipped. Record a voice sample for full security coverage.');
  if (voiceSignal && voiceSignal.recorded && voiceSignal.quality === 'low') submitWarnings.push('⚠️ Voice sample quality is low — consider re-recording for better vocal analysis.');
  if (!voiceSignal) submitWarnings.push('⚠️ Voice capture step not completed — vocal liveness analysis will be skipped.');
  if (motionSignal && motionSignal.quality === 'unsupported') submitWarnings.push('Motion sensor unsupported on this device');
  if (orientationSignal && orientationSignal.quality === 'unsupported') submitWarnings.push('Orientation sensor unsupported on this device');
  if (cogSummary && cogSummary.depth_score < 0.65) submitWarnings.push(`Cognitive depth low (${(cogSummary.depth_score * 100).toFixed(0)}%) — submit with caution`);
  if (cogSummary && cogSummary.completed_modules < 4) submitWarnings.push(`Only ${cogSummary.completed_modules} cognitive modules completed (recommended: 4+)`);

  const canSubmit = submitBlockReasons.length === 0 && phase !== 'submitting' && phase !== 'done';
  const isSubmitting = phase === 'submitting';
  const isSubmitted = phase === 'done' && response != null;

  // ── Reconcile vocal diagnostic from server response ──
  useEffect(() => {
    if (!response?.hybridFusion?.vocalDiagnostic) {
      setReconciledVocalDiag(voiceDiagnostic);
      return;
    }
    const remote = response.hybridFusion.vocalDiagnostic;
    const local = voiceDiagnostic;
    if (local && !local.audioCaptured) {
      setReconciledVocalDiag({
        ...remote,
        audioCaptured: false,
        payloadPrepared: false,
        analysisMode: remote.relayAttempted ? 'metadata_only' : 'skipped',
        audioPipelineStatus: local.audioPipelineStatus,
        analyzed: false,
      });
    } else {
      setReconciledVocalDiag(remote);
    }
  }, [response, voiceDiagnostic]);

  // ── Mission status chip ──
  const missionStatus: { label: string; cls: string } =
    isSubmitted && response?.status === 'submitted' && response?.hybridFusion?.globalDecision === 'ACCEPT'
      ? { label: 'Verified', cls: 'dg-chip-verified' }
      : isSubmitted && response?.status === 'review'
      ? { label: 'Review', cls: 'dg-chip-review' }
      : isSubmitted && response?.status === 'failed'
      ? { label: 'Failed', cls: 'dg-chip-failed' }
      : isSubmitting
      ? { label: 'Submitting', cls: 'dg-chip-collecting' }
      : quality?.overall_ready
      ? { label: 'Ready', cls: 'dg-chip-ready' }
      : phase === 'idle'
      ? { label: 'Idle', cls: 'dg-chip-neutral' }
      : { label: 'Collecting', cls: 'dg-chip-collecting' };

  // ── Sensor readiness score (0-100) ──
  const sensorScore = quality ? Math.round(quality.signal_completeness * 100) : 0;
  // ── Cognitive depth score (0-100) ──
  const cognitiveScore = cogSummary ? Math.round(cogSummary.depth_score * 100) : 0;
  // ── Voice integrity score (0-100) ──
  const voiceScore = reconciledVocalDiag
    ? reconciledVocalDiag.audioCaptured && reconciledVocalDiag.analyzed
      ? 100
      : reconciledVocalDiag.audioCaptured
      ? 60
      : reconciledVocalDiag.relayAttempted
      ? 30
      : 0
    : 0;

  // ── Response wording helpers ──
  const responseMessage = response?.message
    ? response.message === 'HCS result unavailable'
      ? 'HCS cognitive result not finalized — Hybrid Vector used safe REVIEW fallback.'
      : response.message
    : null;

  const monitoringLabel = response?.hybridFusion?.monitoringStatus
    ? response.hybridFusion.monitoringStatus === 'recorded'
      ? 'Recorded'
      : response.hybridFusion.monitoringStatus === 'pending'
      ? 'Pending'
      : 'Failed'
    : response?.hybridFusion?.monitoringRecorded != null
    ? response.hybridFusion.monitoringRecorded
      ? 'Recorded'
      : 'Failed'
    : null;

  const vocalWording = reconciledVocalDiag
    ? reconciledVocalDiag.vocalStatus === 'passed'
      ? 'Voice integrity: Passed — liveness present'
      : reconciledVocalDiag.audioCaptured === false
      ? `Voice integrity: Review — audio sample missing (${reconciledVocalDiag.reasonSafe})`
      : reconciledVocalDiag.analyzed === false
      ? `Voice integrity: Review — HCS analysis limited (${reconciledVocalDiag.reasonSafe})`
      : `Voice integrity: ${reconciledVocalDiag.vocalStatus} — ${reconciledVocalDiag.reasonSafe}`
    : null;

  const reactionBg =
    reactionPhase === 'go' ? '#10b981' :
    reactionPhase === 'wait' ? '#ef4444' :
    reactionPhase === 'too_early' ? '#f59e0b' :
    '#06b6d4';

  const reactionLabel =
    reactionPhase === 'ready' ? 'TAP TO START' :
    reactionPhase === 'wait' ? 'WAIT...' :
    reactionPhase === 'go' ? 'TAP NOW!' :
    reactionPhase === 'too_early' ? 'TOO EARLY' :
    'Done';

  return (
    <div className="dg-page">
      {/* ═══ 1. Hero / Mission Status ═══ */}
      <div className="dg-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="dg-hero-title">HCS-U7 DemoGuard</h1>
            <p className="dg-hero-sub">Human Cognitive Signature — v{DEMOGUARD_VERSION}</p>
          </div>
          <button type="button" onClick={() => navigate(ROUTES.HOME)} className="ddg-nav-back">
            ← Back
          </button>
        </div>
        <div className="dg-hero-meta">
          <span className={`dg-chip ${missionStatus.cls}`}>{missionStatus.label}</span>
          {sessionPublicId && (
            <span className="dg-trace-id">
              {sessionPublicId.length > 20
                ? `${sessionPublicId.slice(0, 8)}…${sessionPublicId.slice(-6)}`
                : sessionPublicId}
            </span>
          )}
          {response?.traceId && (
            <span className="dg-trace-id">trace: {response.traceId.slice(0, 12)}…</span>
          )}
        </div>
      </div>

      {/* Session ID input */}
      {phase === 'idle' && (
        <div className="dg-card">
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--dg-text-bright)' }}>
            HCS Session Public ID
          </label>
          <input
            type="text"
            value={sessionPublicId}
            onChange={(e) => setSessionPublicId(e.target.value)}
            placeholder="hcs_sess_..."
            className="dg-input"
          />
          <div style={{ marginTop: 12 }}>
            <button onClick={handleStart} className="dg-btn dg-btn-primary" style={{ width: '100%' }}>
              Start DemoGuard Check
            </button>
          </div>
        </div>
      )}

      {/* Device check result */}
      {device && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Device Check</h3>
          <div className="dg-row"><span className="dg-row-label">Platform</span><span className="dg-row-value">{device.platform}</span></div>
          <div className="dg-row"><span className="dg-row-label">Screen</span><span className="dg-row-value">{device.screenWidth}×{device.screenHeight}</span></div>
          <div className="dg-row"><span className="dg-row-label">Online</span><span className="dg-row-value">{device.online ? 'OK' : 'OFFLINE'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Timezone</span><span className="dg-row-value">{device.timezone ?? 'unknown'}</span></div>
        </div>
      )}

      {/* Permissions result */}
      {permissions && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Permissions</h3>
          <div className="dg-row"><span className="dg-row-label">Camera</span><span className={`dg-badge ${permissions.camera === 'granted' ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{permissions.camera}</span></div>
          <div className="dg-row"><span className="dg-row-label">Microphone</span><span className={`dg-badge ${permissions.microphone === 'granted' ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{permissions.microphone}</span></div>
        </div>
      )}

      {/* Step 3: Camera capture */}
      {phase === 'camera' && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Camera — Selfie Capture</h3>
          <video ref={videoRef} autoPlay playsInline muted className="dg-video" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={handleCaptureSelfie} disabled={!cameraReady} className="dg-btn dg-btn-primary">Capture</button>
            <button onClick={handleSkipCamera} className="dg-btn dg-btn-secondary">Skip</button>
          </div>
        </div>
      )}

      {/* Camera result */}
      {selfieSignal && phase !== 'camera' && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Camera</h3>
          <div className="dg-row">
            <span className="dg-row-label">Status</span>
            <span className={`dg-badge ${selfieSignal.captured ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{selfieSignal.captured ? 'OK' : 'MISSING'}</span>
          </div>
          {selfieSignal.captured && (
            <div className="dg-row"><span className="dg-row-label">Quality</span><span className="dg-row-value">{selfieSignal.quality}{selfieSignal.width ? ` · ${selfieSignal.width}×${selfieSignal.height}` : ''}</span></div>
          )}
        </div>
      )}

      {/* Step 4: Reaction test */}
      {phase === 'reaction' && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Reaction Test</h3>
          <p className="dg-challenge-sub">Round {reactionRound + 1} of {REACTION_ROUNDS}</p>
          <div className="dg-round-dots">
            {Array.from({ length: REACTION_ROUNDS }).map((_, i) => (
              <div key={i} className={`dg-round-dot ${i < reactionResults.length ? 'done' : i === reactionRound ? 'current' : ''}`} />
            ))}
          </div>
          <button onClick={handleReactionTap} className="dg-reaction-btn" style={{ background: reactionBg }}>
            {reactionLabel}
          </button>
          {lastReactionMs !== null && reactionPhase === 'ready' && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--dg-green)' }}>Last: {lastReactionMs} ms</p>
          )}
        </div>
      )}

      {/* Reaction result */}
      {reactionSignal && phase !== 'reaction' && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Reaction</h3>
          <div className="dg-row">
            <span className="dg-row-label">Status</span>
            <span className={`dg-badge ${reactionSignal.quality === 'ok' ? 'dg-badge-ok' : reactionSignal.quality === 'low' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{reactionSignal.quality === 'ok' ? 'OK' : reactionSignal.quality === 'low' ? 'LOW' : 'MISSING'}</span>
          </div>
          {reactionSignal.reaction_ms != null && <div className="dg-row"><span className="dg-row-label">Avg</span><span className="dg-row-value">{reactionSignal.reaction_ms} ms</span></div>}
          <div className="dg-row"><span className="dg-row-label">Too fast</span><span className={`dg-badge ${reactionSignal.too_fast ? 'dg-badge-review' : 'dg-badge-ok'}`}>{reactionSignal.too_fast ? 'WARNING' : 'OK'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Too slow</span><span className={`dg-badge ${reactionSignal.too_slow ? 'dg-badge-review' : 'dg-badge-ok'}`}>{reactionSignal.too_slow ? 'WARNING' : 'OK'}</span></div>
        </div>
      )}

      {/* Step 5: Voice challenge */}
      {phase === 'voice' && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Voice Challenge</h3>
          <p className="dg-challenge-sub">Read this phrase aloud:</p>
          <p className="dg-phrase">"{generateChallengePhrase(voiceChallengeId)}"</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={handleRecordVoice} disabled={voiceRecording} className="dg-btn dg-btn-primary">
              {voiceRecording ? 'Recording...' : 'Record'}
            </button>
            <button onClick={handleSkipVoice} disabled={voiceRecording} className="dg-btn dg-btn-secondary">Skip</button>
          </div>
        </div>
      )}

      {/* Voice result */}
      {voiceSignal && phase !== 'voice' && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Voice</h3>
          <div className="dg-row">
            <span className="dg-row-label">Status</span>
            <span className={`dg-badge ${voiceSignal.recorded ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{voiceSignal.recorded ? 'OK' : 'MISSING'}</span>
          </div>
          {voiceSignal.recorded && (
            <>
              <div className="dg-row"><span className="dg-row-label">Duration</span><span className="dg-row-value">{voiceSignal.duration_ms} ms</span></div>
              <div className="dg-row"><span className="dg-row-label">MFCC</span><span className={`dg-badge ${voiceSignal.mfcc_available ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{voiceSignal.mfcc_available ? 'OK' : 'MISSING'}</span></div>
            </>
          )}
          {voiceDiagnostic && (
            <>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--dg-border)' }} />
              <div className="dg-row"><span className="dg-row-label">Microphone</span><span className={`dg-badge ${voiceDiagnostic.microphonePermission === 'granted' ? 'dg-badge-ok' : voiceDiagnostic.microphonePermission === 'denied' ? 'dg-badge-missing' : 'dg-badge-unsupported'}`}>{voiceDiagnostic.microphonePermission}</span></div>
              <div className="dg-row"><span className="dg-row-label">Audio captured</span><span className={`dg-badge ${voiceDiagnostic.audioCaptured ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{voiceDiagnostic.audioCaptured ? 'YES' : 'NO'}</span></div>
              <div className="dg-row"><span className="dg-row-label">Audio pipeline</span><span className="dg-row-value">{voiceDiagnostic.audioPipelineStatus}</span></div>
              {voiceDiagnostic.durationMs != null && <div className="dg-row"><span className="dg-row-label">Duration</span><span className="dg-row-value">{voiceDiagnostic.durationMs} ms</span></div>}
              <div className="dg-row"><span className="dg-row-label">Size bucket</span><span className="dg-row-value">{voiceDiagnostic.audioSizeBucket}</span></div>
              <div className="dg-row"><span className="dg-row-label">Payload prepared</span><span className={`dg-badge ${voiceDiagnostic.payloadPrepared ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{voiceDiagnostic.payloadPrepared ? 'YES' : 'NO'}</span></div>
              <div className="dg-row"><span className="dg-row-label">Analysis mode</span><span className="dg-row-value">{voiceDiagnostic.analysisMode.replace(/_/g, ' ')}</span></div>
              <div className="dg-row"><span className="dg-row-label">Relay attempted</span><span className={`dg-badge ${voiceDiagnostic.relayAttempted ? 'dg-badge-ok' : 'dg-badge-skipped'}`}>{voiceDiagnostic.relayAttempted ? 'YES' : 'NO'}</span></div>
              {voiceDiagnostic.relayAttempted && <div className="dg-row"><span className="dg-row-label">Relay accepted</span><span className={`dg-badge ${voiceDiagnostic.relayAccepted ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{voiceDiagnostic.relayAccepted ? 'YES' : 'NO'}</span></div>}
              <div className="dg-row"><span className="dg-row-label">Analyzed</span><span className={`dg-badge ${voiceDiagnostic.analyzed ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{voiceDiagnostic.analyzed ? 'YES' : 'NO'}</span></div>
              <div className="dg-row"><span className="dg-row-label">Vocal status</span><span className={`dg-badge ${voiceDiagnostic.vocalStatus === 'passed' ? 'dg-badge-ok' : voiceDiagnostic.vocalStatus === 'failed' ? 'dg-badge-failed' : voiceDiagnostic.vocalStatus === 'review' ? 'dg-badge-review' : 'dg-badge-skipped'}`}>{voiceDiagnostic.vocalStatus}</span></div>
              {voiceDiagnostic.confidenceLevel && <div className="dg-row"><span className="dg-row-label">Confidence</span><span className="dg-row-value">{voiceDiagnostic.confidenceLevel}</span></div>}
              {voiceDiagnostic.reasonSafe && <div className="dg-row"><span className="dg-row-label">Reason</span><span className="dg-row-value dg-row-value-mono">{voiceDiagnostic.reasonSafe}</span></div>}
              {voiceDiagnostic.latencyMs != null && <div className="dg-row"><span className="dg-row-label">Latency</span><span className="dg-row-value">{voiceDiagnostic.latencyMs} ms</span></div>}
            </>
          )}
        </div>
      )}

      {/* ═══ Cognitive Battery ═══ */}

      {/* Cognitive Reflex (phase: cognitive-intro) */}
      {phase === 'cognitive-intro' && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Cognitive Battery — Reflex</h3>
          <p className="dg-challenge-sub">Round {cogReflexRound + 1} of {COG_REFLEX_ROUNDS}</p>
          <div className="dg-round-dots">
            {Array.from({ length: COG_REFLEX_ROUNDS }).map((_, i) => (
              <div key={i} className={`dg-round-dot ${i < cogReflexResults.length ? 'done' : i === cogReflexRound ? 'current' : ''}`} />
            ))}
          </div>
          <button
            onClick={handleCogReflexTap}
            className="dg-reaction-btn"
            style={{ background: cogReflexPhase === 'go' ? '#10b981' : cogReflexPhase === 'wait' ? '#ef4444' : cogReflexPhase === 'too_early' ? '#f59e0b' : '#06b6d4' }}
          >
            {cogReflexPhase === 'ready' ? 'TAP TO START' : cogReflexPhase === 'wait' ? 'WAIT...' : cogReflexPhase === 'go' ? 'TAP NOW!' : cogReflexPhase === 'too_early' ? 'TOO EARLY' : 'Done'}
          </button>
          {cogLastReflexMs !== null && cogReflexPhase === 'ready' && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--dg-green)' }}>Last: {cogLastReflexMs} ms</p>
          )}
          <div style={{ marginTop: 16 }}>
            <button onClick={handleSkipCogReflex} className="dg-btn dg-btn-secondary">Skip Reflex</button>
          </div>
        </div>
      )}

      {/* Cognitive Stroop */}
      {phase === 'cognitive-stroop' && stroopTrials.length > 0 && stroopIndex < stroopTrials.length && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Cognitive Battery — Stroop</h3>
          <p className="dg-challenge-sub">Trial {stroopIndex + 1} / {stroopTrials.length} — Select the COLOR shown</p>
          <div className="dg-stroop-word" style={{ color: stroopTrials[stroopIndex].displayColor === 'red' ? '#ef4444' : stroopTrials[stroopIndex].displayColor === 'blue' ? '#3b82f6' : stroopTrials[stroopIndex].displayColor === 'green' ? '#22c55e' : '#eab308' }}>
            {stroopTrials[stroopIndex].word.toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {STROOP_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleStroopSelect(color)}
                className="dg-stroop-btn"
                style={{ background: color === 'red' ? '#ef4444' : color === 'blue' ? '#3b82f6' : color === 'green' ? '#22c55e' : '#eab308' }}
              >
                {color}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={handleSkipStroop} className="dg-btn dg-btn-secondary">Skip Stroop</button>
          </div>
        </div>
      )}

      {/* Cognitive Digit Span */}
      {phase === 'cognitive-digit-span' && digitSpanTrials.length > 0 && digitSpanIndex < digitSpanTrials.length && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Cognitive Battery — Digit Span</h3>
          <p className="dg-challenge-sub">Trial {digitSpanIndex + 1} / {digitSpanTrials.length} — {digitSpanTrials[digitSpanIndex].span} digits</p>
          {digitSpanShowDigits ? (
            <div className="dg-digit-display">{digitSpanTrials[digitSpanIndex].sequence.join(' ')}</div>
          ) : (
            <>
              <p className="dg-challenge-sub">Type the sequence:</p>
              <input
                type="text"
                inputMode="numeric"
                value={digitSpanInput}
                onChange={(e) => setDigitSpanInput(e.target.value.replace(/\D/g, ''))}
                className="dg-digit-input"
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={handleDigitSpanSubmit} disabled={!digitSpanInput} className="dg-btn dg-btn-primary">Submit</button>
                <button onClick={handleSkipDigitSpan} className="dg-btn dg-btn-secondary">Skip</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Cognitive N-Back */}
      {phase === 'cognitive-nback' && nbackTrials.length > 0 && nbackIndex < nbackTrials.length && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Cognitive Battery — N-Back (1-back)</h3>
          <p className="dg-challenge-sub">Trial {nbackIndex + 1} / {nbackTrials.length} — Same as previous?</p>
          <div className="dg-nback-letter">{nbackTrials[nbackIndex].letter}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => handleNBackResponse(true)} className="dg-nback-btn" style={{ background: '#22c55e' }}>MATCH</button>
            <button onClick={() => handleNBackResponse(false)} className="dg-nback-btn" style={{ background: '#6b7280' }}>NO</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={handleSkipNBack} className="dg-btn dg-btn-secondary">Skip N-Back</button>
          </div>
        </div>
      )}

      {/* Cognitive Trail Tap */}
      {phase === 'cognitive-trail-tap' && trailNodes.length > 0 && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Cognitive Battery — Trail Tap</h3>
          <p className="dg-challenge-sub">Tap dots in order 1 → {trailNodes.length}</p>
          <div className="dg-trail-area">
            {trailNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => handleTrailTap(node.id)}
                className="dg-trail-node"
                style={{ left: node.x, top: node.y }}
              >
                {node.id}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={handleSkipTrailTap} className="dg-btn dg-btn-secondary">Skip Trail Tap</button>
          </div>
        </div>
      )}

      {/* Cognitive Vocal RAN */}
      {phase === 'cognitive-vocal-ran' && vocalRanChallenge && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Cognitive Battery — Vocal RAN</h3>
          <p className="dg-challenge-sub">Read these numbers aloud, in order:</p>
          <div className="dg-vocal-sequence">{vocalRanChallenge.sequence.join(' ')}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={handleVocalRanRecord} disabled={vocalRanRecording} className="dg-btn dg-btn-primary">
              {vocalRanRecording ? 'Recording...' : 'Record'}
            </button>
            <button onClick={handleSkipVocalRan} disabled={vocalRanRecording} className="dg-btn dg-btn-secondary">Skip</button>
          </div>
        </div>
      )}

      {/* Cognitive Summary */}
      {phase === 'cognitive-summary' && cogSummary && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Cognitive Proof Summary</h3>
          <div className="dg-row"><span className="dg-row-label">Modules completed</span><span className="dg-row-value">{cogSummary.completed_modules} / {cogSummary.total_modules}</span></div>
          <div className="dg-row"><span className="dg-row-label">Cognitive depth</span><span className="dg-row-value" style={{ color: cogSummary.depth_score >= 0.65 ? 'var(--dg-green)' : 'var(--dg-amber)' }}>{(cogSummary.depth_score * 100).toFixed(0)}%</span></div>
          <div className="dg-row"><span className="dg-row-label">Consistency</span><span className="dg-row-value">{(cogSummary.consistency_score * 100).toFixed(0)}%</span></div>
          <div className="dg-row"><span className="dg-row-label">Anomaly</span><span className="dg-row-value" style={{ color: cogSummary.anomaly_score < 0.3 ? 'var(--dg-green)' : cogSummary.anomaly_score < 0.5 ? 'var(--dg-amber)' : 'var(--dg-red)' }}>{cogSummary.anomaly_score < 0.3 ? 'low' : cogSummary.anomaly_score < 0.5 ? 'medium' : 'high'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Human likelihood</span><span className={`dg-badge ${cogSummary.human_likelihood === 'high' ? 'dg-badge-ok' : cogSummary.human_likelihood === 'medium' ? 'dg-badge-review' : 'dg-badge-failed'}`}>{cogSummary.human_likelihood}</span></div>
          {cogSummary.depth_score < 0.65 && (
            <div className="dg-interp dg-interp-medium">Cognitive depth is low ({(cogSummary.depth_score * 100).toFixed(0)}% below 65%). Submit with caution.</div>
          )}
          <div style={{ marginTop: 16 }}>
            <button onClick={handleCognitiveContinue} className="dg-btn dg-btn-primary" style={{ width: '100%' }}>Continue to device signals</button>
          </div>
        </div>
      )}

      {/* ═══ 5. Cognitive Battery Panel (results) ═══ */}
      {cogReflexSignal && phase !== 'cognitive-intro' && phase !== 'cognitive-stroop' && phase !== 'cognitive-digit-span' && phase !== 'cognitive-nback' && phase !== 'cognitive-trail-tap' && phase !== 'cognitive-vocal-ran' && phase !== 'cognitive-summary' && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Cognitive Battery</h3>
          <div className="dg-grid">
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Reflex</span><span className={`dg-badge ${cogReflexSignal.quality === 'ok' ? 'dg-badge-ok' : cogReflexSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogReflexSignal.quality}</span></div>
              <span className="dg-grid-item-detail">Avg {cogReflexSignal.avg_ms}ms · Med {cogReflexSignal.median_ms}ms</span>
              <span className="dg-grid-item-detail">Fast: {cogReflexSignal.too_fast_count} · Slow: {cogReflexSignal.too_slow_count}</span>
            </div>
            {cogStroopSignal && (
              <div className="dg-grid-item">
                <div className="dg-grid-item-header"><span className="dg-grid-item-label">Stroop</span><span className={`dg-badge ${cogStroopSignal.quality === 'ok' ? 'dg-badge-ok' : cogStroopSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogStroopSignal.quality}</span></div>
                <span className="dg-grid-item-detail">Acc {(cogStroopSignal.accuracy * 100).toFixed(0)}% · Conflict {cogStroopSignal.conflict_cost_ms}ms</span>
              </div>
            )}
            {cogDigitSpanSignal && (
              <div className="dg-grid-item">
                <div className="dg-grid-item-header"><span className="dg-grid-item-label">Digit Span</span><span className={`dg-badge ${cogDigitSpanSignal.quality === 'ok' ? 'dg-badge-ok' : cogDigitSpanSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogDigitSpanSignal.quality}</span></div>
                <span className="dg-grid-item-detail">Max span {cogDigitSpanSignal.max_span} · Acc {(cogDigitSpanSignal.accuracy * 100).toFixed(0)}%</span>
              </div>
            )}
            {cogNBackSignal && (
              <div className="dg-grid-item">
                <div className="dg-grid-item-header"><span className="dg-grid-item-label">N-Back</span><span className={`dg-badge ${cogNBackSignal.quality === 'ok' ? 'dg-badge-ok' : cogNBackSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogNBackSignal.quality}</span></div>
                <span className="dg-grid-item-detail">Hits {cogNBackSignal.hits} · FP {cogNBackSignal.false_positives} · Miss {cogNBackSignal.misses}</span>
              </div>
            )}
            {cogTrailTapSignal && (
              <div className="dg-grid-item">
                <div className="dg-grid-item-header"><span className="dg-grid-item-label">Trail Tap</span><span className={`dg-badge ${cogTrailTapSignal.quality === 'ok' ? 'dg-badge-ok' : cogTrailTapSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogTrailTapSignal.quality}</span></div>
                <span className="dg-grid-item-detail">Time {cogTrailTapSignal.completion_ms}ms · Wrong {cogTrailTapSignal.wrong_taps}</span>
              </div>
            )}
            {cogVocalRanSignal && (
              <div className="dg-grid-item">
                <div className="dg-grid-item-header"><span className="dg-grid-item-label">Vocal RAN</span><span className={`dg-badge ${cogVocalRanSignal.quality === 'ok' ? 'dg-badge-ok' : cogVocalRanSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogVocalRanSignal.quality}</span></div>
                <span className="dg-grid-item-detail">Duration {cogVocalRanSignal.duration_ms}ms · Audio {cogVocalRanSignal.audio_present ? 'yes' : 'no'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Device signals loading */}
      {phase === 'device-signals' && (
        <div className="dg-card dg-challenge-area">
          <div className="dg-spinner" style={{ margin: '0 auto' }} />
          <p className="dg-challenge-sub" style={{ marginTop: 12 }}>Collecting device signals...</p>
        </div>
      )}

      {/* ═══ 3. Signal Matrix (8 signals) ═══ */}
      {phase !== 'device-signals' && phase !== 'idle' && (motionSignal || orientationSignal || touchSignal || visibilitySignal || networkSignal) && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Signal Matrix</h3>
          <div className="dg-grid">
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Motion</span><span className={`dg-badge ${motionSignal?.quality === 'ok' ? 'dg-badge-ok' : motionSignal?.quality === 'unsupported' ? 'dg-badge-unsupported' : motionSignal?.quality === 'low' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{motionSignal?.quality ?? '—'}</span></div>
              {motionSignal?.supported && <span className="dg-grid-item-detail">{motionSignal.sample_count} samples</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Orientation</span><span className={`dg-badge ${orientationSignal?.quality === 'ok' ? 'dg-badge-ok' : orientationSignal?.quality === 'unsupported' ? 'dg-badge-unsupported' : orientationSignal?.quality === 'low' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{orientationSignal?.quality ?? '—'}</span></div>
              {orientationSignal?.supported && <span className="dg-grid-item-detail">{orientationSignal.changes} changes</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Touch</span><span className={`dg-badge ${touchSignal?.quality === 'ok' ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{touchSignal?.quality ?? '—'}</span></div>
              {touchSignal && touchSignal.touch_count > 0 && <span className="dg-grid-item-detail">{touchSignal.touch_count} touches{touchSignal.multi_touch_detected ? ' · multi' : ''}</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Focus</span><span className={`dg-badge ${visibilitySignal?.quality === 'ok' ? 'dg-badge-ok' : 'dg-badge-review'}`}>{visibilitySignal?.quality ?? '—'}</span></div>
              {visibilitySignal && <span className="dg-grid-item-detail">Blur {visibilitySignal.blur_count} · Hidden {visibilitySignal.visibility_hidden_count}</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Network</span><span className={`dg-badge ${networkSignal?.quality === 'ok' ? 'dg-badge-ok' : networkSignal?.quality === 'unsupported' ? 'dg-badge-unsupported' : 'dg-badge-missing'}`}>{networkSignal?.quality ?? '—'}</span></div>
              {networkSignal && <span className="dg-grid-item-detail">{networkSignal.online ? 'online' : 'offline'}{networkSignal.effective_type ? ` · ${networkSignal.effective_type}` : ''}</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Camera</span><span className={`dg-badge ${selfieSignal?.captured ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{selfieSignal?.captured ? 'OK' : 'MISSING'}</span></div>
              {selfieSignal?.captured && <span className="dg-grid-item-detail">{selfieSignal.quality}</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Voice</span><span className={`dg-badge ${voiceSignal?.recorded ? 'dg-badge-recorded' : 'dg-badge-missing'}`}>{voiceSignal?.recorded ? 'OK' : 'MISSING'}</span></div>
              {voiceSignal?.recorded && <span className="dg-grid-item-detail">{voiceSignal.duration_ms}ms</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Reaction</span><span className={`dg-badge ${reactionSignal?.quality === 'ok' ? 'dg-badge-ok' : reactionSignal?.quality === 'low' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{reactionSignal?.quality ?? '—'}</span></div>
              {reactionSignal?.reaction_ms != null && <span className="dg-grid-item-detail">Avg {reactionSignal.reaction_ms}ms</span>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 2. Progress Rings ═══ */}
      {quality && (phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error') && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Progress Rings</h3>
          <div className="dg-rings">
            {[
              { label: 'Sensors', value: sensorScore, color: '#06b6d4' },
              { label: 'Cognitive', value: cognitiveScore, color: '#8b5cf6' },
              { label: 'Voice', value: voiceScore, color: '#10b981' },
            ].map((ring) => {
              const circumference = 2 * Math.PI * 28;
              const offset = circumference - (ring.value / 100) * circumference;
              return (
                <div key={ring.label} className="dg-ring">
                  <svg className="dg-ring-svg" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(56,189,248,0.1)" strokeWidth="4" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke={ring.color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 32 32)" />
                    <text x="32" y="36" textAnchor="middle" className="dg-ring-value">{ring.value}</text>
                  </svg>
                  <span className="dg-ring-label">{ring.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ 4. Cognitive Science Summary ═══ */}
      {cogSummary && (phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error') && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Cognitive Science</h3>
          <div className="dg-row"><span className="dg-row-label">Modules</span><span className="dg-row-value">{cogSummary.completed_modules} / {cogSummary.total_modules}</span></div>
          <div className="dg-row"><span className="dg-row-label">Depth</span><span className="dg-row-value" style={{ color: cogSummary.depth_score >= 0.65 ? 'var(--dg-green)' : 'var(--dg-amber)' }}>{(cogSummary.depth_score * 100).toFixed(0)}%</span></div>
          <div className="dg-row"><span className="dg-row-label">Consistency</span><span className="dg-row-value">{(cogSummary.consistency_score * 100).toFixed(0)}%</span></div>
          <div className="dg-row"><span className="dg-row-label">Anomaly</span><span className="dg-row-value" style={{ color: cogSummary.anomaly_score < 0.3 ? 'var(--dg-green)' : cogSummary.anomaly_score < 0.5 ? 'var(--dg-amber)' : 'var(--dg-red)' }}>{cogSummary.anomaly_score < 0.3 ? 'low' : cogSummary.anomaly_score < 0.5 ? 'medium' : 'high'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Human likelihood</span><span className={`dg-badge ${cogSummary.human_likelihood === 'high' ? 'dg-badge-ok' : cogSummary.human_likelihood === 'medium' ? 'dg-badge-review' : 'dg-badge-failed'}`}>{cogSummary.human_likelihood}</span></div>
          <div className={`dg-interp ${cogSummary.human_likelihood === 'high' ? 'dg-interp-strong' : cogSummary.human_likelihood === 'medium' ? 'dg-interp-medium' : 'dg-interp-weak'}`}>
            {cogSummary.human_likelihood === 'high'
              ? 'Cognitive profile strongly suggests human liveness across multiple domains.'
              : cogSummary.human_likelihood === 'medium'
              ? 'Cognitive profile is ambiguous — some modules show non-human patterns.'
              : 'Cognitive profile shows significant anomaly — review recommended.'}
          </div>
        </div>
      )}

      {/* ═══ 6. Voice Integrity Panel ═══ */}
      {reconciledVocalDiag && (phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error') && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Voice Integrity</h3>
          <div className="dg-row"><span className="dg-row-label">Audio pipeline</span><span className={`dg-badge ${reconciledVocalDiag.audioPipelineStatus === 'captured' ? 'dg-badge-ok' : reconciledVocalDiag.audioPipelineStatus === 'missing' ? 'dg-badge-missing' : reconciledVocalDiag.audioPipelineStatus === 'permission_denied' ? 'dg-badge-failed' : 'dg-badge-unsupported'}`}>{reconciledVocalDiag.audioPipelineStatus}</span></div>
          <div className="dg-row"><span className="dg-row-label">Analysis mode</span><span className="dg-row-value">{reconciledVocalDiag.analysisMode.replace(/_/g, ' ')}</span></div>
          <div className="dg-row"><span className="dg-row-label">Audio captured</span><span className={`dg-badge ${reconciledVocalDiag.audioCaptured ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{reconciledVocalDiag.audioCaptured ? 'YES' : 'NO'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Payload prepared</span><span className={`dg-badge ${reconciledVocalDiag.payloadPrepared ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{reconciledVocalDiag.payloadPrepared ? 'YES' : 'NO'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Relay attempted</span><span className={`dg-badge ${reconciledVocalDiag.relayAttempted ? 'dg-badge-ok' : 'dg-badge-skipped'}`}>{reconciledVocalDiag.relayAttempted ? 'YES' : 'NO'}</span></div>
          {reconciledVocalDiag.relayAttempted && <div className="dg-row"><span className="dg-row-label">Relay accepted</span><span className={`dg-badge ${reconciledVocalDiag.relayAccepted ? 'dg-badge-ok' : 'dg-badge-failed'}`}>{reconciledVocalDiag.relayAccepted ? 'YES' : 'NO'}</span></div>}
          <div className="dg-row"><span className="dg-row-label">Analyzed (HCS)</span><span className={`dg-badge ${reconciledVocalDiag.analyzed ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{reconciledVocalDiag.analyzed ? 'YES' : 'NO'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Vocal status</span><span className={`dg-badge ${reconciledVocalDiag.vocalStatus === 'passed' ? 'dg-badge-ok' : reconciledVocalDiag.vocalStatus === 'failed' ? 'dg-badge-failed' : reconciledVocalDiag.vocalStatus === 'review' ? 'dg-badge-review' : 'dg-badge-skipped'}`}>{reconciledVocalDiag.vocalStatus}</span></div>
          {reconciledVocalDiag.durationMs != null && <div className="dg-row"><span className="dg-row-label">Duration</span><span className="dg-row-value">{reconciledVocalDiag.durationMs} ms</span></div>}
          <div className="dg-row"><span className="dg-row-label">Size bucket</span><span className="dg-row-value">{reconciledVocalDiag.audioSizeBucket}</span></div>
          {reconciledVocalDiag.confidenceLevel && <div className="dg-row"><span className="dg-row-label">Confidence</span><span className="dg-row-value">{reconciledVocalDiag.confidenceLevel}</span></div>}
          <div className="dg-row"><span className="dg-row-label">Reason</span><span className="dg-row-value dg-row-value-mono">{reconciledVocalDiag.reasonSafe}</span></div>
          {reconciledVocalDiag.latencyMs != null && <div className="dg-row"><span className="dg-row-label">Latency</span><span className="dg-row-value">{reconciledVocalDiag.latencyMs} ms</span></div>}
          {vocalWording && (
            <div className={`dg-interp ${reconciledVocalDiag.vocalStatus === 'passed' ? 'dg-interp-strong' : 'dg-interp-medium'}`}>{vocalWording}</div>
          )}
        </div>
      )}

      {/* ═══ 7. Hybrid Vector Decision Panel ═══ */}
      {response && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Hybrid Vector Decision</h3>
          {response.traceId && <div className="dg-row"><span className="dg-row-label">Trace ID</span><span className="dg-row-value dg-row-value-mono">{response.traceId.slice(0, 16)}…</span></div>}
          <div className="dg-row"><span className="dg-row-label">Received</span><span className={`dg-badge ${response.received ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{response.received ? 'YES' : 'NO'}</span></div>
          {response.quality_score != null && <div className="dg-row"><span className="dg-row-label">Quality score</span><span className="dg-row-value">{(response.quality_score * 100).toFixed(0)}%</span></div>}
          <div className="dg-row"><span className="dg-row-label">Ready</span><span className={`dg-badge ${response.ready ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{response.ready ? 'YES' : 'NO'}</span></div>
          {response.hybridFusion && (
            <>
              <div className="dg-row"><span className="dg-row-label">Fusion triggered</span><span className={`dg-badge ${response.hybridFusion.triggered ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{response.hybridFusion.triggered ? 'YES' : 'NO'}</span></div>
              {response.hybridFusion.globalDecision && <div className="dg-row"><span className="dg-row-label">Global decision</span><span className={`dg-badge ${response.hybridFusion.globalDecision === 'ACCEPT' ? 'dg-badge-ok' : response.hybridFusion.globalDecision === 'REVIEW' ? 'dg-badge-review' : 'dg-badge-failed'}`}>{response.hybridFusion.globalDecision}</span></div>}
              {response.hybridFusion.trustLevel && <div className="dg-row"><span className="dg-row-label">Trust level</span><span className="dg-row-value">{response.hybridFusion.trustLevel}</span></div>}
              {response.hybridFusion.cognitiveStatus && <div className="dg-row"><span className="dg-row-label">Cognitive</span><span className={`dg-badge ${response.hybridFusion.cognitiveStatus === 'passed' ? 'dg-badge-ok' : response.hybridFusion.cognitiveStatus === 'review' ? 'dg-badge-review' : 'dg-badge-failed'}`}>{response.hybridFusion.cognitiveStatus}</span></div>}
              {response.hybridFusion.vocalStatus && <div className="dg-row"><span className="dg-row-label">Vocal</span><span className={`dg-badge ${response.hybridFusion.vocalStatus === 'passed' ? 'dg-badge-ok' : response.hybridFusion.vocalStatus === 'review' ? 'dg-badge-review' : 'dg-badge-failed'}`}>{response.hybridFusion.vocalStatus}</span></div>}
            </>
          )}
          {responseMessage && (
            <div className={`dg-interp ${response.status === 'submitted' ? 'dg-interp-strong' : response.status === 'review' ? 'dg-interp-medium' : 'dg-interp-weak'}`}>{responseMessage}</div>
          )}
        </div>
      )}

      {/* ═══ 8. Brain / Monitoring Panel ═══ */}
      {response?.hybridFusion && (monitoringLabel || response.hybridFusion.vocalDiagnostic) && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Brain / Monitoring</h3>
          {monitoringLabel && (
            <div className="dg-row"><span className="dg-row-label">Monitoring</span><span className={`dg-badge ${monitoringLabel === 'Recorded' ? 'dg-badge-ok' : monitoringLabel === 'Pending' ? 'dg-badge-pending' : 'dg-badge-failed'}`}>{monitoringLabel}</span></div>
          )}
          {response.hybridFusion.vocalDiagnostic && (
            <>
              <div className="dg-row"><span className="dg-row-label">Vocal relay</span><span className={`dg-badge ${response.hybridFusion.vocalDiagnostic.relayAttempted ? 'dg-badge-ok' : 'dg-badge-skipped'}`}>{response.hybridFusion.vocalDiagnostic.relayAttempted ? 'ATTEMPTED' : 'SKIPPED'}</span></div>
              {response.hybridFusion.vocalDiagnostic.relayAttempted && <div className="dg-row"><span className="dg-row-label">Relay accepted</span><span className={`dg-badge ${response.hybridFusion.vocalDiagnostic.relayAccepted ? 'dg-badge-ok' : 'dg-badge-failed'}`}>{response.hybridFusion.vocalDiagnostic.relayAccepted ? 'YES' : 'NO'}</span></div>}
              <div className="dg-row"><span className="dg-row-label">HCS analyzed</span><span className={`dg-badge ${response.hybridFusion.vocalDiagnostic.analyzed ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{response.hybridFusion.vocalDiagnostic.analyzed ? 'YES' : 'NO'}</span></div>
              {response.hybridFusion.vocalDiagnostic.latencyMs != null && <div className="dg-row"><span className="dg-row-label">Latency</span><span className="dg-row-value">{response.hybridFusion.vocalDiagnostic.latencyMs} ms</span></div>}
            </>
          )}
        </div>
      )}

      {/* Warnings (shown during readiness) */}
      {quality && phase === 'readiness' && submitWarnings.length > 0 && (
        <div className="dg-card">
          {submitWarnings.map((w, i) => (
            <div key={i} className="dg-warning-box" style={{ marginBottom: i < submitWarnings.length - 1 ? 8 : 0 }}>{w}</div>
          ))}
        </div>
      )}

      {/* Error display */}
      {error && phase === 'error' && (
        <div className="dg-error-box">
          {error}
          <div style={{ marginTop: 12 }}>
            <button onClick={handleSubmit} className="dg-btn dg-btn-danger" style={{ width: '100%' }}>Retry Submit</button>
          </div>
        </div>
      )}

      {/* Success display */}
      {response && phase === 'done' && (
        <div className="dg-success-box">
          DemoGuard session submitted successfully. {responseMessage ?? ''}
        </div>
      )}

      {/* ═══ 9. Sticky Bottom Action Bar ═══ */}
      <div className="dg-sticky-bar">
        <div className="dg-sticky-status">
          {submitBlockReasons.length > 0 ? (
            <>
              <span className="dg-sticky-status-label" style={{ color: 'var(--dg-red)' }}>Blocked</span>
              <span className="dg-sticky-status-detail">{submitBlockReasons[0]}</span>
            </>
          ) : isSubmitting ? (
            <>
              <span className="dg-sticky-status-label">Submitting</span>
              <span className="dg-sticky-status-detail">Sending to Hybrid Vector...</span>
            </>
          ) : isSubmitted ? (
            <>
              <span className="dg-sticky-status-label" style={{ color: 'var(--dg-green)' }}>Submitted</span>
              <span className="dg-sticky-status-detail">{response?.hybridFusion?.globalDecision ?? response?.status ?? 'Done'}</span>
            </>
          ) : phase === 'readiness' ? (
            <>
              <span className="dg-sticky-status-label">Ready to submit</span>
              <span className="dg-sticky-status-detail">{submitWarnings.length > 0 ? `${submitWarnings.length} warning(s)` : 'All signals collected'}</span>
            </>
          ) : phase !== 'idle' ? (
            <>
              <span className="dg-sticky-status-label">Collecting</span>
              <span className="dg-sticky-status-detail">Phase: {phase.replace(/-/g, ' ')}</span>
            </>
          ) : (
            <>
              <span className="dg-sticky-status-label">Idle</span>
              <span className="dg-sticky-status-detail">Enter session ID to begin</span>
            </>
          )}
        </div>
        <div className="dg-sticky-actions">
          {phase === 'error' ? (
            <button onClick={handleSubmit} disabled={isSubmitting} className="dg-btn dg-btn-danger">Retry</button>
          ) : isSubmitted ? (
            response?.traceId ? (
              <button onClick={() => navigator.clipboard?.writeText(response.traceId!)} className="dg-btn dg-btn-secondary">Copy Trace</button>
            ) : null
          ) : phase === 'readiness' && canSubmit ? (
            <button onClick={handleSubmit} disabled={isSubmitting} className="dg-btn dg-btn-primary">
              {isSubmitting ? <span className="dg-spinner" /> : 'Submit'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
