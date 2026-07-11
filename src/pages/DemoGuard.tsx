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
import { VOICE_KEY } from '../demoguard/types';
import { requestCamera, stopCamera, captureSelfieFromVideo } from '../demoguard/collectors/cameraCollector';
import { recordVoiceChallenge, generateChallengeId, generateChallengePhrase } from '../demoguard/collectors/audioCollector';
import { collectMotion, requestMotionPermission } from '../demoguard/collectors/motionCollector';
import { collectOrientation, requestOrientationPermission } from '../demoguard/collectors/orientationCollector';
import { collectTouch } from '../demoguard/collectors/touchCollector';
import { collectVisibility } from '../demoguard/collectors/visibilityCollector';
import { collectNetwork } from '../demoguard/collectors/networkCollector';
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
  generateStroopPracticeTrials,
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
  generateNBackPracticeTrials,
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
import { computeCognitiveSummary } from '../demoguard/cognitive/cognitiveScoring';
import {
  getTouchBehaviorCollector,
  resetTouchBehaviorCollector,
} from '../demoguard/behavior/touchBehaviorCollector';
import {
  recordTaskStart,
  recordReflexTap,
  recordStroopSelection,
  recordDigitSpanKey,
  recordDigitSpanSubmit,
  recordNBackDecision,
  recordTrailTap,
} from '../demoguard/behavior/taskBehaviorRecorder';
import type { BehaviorSummary, TouchDiagnosticsBehaviorSafe } from '../demoguard/behavior/behaviorTypes';

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
  behaviorDiag: TouchDiagnosticsBehaviorSafe | null,
): TouchDiagnosticsSafe {
  if (behaviorDiag) {
    return {
      status: behaviorDiag.status,
      supported: behaviorDiag.supported,
      interactionCount: behaviorDiag.interactionCount,
      quality: behaviorDiag.quality,
      reasonSafe: behaviorDiag.reasonSafe,
    };
  }
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

type Phase = 'idle' | 'prep' | 'camera' | 'cognitive-intro' | 'cognitive-stroop' | 'cognitive-digit-span' | 'cognitive-nback' | 'cognitive-trail-tap' | 'voice-proof' | 'review' | 'device-signals' | 'readiness' | 'submitting' | 'done' | 'error';

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

  // Voice state
  const [voiceChallengeId] = useState(() => generateChallengeId());
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceDiagnostic, setVoiceDiagnostic] = useState<DemoGuardVoiceDiagnostic | null>(null);
  const [voiceCountdown, setVoiceCountdown] = useState<number | null>(null);
  const [voiceRetakeUsed, setVoiceRetakeUsed] = useState(false);
  const [voiceCaptured, setVoiceCaptured] = useState(false);
  const voiceCountdownTimerRef = useRef<number | null>(null);

  // ── Cognitive battery state ──
  const [cogReflexSignal, setCogReflexSignal] = useState<ReflexSignal | null>(null);
  const [cogStroopSignal, setCogStroopSignal] = useState<StroopSignal | null>(null);
  const [cogDigitSpanSignal, setCogDigitSpanSignal] = useState<DigitSpanSignal | null>(null);
  const [cogNBackSignal, setCogNBackSignal] = useState<NBackSignal | null>(null);
  const [cogTrailTapSignal, setCogTrailTapSignal] = useState<TrailTapSignal | null>(null);
  const [cogSummary, setCogSummary] = useState<CognitiveSummary | null>(null);
  const [behaviorSummary, setBehaviorSummary] = useState<BehaviorSummary | null>(null);

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

  // Stroop practice state
  const [stroopPracticeTrials, setStroopPracticeTrials] = useState<StroopTrialConfig[]>([]);
  const [stroopPracticeIndex, setStroopPracticeIndex] = useState(0);
  const [stroopPracticeMode, setStroopPracticeMode] = useState(false);
  const [stroopPracticeFeedback, setStroopPracticeFeedback] = useState<string | null>(null);

  // N-Back practice state
  const [nbackPracticeTrials, setNbackPracticeTrials] = useState<NBackTrialConfig[]>([]);
  const [nbackPracticeIndex, setNbackPracticeIndex] = useState(0);
  const [nbackPracticeMode, setNbackPracticeMode] = useState(false);
  const [nbackPracticeFeedback, setNbackPracticeFeedback] = useState<string | null>(null);

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
    setBehaviorSummary(null);
    resetTouchBehaviorCollector();
    sensitiveRef.current = {};
    try {
      setPhase('prep');
      const dev = collectDeviceContext();
      setDevice(dev);

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
        setPhase('cognitive-intro');
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
    setPhase('cognitive-intro');
    setCogReflexPhase('ready');
    setCogReflexRound(0);
    setCogReflexResults([]);
  }, [cameraReady]);

  const handleSkipCamera = useCallback(() => {
    stopCamera(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraReady(false);
    setSelfieSignal({ captured: false, quality: 'missing' });
    setPhase('cognitive-intro');
    setCogReflexPhase('ready');
    setCogReflexRound(0);
    setCogReflexResults([]);
  }, []);

  // ── Finish to review (computes cognitive + behavior summaries) ──
  const finishToReview = useCallback(() => {
    const cogSignals: CognitiveSignals = {
      reflex: cogReflexSignal,
      stroop: cogStroopSignal,
      digit_span: cogDigitSpanSignal,
      n_back: cogNBackSignal,
      trail_tap: cogTrailTapSignal,
      vocal_ran: null,
      summary: null,
    };
    const summary = computeCognitiveSummary(cogSignals);
    cogSignals.summary = summary;
    setCogSummary(summary);
    const bhSummary = getTouchBehaviorCollector().getSummary();
    setBehaviorSummary(bhSummary);
    setPhase('review');
  }, [cogReflexSignal, cogStroopSignal, cogDigitSpanSignal, cogNBackSignal, cogTrailTapSignal]);

  // ── Voice proof (single capture) ──
  const handleStartVoiceCountdown = useCallback(() => {
    setVoiceCountdown(3);
    setVoiceCaptured(false);
    setVoiceSignal(null);
    setVoiceDiagnostic(null);
    delete sensitiveRef.current[VOICE_KEY];
    let count = 3;
    voiceCountdownTimerRef.current = window.setInterval(() => {
      count--;
      if (count <= 0) {
        if (voiceCountdownTimerRef.current) window.clearInterval(voiceCountdownTimerRef.current);
        voiceCountdownTimerRef.current = null;
        setVoiceCountdown(null);
        handleRecordVoice();
      } else {
        setVoiceCountdown(count);
      }
    }, 1000);
  }, []);

  const handleRecordVoice = useCallback(async () => {
    setVoiceRecording(true);
    setError(null);
    try {
      const result = await recordVoiceChallenge(4000, voiceChallengeId);
      setVoiceSignal(result.safe);
      setVoiceDiagnostic(result.diagnostic);
      if (result.sensitive) {
        sensitiveRef.current[VOICE_KEY] = result.sensitive.voice_b64;
        if (result.sensitive.mfcc_summary) {
          sensitiveRef.current.mfcc_summary = result.sensitive.mfcc_summary;
        }
      }
      setVoiceCaptured(true);
    } catch (err) {
      setVoiceSignal({ recorded: false, quality: 'missing', challenge_id: voiceChallengeId });
      setVoiceDiagnostic(null);
      setError(err instanceof Error ? err.message : 'Voice recording failed');
    } finally {
      setVoiceRecording(false);
    }
  }, [voiceChallengeId]);

  const handleSkipVoice = useCallback(() => {
    if (voiceCountdownTimerRef.current) window.clearInterval(voiceCountdownTimerRef.current);
    voiceCountdownTimerRef.current = null;
    setVoiceCountdown(null);
    setVoiceRecording(false);
    setVoiceSignal({ recorded: false, quality: 'missing', challenge_id: voiceChallengeId });
    setVoiceDiagnostic(null);
    setVoiceCaptured(false);
    finishToReview();
  }, [voiceChallengeId, finishToReview]);

  const handleVoiceContinue = useCallback(() => {
    finishToReview();
  }, [finishToReview]);

  const handleVoiceRetake = useCallback(() => {
    if (voiceRetakeUsed) return;
    setVoiceRetakeUsed(true);
    setVoiceCaptured(false);
    setVoiceSignal(null);
    setVoiceDiagnostic(null);
    delete sensitiveRef.current[VOICE_KEY];
    handleStartVoiceCountdown();
  }, [voiceRetakeUsed, handleStartVoiceCountdown]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (voiceCountdownTimerRef.current) window.clearInterval(voiceCountdownTimerRef.current);
    };
  }, []);

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
      recordTaskStart('reflex');
      return;
    }
    if (cogReflexPhase === 'wait') {
      if (cogReflexTimerRef.current) window.clearTimeout(cogReflexTimerRef.current);
      setCogReflexPhase('too_early');
      recordReflexTap(0, true);
      return;
    }
    if (cogReflexPhase === 'go') {
      const ms = performance.now() - cogGoAtRef.current;
      const round = evaluateReflexRound(ms);
      setCogLastReflexMs(round.ms);
      recordReflexTap(round.ms, round.too_fast);
      const next = [...cogReflexResults, round];
      setCogReflexResults(next);
      if (next.length >= COG_REFLEX_ROUNDS) {
        const result = computeReflexResult(next);
        setCogReflexSignal(result);
        setCogReflexPhase('done');
        setPhase('cognitive-stroop');
        setStroopPracticeTrials(generateStroopPracticeTrials());
        setStroopPracticeIndex(0);
        setStroopPracticeMode(true);
        setStroopPracticeFeedback(null);
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
    setStroopPracticeTrials(generateStroopPracticeTrials());
    setStroopPracticeIndex(0);
    setStroopPracticeMode(true);
    setStroopPracticeFeedback(null);
    setStroopTrials(generateStroopTrials(6));
    setStroopIndex(0);
    setStroopResults([]);
  }, []);

  // ── Cognitive Stroop ──
  const handleStroopPracticeSelect = useCallback((color: StroopColor) => {
    if (!stroopPracticeMode || stroopPracticeIndex >= stroopPracticeTrials.length) return;
    if (stroopPracticeIndex === 0) recordTaskStart('stroop');
    const trial = stroopPracticeTrials[stroopPracticeIndex];
    const correct = color === trial.displayColor;
    recordStroopSelection(color, correct, 0, false);
    setStroopPracticeFeedback(correct ? 'Compris ! Continue.' : 'Non — appuie sur la couleur, pas le mot.');
    if (stroopPracticeIndex + 1 >= stroopPracticeTrials.length) {
      window.setTimeout(() => {
        setStroopPracticeMode(false);
        setStroopPracticeFeedback(null);
        stroopStartRef.current = performance.now();
      }, 1500);
    } else {
      window.setTimeout(() => {
        setStroopPracticeIndex((i) => i + 1);
        setStroopPracticeFeedback(null);
      }, 1200);
    }
  }, [stroopPracticeMode, stroopPracticeIndex, stroopPracticeTrials]);

  const handleStroopSelect = useCallback((color: StroopColor) => {
    if (stroopPracticeMode || phase !== 'cognitive-stroop' || stroopIndex >= stroopTrials.length) return;
    if (stroopIndex === 0) recordTaskStart('stroop');
    const rt = performance.now() - stroopStartRef.current;
    const trial = stroopTrials[stroopIndex];
    const result: StroopTrialResult = {
      config: trial,
      selected: color,
      correct: color === trial.displayColor,
      response_ms: Math.round(rt),
    };
    recordStroopSelection(color, color === trial.displayColor, Math.round(rt), false);
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
    if (digitSpanIndex === 0) recordTaskStart('digit_span');
    const trial = digitSpanTrials[digitSpanIndex];
    const input = digitSpanInput.split('').map(Number).filter((n) => !isNaN(n));
    recordDigitSpanSubmit();
    const result = evaluateDigitSpanTrial(trial, input);
    const next = [...digitSpanResults, result];
    setDigitSpanResults(next);
    if (next.length >= digitSpanTrials.length) {
      const sig = computeDigitSpanResult(next);
      setCogDigitSpanSignal(sig);
      setPhase('cognitive-nback');
      setNbackPracticeTrials(generateNBackPracticeTrials());
      setNbackPracticeIndex(0);
      setNbackPracticeMode(true);
      setNbackPracticeFeedback(null);
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
    setNbackPracticeTrials(generateNBackPracticeTrials());
    setNbackPracticeIndex(0);
    setNbackPracticeMode(true);
    setNbackPracticeFeedback(null);
    setNbackTrials(generateNBackTrials(8));
    setNbackIndex(0);
    setNbackResults([]);
  }, []);

  // ── Cognitive N-Back ──
  const handleNBackPracticeResponse = useCallback((saidMatch: boolean) => {
    if (!nbackPracticeMode || nbackPracticeIndex >= nbackPracticeTrials.length) return;
    if (nbackPracticeIndex === 0) recordTaskStart('n_back');
    const trial = nbackPracticeTrials[nbackPracticeIndex];
    const correct = (trial.isTarget && saidMatch) || (!trial.isTarget && !saidMatch);
    recordNBackDecision(correct, 0);
    setNbackPracticeFeedback(correct ? 'Compris ! Continue.' : trial.isTarget ? 'C\'était OUI — même symbole.' : 'C\'était NON — symbole différent.');
    if (nbackPracticeIndex + 1 >= nbackPracticeTrials.length) {
      window.setTimeout(() => {
        setNbackPracticeMode(false);
        setNbackPracticeFeedback(null);
        nbackStartRef.current = performance.now();
      }, 1500);
    } else {
      window.setTimeout(() => {
        setNbackPracticeIndex((i) => i + 1);
        setNbackPracticeFeedback(null);
      }, 1200);
    }
  }, [nbackPracticeMode, nbackPracticeIndex, nbackPracticeTrials]);

  const handleNBackResponse = useCallback((saidMatch: boolean) => {
    if (nbackPracticeMode || phase !== 'cognitive-nback' || nbackIndex >= nbackTrials.length) return;
    if (nbackIndex === 0) recordTaskStart('n_back');
    const rt = performance.now() - nbackStartRef.current;
    const trial = nbackTrials[nbackIndex];
    const result = evaluateNBackTrial(trial, saidMatch, rt);
    const isCorrect = result.isHit || result.isCorrectRejection;
    recordNBackDecision(isCorrect, Math.round(rt));
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
  }, [nbackPracticeMode, phase, nbackIndex, nbackTrials, nbackResults]);

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
      recordTaskStart('trail_tap');
    }
    const expectedId = trailEvents.filter((e) => e.correct).length + 1;
    const correct = nodeId === expectedId;
    let pathSegmentDistance: number | null = null;
    let optimalSegmentDistance: number | null = null;
    const lastCorrectEvent = [...trailEvents].reverse().find((e) => e.correct);
    if (lastCorrectEvent && correct) {
      const prevNode = trailNodes.find((n) => n.id === lastCorrectEvent.nodeId);
      const currNode = trailNodes.find((n) => n.id === nodeId);
      const nextNode = trailNodes.find((n) => n.id === nodeId + 1);
      if (prevNode && currNode) {
        pathSegmentDistance = Math.sqrt((currNode.x - prevNode.x) ** 2 + (currNode.y - prevNode.y) ** 2);
      }
      if (currNode && nextNode) {
        optimalSegmentDistance = Math.sqrt((nextNode.x - currNode.x) ** 2 + (nextNode.y - currNode.y) ** 2);
      }
    }
    recordTrailTap(correct, pathSegmentDistance, optimalSegmentDistance);
    const event: TrailTapEvent = { nodeId, timestamp: now - (trailStartRef.current || now), correct };
    const next = [...trailEvents, event];
    setTrailEvents(next);
    if (correct && expectedId === trailNodes.length) {
      const completionMs = now - trailStartRef.current;
      const sig = computeTrailTapResult(trailNodes, next, completionMs);
      setCogTrailTapSignal(sig);
      setPhase('voice-proof');
    }
  }, [phase, trailEvents, trailNodes]);

  const handleSkipTrailTap = useCallback(() => {
    setCogTrailTapSignal(null);
    setPhase('voice-proof');
  }, []);

  const handleReviewContinue = useCallback(() => {
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
      vocal_ran: null,
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
      behavior: behaviorSummary ? getTouchBehaviorCollector().getPayload() : null,
      touchDiagnosticsBehavior: behaviorSummary ? getTouchBehaviorCollector().getTouchDiagnostics() : undefined,
    };
    const q = computeQuality(signals, device, permissions);
    setQuality(q);
  }, [phase, device, permissions, selfieSignal, reactionSignal, voiceSignal, motionSignal, orientationSignal, touchSignal, visibilitySignal, networkSignal, cogSummary, cogReflexSignal, cogStroopSignal, cogDigitSpanSignal, cogNBackSignal, cogTrailTapSignal, behaviorSummary]);

  // ── Behavior submit guard ──
  const behaviorInteractions = behaviorSummary?.totalInteractions ?? 0;
  const behaviorTouchSupported = getTouchBehaviorCollector().isSupported();
  const behaviorBlocked = (phase === 'readiness' || phase === 'review') && behaviorTouchSupported && behaviorInteractions === 0;

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
    if (behaviorBlocked) {
      setError('Nous n\'avons pas détecté assez d\'interactions tactiles. Refais les tests tactiles avant d\'envoyer.');
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
      vocal_ran: null,
      summary: cogSummary,
    } : null;
    const behaviorPayload = getTouchBehaviorCollector().getPayload();
    const behaviorDiag = getTouchBehaviorCollector().getTouchDiagnostics();
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
      behavior: behaviorPayload,
      voiceDiagnostics: buildVoiceDiagnosticsSafe(voiceSignal, voiceDiagnostic, !!sensitiveRef.current[VOICE_KEY]),
      touchDiagnostics: buildTouchDiagnosticsSafe(touchSignal, behaviorDiag),
      touchDiagnosticsBehavior: behaviorDiag,
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
  }, [sessionPublicId, device, permissions, quality, selfieSignal, reactionSignal, voiceSignal, motionSignal, orientationSignal, touchSignal, visibilitySignal, networkSignal, cogSummary, cogReflexSignal, cogStroopSignal, cogDigitSpanSignal, cogNBackSignal, cogTrailTapSignal, behaviorBlocked, voiceDiagnostic]);

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
  if (behaviorBlocked) submitBlockReasons.push('Pas assez d\'interactions tactiles détectées');

  // ── Submit warnings (not blocking) ──
  const submitWarnings: string[] = [];
  if (voiceSignal && !voiceSignal.recorded) submitWarnings.push('⚠️ Voix manquante — l\'analyse vocale sera ignorée.');
  if (voiceSignal && voiceSignal.recorded && voiceSignal.quality === 'low') submitWarnings.push('⚠️ Qualité vocale faible — envisage de reprendre.');
  if (!voiceSignal) submitWarnings.push('⚠️ Étape vocale non effectuée — l\'analyse vocale sera ignorée.');
  if (motionSignal && motionSignal.quality === 'unsupported') submitWarnings.push('Capteur de mouvement non supporté sur cet appareil');
  if (orientationSignal && orientationSignal.quality === 'unsupported') submitWarnings.push('Capteur d\'orientation non supporté sur cet appareil');
  if (cogSummary && cogSummary.depth_score < 0.65) submitWarnings.push(`Profondeur cognitive faible (${(cogSummary.depth_score * 100).toFixed(0)}%)`);
  if (cogSummary && cogSummary.completed_modules < 4) submitWarnings.push(`Seulement ${cogSummary.completed_modules} modules cognitifs complétés (recommandé: 4+)`);
  if (behaviorInteractions > 0 && behaviorInteractions < 5) submitWarnings.push('⚠️ Signature tactile faible, résultat possiblement en révision.');

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
      ? 'Résultat en cours d\'analyse.'
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

  return (
    <div className="dg-page">
      {/* ═══ 1. Hero / Mission Status ═══ */}
      <div className="dg-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="dg-hero-title">Contrôle de présence</h1>
            <p className="dg-hero-sub">Démonstration — v{DEMOGUARD_VERSION}</p>
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

      {/* Welcome screen */}
      {phase === 'idle' && (
        <div className="dg-card">
          <p style={{ fontSize: 15, color: 'var(--dg-text)', marginBottom: 16, lineHeight: 1.5 }}>
            Nous allons vérifier que vous êtes bien présent avec quelques actions simples : toucher l'écran, mémoriser, réagir et lire une phrase.
          </p>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--dg-text-bright)' }}>
            Identifiant de session
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
              Commencer
            </button>
          </div>
        </div>
      )}

      {/* Prep screen */}
      {phase === 'prep' && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Préparation</h3>
          <p style={{ fontSize: 14, color: 'var(--dg-text)', marginBottom: 12 }}>Autorisez les capteurs nécessaires.</p>
          <div className="dg-row"><span className="dg-row-label">Caméra</span><span className={`dg-badge ${permissions?.camera === 'granted' ? 'dg-badge-ok' : 'dg-badge-pending'}`}>{permissions?.camera ?? '…'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Micro</span><span className={`dg-badge ${permissions?.microphone === 'granted' ? 'dg-badge-ok' : 'dg-badge-pending'}`}>{permissions?.microphone ?? '…'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Toucher écran</span><span className="dg-badge dg-badge-ok">OK</span></div>
          <div className="dg-row"><span className="dg-row-label">Mouvement</span><span className={`dg-badge ${motionSignal?.supported ? 'dg-badge-ok' : 'dg-badge-unsupported'}`}>{motionSignal?.supported ? 'OK' : 'N/A'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Focus</span><span className="dg-badge dg-badge-ok">OK</span></div>
        </div>
      )}

      {/* Camera capture */}
      {phase === 'camera' && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Photo de présence</h3>
          <p className="dg-challenge-sub">Prends une photo pour vérifier ta présence.</p>
          <video ref={videoRef} autoPlay playsInline muted className="dg-video" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={handleCaptureSelfie} disabled={!cameraReady} className="dg-btn dg-btn-primary">Capturer</button>
            <button onClick={handleSkipCamera} className="dg-btn dg-btn-secondary">Passer</button>
          </div>
        </div>
      )}

      {/* Camera result */}
      {selfieSignal && phase !== 'camera' && phase !== 'idle' && phase !== 'prep' && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Photo</h3>
          <div className="dg-row">
            <span className="dg-row-label">Statut</span>
            <span className={`dg-badge ${selfieSignal.captured ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{selfieSignal.captured ? 'OK' : 'MANQUANTE'}</span>
          </div>
        </div>
      )}

      {/* ═══ Cognitive Battery ═══ */}

      {/* Cognitive Reflex (phase: cognitive-intro) → "Réflexe" */}
      {phase === 'cognitive-intro' && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Test 1 — Réflexe</h3>
          <p className="dg-challenge-sub">Essai {cogReflexRound + 1} sur {COG_REFLEX_ROUNDS} — Touche dès que l'écran devient vert</p>
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
            {cogReflexPhase === 'ready' ? 'TAP POUR COMMENCER' : cogReflexPhase === 'wait' ? 'ATTENDS...' : cogReflexPhase === 'go' ? 'TAP !' : cogReflexPhase === 'too_early' ? 'TROP TÔT' : 'Terminé'}
          </button>
          {cogLastReflexMs !== null && cogReflexPhase === 'ready' && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--dg-green)' }}>Dernier: {cogLastReflexMs} ms</p>
          )}
          <div style={{ marginTop: 16 }}>
            <button onClick={handleSkipCogReflex} className="dg-btn dg-btn-secondary">Passer</button>
          </div>
        </div>
      )}

      {/* Cognitive Stroop → "Couleurs" */}
      {phase === 'cognitive-stroop' && stroopTrials.length > 0 && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Test 2 — Couleurs</h3>
          {stroopPracticeMode ? (
            <>
              <p className="dg-challenge-sub">Essai {stroopPracticeIndex + 1} / {stroopPracticeTrials.length} — Touche la <strong>coulour</strong> du mot, pas le mot lui-même</p>
              <div className="dg-stroop-word" style={{ color: stroopPracticeTrials[stroopPracticeIndex].displayColor === 'red' ? '#ef4444' : stroopPracticeTrials[stroopPracticeIndex].displayColor === 'blue' ? '#3b82f6' : stroopPracticeTrials[stroopPracticeIndex].displayColor === 'green' ? '#22c55e' : '#eab308' }}>
                {stroopPracticeTrials[stroopPracticeIndex].word.toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {STROOP_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleStroopPracticeSelect(color)}
                    className="dg-stroop-btn"
                    style={{ background: color === 'red' ? '#ef4444' : color === 'blue' ? '#3b82f6' : color === 'green' ? '#22c55e' : '#eab308' }}
                  >
                    {color === 'red' ? 'Rouge' : color === 'blue' ? 'Bleu' : color === 'green' ? 'Vert' : 'Jaune'}
                  </button>
                ))}
              </div>
              {stroopPracticeFeedback && (
                <p style={{ marginTop: 12, fontSize: 14, color: stroopPracticeFeedback.startsWith('Compris') ? 'var(--dg-green)' : 'var(--dg-amber)' }}>{stroopPracticeFeedback}</p>
              )}
            </>
          ) : stroopIndex < stroopTrials.length ? (
            <>
              <p className="dg-challenge-sub">Essai {stroopIndex + 1} / {stroopTrials.length} — Touche la <strong>coulour</strong> affichée</p>
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
                    {color === 'red' ? 'Rouge' : color === 'blue' ? 'Bleu' : color === 'green' ? 'Vert' : 'Jaune'}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <button onClick={handleSkipStroop} className="dg-btn dg-btn-secondary">Passer</button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Cognitive Digit Span → "Mémoire courte" */}
      {phase === 'cognitive-digit-span' && digitSpanTrials.length > 0 && digitSpanIndex < digitSpanTrials.length && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Test 3 — Mémoire courte</h3>
          <p className="dg-challenge-sub">Essai {digitSpanIndex + 1} / {digitSpanTrials.length} — {digitSpanTrials[digitSpanIndex].span} chiffres</p>
          {digitSpanShowDigits ? (
            <div className="dg-digit-display">{digitSpanTrials[digitSpanIndex].sequence.join(' ')}</div>
          ) : (
            <>
              <p className="dg-challenge-sub">Saisis les chiffres avec les boutons :</p>
              <div className="dg-digit-input-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--dg-text-bright)', textAlign: 'center', marginBottom: 16, minHeight: 36 }}>
                {digitSpanInput || '—'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, maxWidth: 320, margin: '0 auto' }}>
                {['1','2','3','4','5','6','7','8','9','0'].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      recordDigitSpanKey(false);
                      setDigitSpanInput((v) => v + d);
                    }}
                    className="dg-stroop-btn"
                    style={{ background: 'var(--dg-bg-elevated)', color: 'var(--dg-text-bright)', fontSize: 20, fontWeight: 700 }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button
                  onClick={() => {
                    recordDigitSpanKey(true);
                    setDigitSpanInput((v) => v.slice(0, -1));
                  }}
                  className="dg-btn dg-btn-secondary"
                >
                  ⌫
                </button>
                <button onClick={handleDigitSpanSubmit} disabled={!digitSpanInput} className="dg-btn dg-btn-primary">Valider</button>
                <button onClick={handleSkipDigitSpan} className="dg-btn dg-btn-secondary">Passer</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Cognitive N-Back → "Comparaison" */}
      {phase === 'cognitive-nback' && nbackTrials.length > 0 && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Test 4 — Comparaison</h3>
          {nbackPracticeMode ? (
            <>
              <p className="dg-challenge-sub">Essai {nbackPracticeIndex + 1} / {nbackPracticeTrials.length} — Ce symbole est-il le même que le précédent ?</p>
              <div className="dg-nback-letter">{nbackPracticeTrials[nbackPracticeIndex].letter}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => handleNBackPracticeResponse(true)} className="dg-nback-btn" style={{ background: '#22c55e' }}>OUI</button>
                <button onClick={() => handleNBackPracticeResponse(false)} className="dg-nback-btn" style={{ background: '#6b7280' }}>NON</button>
              </div>
              {nbackPracticeFeedback && (
                <p style={{ marginTop: 12, fontSize: 14, color: nbackPracticeFeedback.startsWith('Compris') ? 'var(--dg-green)' : 'var(--dg-amber)' }}>{nbackPracticeFeedback}</p>
              )}
            </>
          ) : nbackIndex < nbackTrials.length ? (
            <>
              <p className="dg-challenge-sub">Essai {nbackIndex + 1} / {nbackTrials.length} — Même symbole que le précédent ?</p>
              <div className="dg-nback-letter">{nbackTrials[nbackIndex].letter}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => handleNBackResponse(true)} className="dg-nback-btn" style={{ background: '#22c55e' }}>OUI</button>
                <button onClick={() => handleNBackResponse(false)} className="dg-nback-btn" style={{ background: '#6b7280' }}>NON</button>
              </div>
              <div style={{ marginTop: 16 }}>
                <button onClick={handleSkipNBack} className="dg-btn dg-btn-secondary">Passer</button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Cognitive Trail Tap → "Chemin" */}
      {phase === 'cognitive-trail-tap' && trailNodes.length > 0 && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Test 5 — Chemin</h3>
          <p className="dg-challenge-sub">Touche les points dans l'ordre 1 → {trailNodes.length}</p>
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
            <button onClick={handleSkipTrailTap} className="dg-btn dg-btn-secondary">Passer</button>
          </div>
        </div>
      )}

      {/* Voice proof (single capture) */}
      {phase === 'voice-proof' && (
        <div className="dg-card dg-challenge-area">
          <h3 className="dg-challenge-title">Preuve vocale</h3>
          <p className="dg-challenge-sub">Lis cette phrase à voix haute :</p>
          <p className="dg-phrase">« {generateChallengePhrase(voiceChallengeId)} »</p>
          {voiceCountdown !== null && (
            <div style={{ fontSize: 48, fontWeight: 800, textAlign: 'center', color: 'var(--dg-cyan)', margin: '16px 0' }}>{voiceCountdown}</div>
          )}
          {voiceRecording && (
            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              <div className="dg-spinner" style={{ margin: '0 auto' }} />
              <p style={{ marginTop: 8, fontSize: 14, color: 'var(--dg-text)' }}>Enregistrement...</p>
            </div>
          )}
          {voiceCaptured && !voiceRecording && voiceSignal && (
            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              <p style={{ fontSize: 14, color: voiceSignal.recorded ? 'var(--dg-green)' : 'var(--dg-red)' }}>
                {voiceSignal.recorded ? `✓ Enregistré (${voiceSignal.duration_ms} ms)` : '✗ Échec de l\'enregistrement'}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button onClick={handleVoiceContinue} className="dg-btn dg-btn-primary">Continuer</button>
                {!voiceRetakeUsed && voiceSignal.recorded && (
                  <button onClick={handleVoiceRetake} className="dg-btn dg-btn-secondary">Reprendre</button>
                )}
              </div>
            </div>
          )}
          {!voiceCaptured && !voiceRecording && voiceCountdown === null && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={handleStartVoiceCountdown} className="dg-btn dg-btn-primary">Enregistrer</button>
              <button onClick={handleSkipVoice} className="dg-btn dg-btn-secondary">Passer</button>
            </div>
          )}
        </div>
      )}

      {/* Review screen */}
      {phase === 'review' && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Récapitulatif</h3>
          <div className="dg-row"><span className="dg-row-label">Photo</span><span className={`dg-badge ${selfieSignal?.captured ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{selfieSignal?.captured ? 'OK' : '—'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Réflexe</span><span className={`dg-badge ${cogReflexSignal?.quality === 'ok' ? 'dg-badge-ok' : cogReflexSignal ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogReflexSignal ? cogReflexSignal.quality : '—'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Couleurs</span><span className={`dg-badge ${cogStroopSignal?.quality === 'ok' ? 'dg-badge-ok' : cogStroopSignal ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogStroopSignal ? cogStroopSignal.quality : '—'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Mémoire</span><span className={`dg-badge ${cogDigitSpanSignal?.quality === 'ok' ? 'dg-badge-ok' : cogDigitSpanSignal ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogDigitSpanSignal ? cogDigitSpanSignal.quality : '—'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Comparaison</span><span className={`dg-badge ${cogNBackSignal?.quality === 'ok' ? 'dg-badge-ok' : cogNBackSignal ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogNBackSignal ? cogNBackSignal.quality : '—'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Chemin</span><span className={`dg-badge ${cogTrailTapSignal?.quality === 'ok' ? 'dg-badge-ok' : cogTrailTapSignal ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogTrailTapSignal ? cogTrailTapSignal.quality : '—'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Voix</span><span className={`dg-badge ${voiceSignal?.recorded ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{voiceSignal?.recorded ? 'OK' : '—'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Toucher</span><span className={`dg-badge ${behaviorInteractions > 0 ? behaviorInteractions >= 5 ? 'dg-badge-ok' : 'dg-badge-review' : 'dg-badge-missing'}`}>{behaviorInteractions} interactions</span></div>
          {behaviorSummary && (
            <div className="dg-row"><span className="dg-row-label">Tests observés</span><span className="dg-row-value">{behaviorSummary.tasksObserved} / 6</span></div>
          )}
          {behaviorTouchSupported && behaviorInteractions === 0 && (
            <div className="dg-error-box" style={{ marginTop: 8 }}>Nous n'avons pas détecté assez d'interactions tactiles. Refais les tests tactiles avant d'envoyer.</div>
          )}
          {behaviorInteractions > 0 && behaviorInteractions < 5 && (
            <div className="dg-warning-box" style={{ marginTop: 8 }}>⚠️ Signature tactile faible — le résultat pourrait être en révision.</div>
          )}
          {behaviorInteractions >= 5 && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: 'var(--dg-green)', fontSize: 14 }}>✓ Signature tactile détectée.</div>
          )}
          <div style={{ marginTop: 16 }}>
            <button onClick={handleReviewContinue} className="dg-btn dg-btn-primary" style={{ width: '100%' }}>Continuer</button>
          </div>
        </div>
      )}

      {/* ═══ 5. Cognitive Battery Panel (results) ═══ */}
      {cogReflexSignal && phase !== 'cognitive-intro' && phase !== 'cognitive-stroop' && phase !== 'cognitive-digit-span' && phase !== 'cognitive-nback' && phase !== 'cognitive-trail-tap' && phase !== 'voice-proof' && phase !== 'review' && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Tests cognitifs</h3>
          <div className="dg-grid">
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Réflexe</span><span className={`dg-badge ${cogReflexSignal.quality === 'ok' ? 'dg-badge-ok' : cogReflexSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogReflexSignal.quality}</span></div>
              <span className="dg-grid-item-detail">Avg {cogReflexSignal.avg_ms}ms · Med {cogReflexSignal.median_ms}ms</span>
              <span className="dg-grid-item-detail">Fast: {cogReflexSignal.too_fast_count} · Slow: {cogReflexSignal.too_slow_count}</span>
            </div>
            {cogStroopSignal && (
              <div className="dg-grid-item">
                <div className="dg-grid-item-header"><span className="dg-grid-item-label">Couleurs</span><span className={`dg-badge ${cogStroopSignal.quality === 'ok' ? 'dg-badge-ok' : cogStroopSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogStroopSignal.quality}</span></div>
                <span className="dg-grid-item-detail">Acc {(cogStroopSignal.accuracy * 100).toFixed(0)}% · Conflict {cogStroopSignal.conflict_cost_ms}ms</span>
              </div>
            )}
            {cogDigitSpanSignal && (
              <div className="dg-grid-item">
                <div className="dg-grid-item-header"><span className="dg-grid-item-label">Mémoire</span><span className={`dg-badge ${cogDigitSpanSignal.quality === 'ok' ? 'dg-badge-ok' : cogDigitSpanSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogDigitSpanSignal.quality}</span></div>
                <span className="dg-grid-item-detail">Max span {cogDigitSpanSignal.max_span} · Acc {(cogDigitSpanSignal.accuracy * 100).toFixed(0)}%</span>
              </div>
            )}
            {cogNBackSignal && (
              <div className="dg-grid-item">
                <div className="dg-grid-item-header"><span className="dg-grid-item-label">Comparaison</span><span className={`dg-badge ${cogNBackSignal.quality === 'ok' ? 'dg-badge-ok' : cogNBackSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogNBackSignal.quality}</span></div>
                <span className="dg-grid-item-detail">Hits {cogNBackSignal.hits} · FP {cogNBackSignal.false_positives} · Miss {cogNBackSignal.misses}</span>
              </div>
            )}
            {cogTrailTapSignal && (
              <div className="dg-grid-item">
                <div className="dg-grid-item-header"><span className="dg-grid-item-label">Chemin</span><span className={`dg-badge ${cogTrailTapSignal.quality === 'ok' ? 'dg-badge-ok' : cogTrailTapSignal.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{cogTrailTapSignal.quality}</span></div>
                <span className="dg-grid-item-detail">Temps {cogTrailTapSignal.completion_ms}ms · Erreurs {cogTrailTapSignal.wrong_taps}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Device signals loading */}
      {phase === 'device-signals' && (
        <div className="dg-card dg-challenge-area">
          <div className="dg-spinner" style={{ margin: '0 auto' }} />
          <p className="dg-challenge-sub" style={{ marginTop: 12 }}>Collecte des signaux...</p>
        </div>
      )}

      {/* ═══ 3. Signal Matrix (8 signals) ═══ */}
      {phase !== 'device-signals' && phase !== 'idle' && (motionSignal || orientationSignal || touchSignal || visibilitySignal || networkSignal) && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Signaux</h3>
          <div className="dg-grid">
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Mouvement</span><span className={`dg-badge ${motionSignal?.quality === 'ok' ? 'dg-badge-ok' : motionSignal?.quality === 'unsupported' ? 'dg-badge-unsupported' : motionSignal?.quality === 'low' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{motionSignal?.quality ?? '—'}</span></div>
              {motionSignal?.supported && <span className="dg-grid-item-detail">{motionSignal.sample_count} échantillons</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Orientation</span><span className={`dg-badge ${orientationSignal?.quality === 'ok' ? 'dg-badge-ok' : orientationSignal?.quality === 'unsupported' ? 'dg-badge-unsupported' : orientationSignal?.quality === 'low' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{orientationSignal?.quality ?? '—'}</span></div>
              {orientationSignal?.supported && <span className="dg-grid-item-detail">{orientationSignal.changes} changements</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header">
                <span className="dg-grid-item-label">Toucher</span>
                <span className={`dg-badge ${
                  behaviorSummary
                    ? behaviorSummary.totalInteractions > 0
                      ? behaviorSummary.quality === 'ok' ? 'dg-badge-ok' : 'dg-badge-review'
                      : 'dg-badge-missing'
                    : touchSignal?.quality === 'ok' ? 'dg-badge-ok' : 'dg-badge-missing'
                }`}>
                  {behaviorSummary
                    ? behaviorSummary.totalInteractions > 0
                      ? behaviorSummary.quality === 'ok' ? 'Active' : 'Review'
                      : 'Missing'
                    : touchSignal?.quality ?? '—'}
                </span>
              </div>
              {behaviorSummary && behaviorSummary.totalInteractions > 0 && (
                <span className="dg-grid-item-detail">{behaviorSummary.totalInteractions} interactions · {behaviorSummary.tasksObserved}/6 tasks</span>
              )}
              {behaviorSummary && behaviorSummary.totalInteractions === 0 && touchSignal && touchSignal.touch_count > 0 && (
                <span className="dg-grid-item-detail">{touchSignal.touch_count} touches</span>
              )}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Focus</span><span className={`dg-badge ${visibilitySignal?.quality === 'ok' ? 'dg-badge-ok' : 'dg-badge-review'}`}>{visibilitySignal?.quality ?? '—'}</span></div>
              {visibilitySignal && <span className="dg-grid-item-detail">Perte focus {visibilitySignal.blur_count} · Caché {visibilitySignal.visibility_hidden_count}</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Réseau</span><span className={`dg-badge ${networkSignal?.quality === 'ok' ? 'dg-badge-ok' : networkSignal?.quality === 'unsupported' ? 'dg-badge-unsupported' : 'dg-badge-missing'}`}>{networkSignal?.quality ?? '—'}</span></div>
              {networkSignal && <span className="dg-grid-item-detail">{networkSignal.online ? 'en ligne' : 'hors ligne'}{networkSignal.effective_type ? ` · ${networkSignal.effective_type}` : ''}</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Photo</span><span className={`dg-badge ${selfieSignal?.captured ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{selfieSignal?.captured ? 'OK' : '—'}</span></div>
              {selfieSignal?.captured && <span className="dg-grid-item-detail">{selfieSignal.quality}</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Voix</span><span className={`dg-badge ${voiceSignal?.recorded ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{voiceSignal?.recorded ? 'OK' : '—'}</span></div>
              {voiceSignal?.recorded && <span className="dg-grid-item-detail">{voiceSignal.duration_ms}ms</span>}
            </div>
            <div className="dg-grid-item">
              <div className="dg-grid-item-header"><span className="dg-grid-item-label">Réflexe</span><span className={`dg-badge ${reactionSignal?.quality === 'ok' ? 'dg-badge-ok' : reactionSignal?.quality === 'low' ? 'dg-badge-review' : 'dg-badge-missing'}`}>{reactionSignal?.quality ?? '—'}</span></div>
              {reactionSignal?.reaction_ms != null && <span className="dg-grid-item-detail">Moy {reactionSignal.reaction_ms}ms</span>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 2. Progress Rings ═══ */}
      {quality && (phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error') && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Progression</h3>
          <div className="dg-rings">
            {[
              { label: 'Capteurs', value: sensorScore, color: '#06b6d4' },
              { label: 'Cognitif', value: cognitiveScore, color: '#8b5cf6' },
              { label: 'Voix', value: voiceScore, color: '#10b981' },
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
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Analyse cognitive</h3>
          <div className="dg-row"><span className="dg-row-label">Modules</span><span className="dg-row-value">{cogSummary.completed_modules} / {cogSummary.total_modules}</span></div>
          <div className="dg-row"><span className="dg-row-label">Profondeur</span><span className="dg-row-value" style={{ color: cogSummary.depth_score >= 0.65 ? 'var(--dg-green)' : 'var(--dg-amber)' }}>{(cogSummary.depth_score * 100).toFixed(0)}%</span></div>
          <div className="dg-row"><span className="dg-row-label">Cohérence</span><span className="dg-row-value">{(cogSummary.consistency_score * 100).toFixed(0)}%</span></div>
          <div className="dg-row"><span className="dg-row-label">Anomalie</span><span className="dg-row-value" style={{ color: cogSummary.anomaly_score < 0.3 ? 'var(--dg-green)' : cogSummary.anomaly_score < 0.5 ? 'var(--dg-amber)' : 'var(--dg-red)' }}>{cogSummary.anomaly_score < 0.3 ? 'faible' : cogSummary.anomaly_score < 0.5 ? 'moyenne' : 'haute'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Probabilité humaine</span><span className={`dg-badge ${cogSummary.human_likelihood === 'high' ? 'dg-badge-ok' : cogSummary.human_likelihood === 'medium' ? 'dg-badge-review' : 'dg-badge-failed'}`}>{cogSummary.human_likelihood}</span></div>
          {behaviorSummary && (
            <>
              <div className="dg-row"><span className="dg-row-label">Cohérence motrice</span><span className="dg-row-value">{(behaviorSummary.consistencyScore * 100).toFixed(0)}%</span></div>
              <div className="dg-row"><span className="dg-row-label">Confiance moteur</span><span className="dg-row-value">{(behaviorSummary.motorConfidence * 100).toFixed(0)}%</span></div>
            </>
          )}
          <div className={`dg-interp ${cogSummary.human_likelihood === 'high' ? 'dg-interp-strong' : cogSummary.human_likelihood === 'medium' ? 'dg-interp-medium' : 'dg-interp-weak'}`}>
            {cogSummary.human_likelihood === 'high'
              ? 'Profil cognitif fortement humain sur plusieurs domaines.'
              : cogSummary.human_likelihood === 'medium'
              ? 'Profil ambigu — certains modules montrent des motifs non humains.'
              : 'Profil présentant des anomalies significatives — révision recommandée.'}
          </div>
        </div>
      )}

      {/* ═══ 5. Behavioral Touch Panel ═══ */}
      {behaviorSummary && behaviorSummary.totalInteractions > 0 && (phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error') && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Signature tactile</h3>
          <div className="dg-row">
            <span className="dg-row-label">Statut</span>
            <span className={`dg-badge ${behaviorSummary.quality === 'ok' ? 'dg-badge-ok' : behaviorSummary.quality === 'review' ? 'dg-badge-review' : 'dg-badge-missing'}`}>
              {behaviorSummary.quality === 'ok' ? 'Actif' : behaviorSummary.quality === 'review' ? 'Révision' : 'Manquant'}
            </span>
          </div>
          <div className="dg-row"><span className="dg-row-label">Tâches observées</span><span className="dg-row-value">{behaviorSummary.tasksObserved} / 6</span></div>
          <div className="dg-row"><span className="dg-row-label">Interactions</span><span className="dg-row-value">{behaviorSummary.totalInteractions}</span></div>
          <div className="dg-row"><span className="dg-row-label">Cohérence motrice</span><span className="dg-row-value">{(behaviorSummary.consistencyScore * 100).toFixed(0)}%</span></div>
          <div className="dg-row"><span className="dg-row-label">Confiance moteur</span><span className="dg-row-value">{(behaviorSummary.motorConfidence * 100).toFixed(0)}%</span></div>
          <div className="dg-row"><span className="dg-row-label">Hésitation</span><span className="dg-row-value">{behaviorSummary.hesitationTotal <= 2 ? 'faible' : behaviorSummary.hesitationTotal <= 5 ? 'moyenne' : 'haute'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Rythme moyen</span><span className="dg-row-value">{behaviorSummary.avgRhythmMs != null ? `${behaviorSummary.avgRhythmMs} ms` : '—'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Corrections</span><span className="dg-row-value">{behaviorSummary.correctionTotal}</span></div>
          <div className="dg-row"><span className="dg-row-label">Probabilité comportement</span><span className={`dg-badge ${behaviorSummary.behaviorLikelihood === 'high' ? 'dg-badge-ok' : behaviorSummary.behaviorLikelihood === 'medium' ? 'dg-badge-review' : 'dg-badge-failed'}`}>{behaviorSummary.behaviorLikelihood}</span></div>
          <div className="dg-row"><span className="dg-row-label">Données prêtes</span><span className={`dg-badge ${behaviorSummary.totalInteractions > 0 ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{behaviorSummary.totalInteractions > 0 ? 'OUI' : 'NON'}</span></div>
        </div>
      )}

      {/* ═══ 6. Voice Integrity Panel ═══ */}
      {reconciledVocalDiag && (phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error') && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Intégrité vocale</h3>
          <div className="dg-row"><span className="dg-row-label">Pipeline audio</span><span className={`dg-badge ${reconciledVocalDiag.audioPipelineStatus === 'captured' ? 'dg-badge-ok' : reconciledVocalDiag.audioPipelineStatus === 'missing' ? 'dg-badge-missing' : reconciledVocalDiag.audioPipelineStatus === 'permission_denied' ? 'dg-badge-failed' : 'dg-badge-unsupported'}`}>{reconciledVocalDiag.audioPipelineStatus}</span></div>
          <div className="dg-row"><span className="dg-row-label">Mode d'analyse</span><span className="dg-row-value">{reconciledVocalDiag.analysisMode.replace(/_/g, ' ')}</span></div>
          <div className="dg-row"><span className="dg-row-label">Audio capturé</span><span className={`dg-badge ${reconciledVocalDiag.audioCaptured ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{reconciledVocalDiag.audioCaptured ? 'OUI' : 'NON'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Données préparées</span><span className={`dg-badge ${reconciledVocalDiag.payloadPrepared ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{reconciledVocalDiag.payloadPrepared ? 'OUI' : 'NON'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Relais tenté</span><span className={`dg-badge ${reconciledVocalDiag.relayAttempted ? 'dg-badge-ok' : 'dg-badge-skipped'}`}>{reconciledVocalDiag.relayAttempted ? 'OUI' : 'NON'}</span></div>
          {reconciledVocalDiag.relayAttempted && <div className="dg-row"><span className="dg-row-label">Relais accepté</span><span className={`dg-badge ${reconciledVocalDiag.relayAccepted ? 'dg-badge-ok' : 'dg-badge-failed'}`}>{reconciledVocalDiag.relayAccepted ? 'OUI' : 'NON'}</span></div>}
          <div className="dg-row"><span className="dg-row-label">Analysé</span><span className={`dg-badge ${reconciledVocalDiag.analyzed ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{reconciledVocalDiag.analyzed ? 'OUI' : 'NON'}</span></div>
          <div className="dg-row"><span className="dg-row-label">Statut vocal</span><span className={`dg-badge ${reconciledVocalDiag.vocalStatus === 'passed' ? 'dg-badge-ok' : reconciledVocalDiag.vocalStatus === 'failed' ? 'dg-badge-failed' : reconciledVocalDiag.vocalStatus === 'review' ? 'dg-badge-review' : 'dg-badge-skipped'}`}>{reconciledVocalDiag.vocalStatus}</span></div>
          {reconciledVocalDiag.durationMs != null && <div className="dg-row"><span className="dg-row-label">Durée</span><span className="dg-row-value">{reconciledVocalDiag.durationMs} ms</span></div>}
          <div className="dg-row"><span className="dg-row-label">Taille</span><span className="dg-row-value">{reconciledVocalDiag.audioSizeBucket}</span></div>
          {reconciledVocalDiag.confidenceLevel && <div className="dg-row"><span className="dg-row-label">Confiance</span><span className="dg-row-value">{reconciledVocalDiag.confidenceLevel}</span></div>}
          <div className="dg-row"><span className="dg-row-label">Raison</span><span className="dg-row-value dg-row-value-mono">{reconciledVocalDiag.reasonSafe}</span></div>
          {reconciledVocalDiag.latencyMs != null && <div className="dg-row"><span className="dg-row-label">Latence</span><span className="dg-row-value">{reconciledVocalDiag.latencyMs} ms</span></div>}
          {vocalWording && (
            <div className={`dg-interp ${reconciledVocalDiag.vocalStatus === 'passed' ? 'dg-interp-strong' : 'dg-interp-medium'}`}>{vocalWording}</div>
          )}
        </div>
      )}

      {/* ═══ 7. Hybrid Vector Decision Panel ═══ */}
      {response && (
        <div className="dg-card">
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Décision</h3>
          {response.traceId && <div className="dg-row"><span className="dg-row-label">Trace</span><span className="dg-row-value dg-row-value-mono">{response.traceId.slice(0, 16)}…</span></div>}
          <div className="dg-row"><span className="dg-row-label">Reçu</span><span className={`dg-badge ${response.received ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{response.received ? 'OUI' : 'NON'}</span></div>
          {response.quality_score != null && <div className="dg-row"><span className="dg-row-label">Score qualité</span><span className="dg-row-value">{(response.quality_score * 100).toFixed(0)}%</span></div>}
          <div className="dg-row"><span className="dg-row-label">Prêt</span><span className={`dg-badge ${response.ready ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{response.ready ? 'OUI' : 'NON'}</span></div>
          {response.hybridFusion && (
            <>
              <div className="dg-row"><span className="dg-row-label">Fusion déclenchée</span><span className={`dg-badge ${response.hybridFusion.triggered ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{response.hybridFusion.triggered ? 'OUI' : 'NON'}</span></div>
              {response.hybridFusion.globalDecision && <div className="dg-row"><span className="dg-row-label">Décision globale</span><span className={`dg-badge ${response.hybridFusion.globalDecision === 'ACCEPT' ? 'dg-badge-ok' : response.hybridFusion.globalDecision === 'REVIEW' ? 'dg-badge-review' : 'dg-badge-failed'}`}>{response.hybridFusion.globalDecision}</span></div>}
              {response.hybridFusion.trustLevel && <div className="dg-row"><span className="dg-row-label">Niveau de confiance</span><span className="dg-row-value">{response.hybridFusion.trustLevel}</span></div>}
              {response.hybridFusion.cognitiveStatus && <div className="dg-row"><span className="dg-row-label">Cognitif</span><span className={`dg-badge ${response.hybridFusion.cognitiveStatus === 'passed' ? 'dg-badge-ok' : response.hybridFusion.cognitiveStatus === 'review' ? 'dg-badge-review' : 'dg-badge-failed'}`}>{response.hybridFusion.cognitiveStatus}</span></div>}
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
          <h3 className="dg-card-title"><span className="dg-card-title-icon" />Suivi</h3>
          {monitoringLabel && (
            <div className="dg-row"><span className="dg-row-label">Enregistrement</span><span className={`dg-badge ${monitoringLabel === 'Recorded' ? 'dg-badge-ok' : monitoringLabel === 'Pending' ? 'dg-badge-pending' : 'dg-badge-failed'}`}>{monitoringLabel === 'Recorded' ? 'Enregistré' : monitoringLabel === 'Pending' ? 'En attente' : 'Échec'}</span></div>
          )}
          {response.hybridFusion.vocalDiagnostic && (
            <>
              <div className="dg-row"><span className="dg-row-label">Relais vocal</span><span className={`dg-badge ${response.hybridFusion.vocalDiagnostic.relayAttempted ? 'dg-badge-ok' : 'dg-badge-skipped'}`}>{response.hybridFusion.vocalDiagnostic.relayAttempted ? 'TENTÉ' : 'IGNORÉ'}</span></div>
              {response.hybridFusion.vocalDiagnostic.relayAttempted && <div className="dg-row"><span className="dg-row-label">Relais accepté</span><span className={`dg-badge ${response.hybridFusion.vocalDiagnostic.relayAccepted ? 'dg-badge-ok' : 'dg-badge-failed'}`}>{response.hybridFusion.vocalDiagnostic.relayAccepted ? 'OUI' : 'NON'}</span></div>}
              <div className="dg-row"><span className="dg-row-label">Analysé</span><span className={`dg-badge ${response.hybridFusion.vocalDiagnostic.analyzed ? 'dg-badge-ok' : 'dg-badge-missing'}`}>{response.hybridFusion.vocalDiagnostic.analyzed ? 'OUI' : 'NON'}</span></div>
              {response.hybridFusion.vocalDiagnostic.latencyMs != null && <div className="dg-row"><span className="dg-row-label">Latence</span><span className="dg-row-value">{response.hybridFusion.vocalDiagnostic.latencyMs} ms</span></div>}
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
            <button onClick={handleSubmit} className="dg-btn dg-btn-danger" style={{ width: '100%' }}>Réessayer</button>
          </div>
        </div>
      )}

      {/* Success display */}
      {response && phase === 'done' && (
        <div className="dg-success-box">
          Session envoyée avec succès. {responseMessage ?? ''}
        </div>
      )}

      {/* ═══ 9. Sticky Bottom Action Bar ═══ */}
      <div className="dg-sticky-bar">
        <div className="dg-sticky-status">
          {phase === 'readiness' && submitBlockReasons.length > 0 ? (
            <>
              <span className="dg-sticky-status-label" style={{ color: 'var(--dg-red)' }}>Bloqué</span>
              <span className="dg-sticky-status-detail">{submitBlockReasons[0]}</span>
            </>
          ) : isSubmitting ? (
            <>
              <span className="dg-sticky-status-label">Envoi...</span>
              <span className="dg-sticky-status-detail">Transmission en cours...</span>
            </>
          ) : isSubmitted ? (
            <>
              <span className="dg-sticky-status-label" style={{ color: 'var(--dg-green)' }}>Envoyé</span>
              <span className="dg-sticky-status-detail">{response?.hybridFusion?.globalDecision ?? response?.status ?? 'Terminé'}</span>
            </>
          ) : phase === 'readiness' ? (
            <>
              <span className="dg-sticky-status-label">Prêt à envoyer</span>
              <span className="dg-sticky-status-detail">{submitWarnings.length > 0 ? `${submitWarnings.length} avertissement(s)` : 'Tous les signaux collectés'}</span>
            </>
          ) : phase !== 'idle' ? (
            <>
              <span className="dg-sticky-status-label">En cours</span>
              <span className="dg-sticky-status-detail">Étape: {phase.replace(/-/g, ' ')}</span>
            </>
          ) : (
            <>
              <span className="dg-sticky-status-label">En attente</span>
              <span className="dg-sticky-status-detail">Saisis l'identifiant de session</span>
            </>
          )}
        </div>
        <div className="dg-sticky-actions">
          {phase === 'error' ? (
            <button onClick={handleSubmit} disabled={isSubmitting} className="dg-btn dg-btn-danger">Réessayer</button>
          ) : isSubmitted ? (
            response?.traceId ? (
              <button onClick={() => navigator.clipboard?.writeText(response.traceId!)} className="dg-btn dg-btn-secondary">Copier trace</button>
            ) : null
          ) : phase === 'readiness' && canSubmit ? (
            <button onClick={handleSubmit} disabled={isSubmitting} className="dg-btn dg-btn-primary">
              {isSubmitting ? <span className="dg-spinner" /> : 'Envoyer'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
