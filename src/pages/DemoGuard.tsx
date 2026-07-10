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
      if (result.sensitive) {
        Object.assign(sensitiveRef.current, result.sensitive);
      }
    } catch (err) {
      setVoiceSignal({ recorded: false, quality: 'missing', challenge_id: voiceChallengeId });
      setError(err instanceof Error ? err.message : 'Voice recording failed');
    } finally {
      setVoiceRecording(false);
      setPhase('cognitive-intro');
    }
  }, [voiceChallengeId]);

  const handleSkipVoice = useCallback(() => {
    setVoiceSignal({ recorded: false, quality: 'missing', challenge_id: voiceChallengeId });
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

      {/* ═══ Cognitive Battery ═══ */}

      {/* Cognitive Reflex (phase: cognitive-intro) */}
      {phase === 'cognitive-intro' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cognitive Battery — Reflex</h3>
          <p style={{ color: 'var(--secondary-label)', fontSize: 14, marginBottom: 8 }}>
            Tour {cogReflexRound + 1} sur {COG_REFLEX_ROUNDS}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            {Array.from({ length: COG_REFLEX_ROUNDS }).map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: 5,
                background: i < cogReflexResults.length ? 'var(--green)' : i === cogReflexRound ? 'var(--blue)' : 'var(--separator)',
              }} />
            ))}
          </div>
          <button
            onClick={handleCogReflexTap}
            style={{
              width: '100%', height: 180, borderRadius: 20, border: 'none',
              background: cogReflexPhase === 'go' ? '#34c759' : cogReflexPhase === 'wait' ? '#b91c1c' : cogReflexPhase === 'too_early' ? '#ff9f0a' : '#2563eb',
              color: '#ffffff', fontSize: 24, fontWeight: 800, cursor: 'pointer', touchAction: 'manipulation',
            }}
          >
            {cogReflexPhase === 'ready' ? 'DÉMARRER' : cogReflexPhase === 'wait' ? 'ATTENDEZ' : cogReflexPhase === 'go' ? 'APPUYEZ' : cogReflexPhase === 'too_early' ? 'TROP TÔT' : 'Terminé'}
          </button>
          {cogLastReflexMs !== null && cogReflexPhase === 'ready' && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--green)' }}>Dernier : {cogLastReflexMs} ms</p>
          )}
          <div style={{ marginTop: 16 }}>
            <Button onClick={handleSkipCogReflex} variant="secondary">Skip Reflex</Button>
          </div>
        </div>
      )}

      {/* Cognitive Stroop */}
      {phase === 'cognitive-stroop' && stroopTrials.length > 0 && stroopIndex < stroopTrials.length && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cognitive Battery — Stroop</h3>
          <p style={{ color: 'var(--secondary-label)', fontSize: 14, marginBottom: 16 }}>
            Trial {stroopIndex + 1} / {stroopTrials.length} — Sélectionnez la COULEUR affichée
          </p>
          <div style={{
            fontSize: 48, fontWeight: 900, marginBottom: 24,
            color: stroopTrials[stroopIndex].displayColor === 'red' ? '#ef4444' : stroopTrials[stroopIndex].displayColor === 'blue' ? '#3b82f6' : stroopTrials[stroopIndex].displayColor === 'green' ? '#22c55e' : '#eab308',
          }}>
            {stroopTrials[stroopIndex].word.toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {STROOP_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleStroopSelect(color)}
                style={{
                  width: 72, height: 72, borderRadius: 12, border: 'none',
                  background: color === 'red' ? '#ef4444' : color === 'blue' ? '#3b82f6' : color === 'green' ? '#22c55e' : '#eab308',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
                }}
              >
                {color}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button onClick={handleSkipStroop} variant="secondary">Skip Stroop</Button>
          </div>
        </div>
      )}

      {/* Cognitive Digit Span */}
      {phase === 'cognitive-digit-span' && digitSpanTrials.length > 0 && digitSpanIndex < digitSpanTrials.length && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cognitive Battery — Digit Span</h3>
          <p style={{ color: 'var(--secondary-label)', fontSize: 14, marginBottom: 16 }}>
            Trial {digitSpanIndex + 1} / {digitSpanTrials.length} — {digitSpanTrials[digitSpanIndex].span} digits
          </p>
          {digitSpanShowDigits ? (
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 8, marginBottom: 24 }}>
              {digitSpanTrials[digitSpanIndex].sequence.join(' ')}
            </div>
          ) : (
            <>
              <p style={{ marginBottom: 16, fontSize: 14 }}>Retapez la séquence :</p>
              <input
                type="text"
                inputMode="numeric"
                value={digitSpanInput}
                onChange={(e) => setDigitSpanInput(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%', height: 48, borderRadius: 10, fontSize: 24, textAlign: 'center',
                  border: '1px solid var(--separator)', padding: '0 12px', marginBottom: 16,
                  background: 'var(--background)', color: 'var(--label)', letterSpacing: 4,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={handleDigitSpanSubmit} disabled={!digitSpanInput}>Submit</Button>
                <Button onClick={handleSkipDigitSpan} variant="secondary">Skip</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Cognitive N-Back */}
      {phase === 'cognitive-nback' && nbackTrials.length > 0 && nbackIndex < nbackTrials.length && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cognitive Battery — N-Back (1-back)</h3>
          <p style={{ color: 'var(--secondary-label)', fontSize: 14, marginBottom: 16 }}>
            Trial {nbackIndex + 1} / {nbackTrials.length} — Identique au précédent ?
          </p>
          <div style={{ fontSize: 64, fontWeight: 900, marginBottom: 24 }}>
            {nbackTrials[nbackIndex].letter}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => handleNBackResponse(true)}
              style={{
                width: 120, height: 64, borderRadius: 12, border: 'none',
                background: '#22c55e', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
              }}
            >OUI (Match)</button>
            <button
              onClick={() => handleNBackResponse(false)}
              style={{
                width: 120, height: 64, borderRadius: 12, border: 'none',
                background: '#6b7280', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
              }}
            >NON</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button onClick={handleSkipNBack} variant="secondary">Skip N-Back</Button>
          </div>
        </div>
      )}

      {/* Cognitive Trail Tap */}
      {phase === 'cognitive-trail-tap' && trailNodes.length > 0 && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cognitive Battery — Trail Tap</h3>
          <p style={{ color: 'var(--secondary-label)', fontSize: 14, marginBottom: 16 }}>
            Tapez les points dans l'ordre 1 → {trailNodes.length}
          </p>
          <div style={{ position: 'relative', width: 300, height: 400, margin: '0 auto', border: '1px solid var(--separator)', borderRadius: 12, background: 'var(--background)' }}>
            {trailNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => handleTrailTap(node.id)}
                style={{
                  position: 'absolute',
                  left: node.x, top: node.y,
                  width: 44, height: 44, borderRadius: 22, border: '2px solid var(--blue)',
                  background: 'var(--background)', color: 'var(--label)',
                  fontSize: 18, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
                }}
              >
                {node.id}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button onClick={handleSkipTrailTap} variant="secondary">Skip Trail Tap</Button>
          </div>
        </div>
      )}

      {/* Cognitive Vocal RAN */}
      {phase === 'cognitive-vocal-ran' && vocalRanChallenge && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cognitive Battery — Vocal RAN</h3>
          <p style={{ color: 'var(--secondary-label)', fontSize: 14, marginBottom: 16 }}>
            Lisez les chiffres suivants à voix haute, dans l'ordre :
          </p>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 12, marginBottom: 24 }}>
            {vocalRanChallenge.sequence.join(' ')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button onClick={handleVocalRanRecord} disabled={vocalRanRecording}>
              {vocalRanRecording ? 'Recording...' : 'Record'}
            </Button>
            <Button onClick={handleSkipVocalRan} variant="secondary" disabled={vocalRanRecording}>Skip</Button>
          </div>
        </div>
      )}

      {/* Cognitive Summary */}
      {phase === 'cognitive-summary' && cogSummary && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Cognitive Proof Summary</h3>
          <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--secondary-label)' }}>Modules completed:</span>
              <span style={{ fontWeight: 600 }}>{cogSummary.completed_modules} / {cogSummary.total_modules}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--secondary-label)' }}>Cognitive depth:</span>
              <span style={{ fontWeight: 600, color: cogSummary.depth_score >= 0.65 ? 'var(--green)' : '#eab308' }}>
                {(cogSummary.depth_score * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--secondary-label)' }}>Consistency:</span>
              <span style={{ fontWeight: 600 }}>{(cogSummary.consistency_score * 100).toFixed(0)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--secondary-label)' }}>Anomaly:</span>
              <span style={{ fontWeight: 600, color: cogSummary.anomaly_score < 0.3 ? 'var(--green)' : cogSummary.anomaly_score < 0.5 ? '#eab308' : '#ef4444' }}>
                {cogSummary.anomaly_score < 0.3 ? 'low' : cogSummary.anomaly_score < 0.5 ? 'medium' : 'high'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--secondary-label)' }}>Human likelihood:</span>
              <span style={{ fontWeight: 600, color: cogSummary.human_likelihood === 'high' ? 'var(--green)' : cogSummary.human_likelihood === 'medium' ? '#eab308' : '#ef4444' }}>
                {cogSummary.human_likelihood}
              </span>
            </div>
            {cogSummary.depth_score < 0.65 && (
              <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(234, 179, 8, 0.1)', fontSize: 13, color: '#eab308' }}>
                ⚠️ Cognitive depth is low ({(cogSummary.depth_score * 100).toFixed(0)}% below 65%). Submit with caution.
              </div>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button onClick={handleCognitiveContinue}>Continue to device signals</Button>
          </div>
        </div>
      )}

      {/* Cognitive module results (shown after battery) */}
      {cogReflexSignal && phase !== 'cognitive-intro' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Reflex: {cogReflexSignal.quality === 'ok' ? '✅' : cogReflexSignal.quality === 'review' ? '⚠️' : '❌'}</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Avg: {cogReflexSignal.avg_ms} ms | Median: {cogReflexSignal.median_ms} ms</span>
            <span>Too fast: {cogReflexSignal.too_fast_count} | Too slow: {cogReflexSignal.too_slow_count}</span>
            <span>Regularity: {cogReflexSignal.regularity_score}</span>
          </div>
        </div>
      )}

      {cogStroopSignal && phase !== 'cognitive-stroop' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Stroop: {cogStroopSignal.quality === 'ok' ? '✅' : cogStroopSignal.quality === 'review' ? '⚠️' : '❌'}</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
            <span>Accuracy: {(cogStroopSignal.accuracy * 100).toFixed(0)}% | Conflict cost: {cogStroopSignal.conflict_cost_ms} ms</span>
          </div>
        </div>
      )}

      {cogDigitSpanSignal && phase !== 'cognitive-digit-span' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Digit Span: {cogDigitSpanSignal.quality === 'ok' ? '✅' : cogDigitSpanSignal.quality === 'review' ? '⚠️' : '❌'}</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
            <span>Max span: {cogDigitSpanSignal.max_span} | Accuracy: {(cogDigitSpanSignal.accuracy * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {cogNBackSignal && phase !== 'cognitive-nback' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>N-Back: {cogNBackSignal.quality === 'ok' ? '✅' : cogNBackSignal.quality === 'review' ? '⚠️' : '❌'}</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
            <span>Hits: {cogNBackSignal.hits} | FP: {cogNBackSignal.false_positives} | Misses: {cogNBackSignal.misses}</span>
          </div>
        </div>
      )}

      {cogTrailTapSignal && phase !== 'cognitive-trail-tap' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Trail Tap: {cogTrailTapSignal.quality === 'ok' ? '✅' : cogTrailTapSignal.quality === 'review' ? '⚠️' : '❌'}</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
            <span>Completion: {cogTrailTapSignal.completion_ms} ms | Wrong: {cogTrailTapSignal.wrong_taps} | Efficiency: {cogTrailTapSignal.path_efficiency}</span>
          </div>
        </div>
      )}

      {cogVocalRanSignal && phase !== 'cognitive-vocal-ran' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Vocal RAN: {cogVocalRanSignal.quality === 'ok' ? '✅' : cogVocalRanSignal.quality === 'review' ? '⚠️' : '❌'}</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)' }}>
            <span>Duration: {cogVocalRanSignal.duration_ms} ms | Audio: {cogVocalRanSignal.audio_present ? '✅' : '❌'}</span>
          </div>
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

      {/* Step 6: Sensor readiness (separate from cognitive) */}
      {quality && (phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error') && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Sensor Readiness</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Completeness: {(completeness * 100).toFixed(0)}%</span>
            <span>Device ready: {quality.device_ready ? '✅' : '❌'}</span>
            <span>Permissions ready: {quality.permissions_ready ? '✅' : '❌'}</span>
            <span>Overall ready: {quality.overall_ready ? '✅' : '❌'}</span>
          </div>
        </div>
      )}

      {/* Cognitive depth summary (shown alongside sensor readiness) */}
      {cogSummary && (phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error') && (
        <div style={{ borderRadius: 10, border: '1px solid var(--separator)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Cognitive Depth</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Modules: {cogSummary.completed_modules} / {cogSummary.total_modules}</span>
            <span>Depth: {(cogSummary.depth_score * 100).toFixed(0)}%</span>
            <span>Consistency: {(cogSummary.consistency_score * 100).toFixed(0)}%</span>
            <span>Human likelihood: {cogSummary.human_likelihood}</span>
          </div>
        </div>
      )}

      {/* Step 7: Submit with cognitive depth warning */}
      {quality && phase === 'readiness' && (
        <div>
          {cogSummary && cogSummary.depth_score < 0.65 && (
            <div style={{ marginBottom: 8, padding: 10, borderRadius: 8, background: 'rgba(234, 179, 8, 0.1)', fontSize: 13, color: '#eab308' }}>
              ⚠️ Cognitive depth is low ({(cogSummary.depth_score * 100).toFixed(0)}% below 65%). Submit with caution.
            </div>
          )}
          {cogSummary && cogSummary.completed_modules < 4 && (
            <div style={{ marginBottom: 8, padding: 10, borderRadius: 8, background: 'rgba(234, 179, 8, 0.1)', fontSize: 13, color: '#eab308' }}>
              ⚠️ Only {cogSummary.completed_modules} cognitive modules completed. Recommended: 4+.
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!sessionPublicId.trim()}
            variant="secondary"
          >
            Submit DemoGuard
          </Button>
        </div>
      )}

      {/* Step 8: Safe response */}
      {response && (
        <div style={{ borderRadius: 10, border: '1px solid var(--green)', padding: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Response</h3>
          <div style={{ fontSize: 13, color: 'var(--secondary-label)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Received: {response.received ? '✅' : '❌'}</span>
            {response.traceId && <span>Trace ID: {response.traceId}</span>}
            {response.quality_score != null && <span>Quality score: {(response.quality_score * 100).toFixed(0)}%</span>}
            <span>Ready: {response.ready ? '✅' : '❌'}</span>
            {response.message && <span>Message: {response.message}</span>}
            {response.hybridFusion && (
              <>
                <span>Fusion: {response.hybridFusion.triggered ? '✅' : '❌'}{response.hybridFusion.globalDecision ? ` | ${response.hybridFusion.globalDecision}` : ''}</span>
                {response.hybridFusion.trustLevel && <span>Trust level: {response.hybridFusion.trustLevel}</span>}
                {response.hybridFusion.cognitiveStatus && <span>Cognitive: {response.hybridFusion.cognitiveStatus}</span>}
                {response.hybridFusion.vocalStatus && <span>Vocal: {response.hybridFusion.vocalStatus}</span>}
                {response.hybridFusion.monitoringStatus != null && (
                  <span>Monitoring: {response.hybridFusion.monitoringStatus === 'recorded' ? '✅ Recorded' : response.hybridFusion.monitoringStatus === 'pending' ? '⏳ Pending' : '❌ Failed'}</span>
                ) || response.hybridFusion.monitoringRecorded != null && (
                  <span>Monitoring: {response.hybridFusion.monitoringRecorded ? '✅ Recorded' : '❌ Not recorded'}</span>
                )}
              </>
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
