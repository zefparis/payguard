import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelfieCapture } from '../components/SelfieCapture'
import { ReactionTime } from '../components/ReactionTime'
import {
  lookupEnrollment,
  sendAuthPaymentSignals,
  verifyWorker,
  vocalVerify,
} from '../services/api'
import { withRetry } from '../utils/retry'
import { useVoiceBiometrics } from '../hooks/useVoiceBiometrics'
import {
  useBehavioral,
  requestMotionPermission,
  type BehavioralProfile,
} from '../hooks/useBehavioral'

const MAX_ATTEMPTS = 3

type Step =
  | 'identity'
  | 'not-enrolled'
  | 'selfie'
  | 'vocal'
  | 'reaction'
  | 'verifying'
  | 'upload-error'
  | 'decision'

type Decision = 'APPROVED' | 'REVIEW' | 'REJECTED' | 'MANUAL_REVIEW'

const VOCAL_RECORD_MS = 3000

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Behavioral score — mean of every signal that returned a usable measurement.
 *
 * - Gyroscope std (rad/s) — humans micro-tremor > 0.05, bots ~ 0.
 * - Accelerometer magnitude std (m/s^2) — humans hand variation > 0.1.
 * - Inter-tap CV (std/mean) — humans 0.15+, bots near-zero.
 * - Touch pressure variance — humans variable, emulators fixed.
 *
 * If no sensor produced data (desktop without taps, locked-down browser),
 * fall back to a low "prior" that distinguishes a touch device from a
 * vanilla desktop / headless.
 */
/**
 * Sigmoid normalization — maps a positive value to (0, 1) with 0.5 at `mid`.
 * Steepness k=3 gives a smooth S-curve that avoids saturation.
 */
const sigmoid = (v: number, mid: number) =>
  1 / (1 + Math.exp(-3 * (v - mid) / mid))

function behavioralScoreFromProfile(p: BehavioralProfile): number {
  const scores: number[] = []

  const gyroStd = p.motion.rotation_rate?.mag_std
  if (gyroStd !== undefined && gyroStd > 0) {
    scores.push(sigmoid(gyroStd, 1.0))    // 0.5 at 1.0 rad/s
  }

  const accelStd = p.motion.accel_gravity?.mag_std
  if (accelStd !== undefined && accelStd > 0) {
    scores.push(sigmoid(accelStd, 10.0))  // 0.5 at 10.0 m/s²
  }

  const tapInterMean = p.touch.inter_tap_ms_mean
  const tapDurMean = p.touch.tap_duration_ms_mean
  if (tapInterMean > 0 && tapDurMean > 0) {
    const tapCV = tapInterMean / Math.max(1, tapDurMean)
    scores.push(sigmoid(tapCV, 2.0))      // 0.5 at CV=2
  }

  if (scores.length === 0) {
    return p.device.touch_capable ? 0.4 : 0.2
  }

  return scores.reduce((a, b) => a + b, 0) / scores.length
}

const COPY: Record<Decision, { en: string; zu: string; xh: string; sub: string }> = {
  APPROVED: {
    en: 'Payment approved',
    zu: 'Inkokhelo igunyaziwe',
    xh: 'Intlawulo iphunyeziwe',
    sub: 'You may proceed with disbursement.',
  },
  REVIEW: {
    en: 'Pending human review',
    zu: 'Kulindwe ukubuyekezwa umuntu',
    xh: 'Kulindwe uphononongo lomntu',
    sub: 'An agent will validate this request shortly.',
  },
  REJECTED: {
    en: 'Verification failed — please try again',
    zu: 'Ukuqinisekiswa kuhlulekile — sicela uzame futhi',
    xh: 'Uqinisekiso aluphumelelanga — nceda uzame kwakhona',
    sub: 'Make sure your face is well lit and clearly visible.',
  },
  MANUAL_REVIEW: {
    en: 'Sent for manual review',
    zu: 'Kuthunyelwe ukuze kubuyekezwe ngesandla',
    xh: 'Kuthunyelwe kuphononongo lwesandla',
    sub: 'A human agent will contact you to complete authentication.',
  },
}

const TONE: Record<Decision, { color: string; bg: string; border: string; glyph: string }> = {
  APPROVED:      { color: '#16a34a', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.45)',  glyph: '✔' },
  REVIEW:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.45)', glyph: '!' },
  REJECTED:      { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.45)',  glyph: '×' },
  MANUAL_REVIEW: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.45)', glyph: '⏳' },
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'rgba(3,7,18,0.6)',
  color: 'var(--ink)',
  fontSize: 15,
  outline: 'none',
}

export function PaymentConfirm() {
  const nav = useNavigate()
  const [step, setStep] = useState<Step>('identity')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [employer, setEmployer] = useState('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [attempts, setAttempts] = useState(0)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [vocalError, setVocalError] = useState<string>('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')

  // Offline captured data — no network until 'verifying' step
  const [captured, setCaptured] = useState<{
    selfieB64: string | null
    vocalEmbedding: number[] | null
    reactionMs: number | null
    behavioralProfile: BehavioralProfile | null
  }>({
    selfieB64: null,
    vocalEmbedding: null,
    reactionMs: null,
    behavioralProfile: null,
  })

  const voice = useVoiceBiometrics()
  const behavioral = useBehavioral()
  const vocalEmbeddingRef = useRef<Float32Array | null>(null)

  // Mount-time effect only registers the unmount cleanup.
  useEffect(() => {
    return () => {
      try { behavioral.stop() } catch { /* already stopped */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleIdentity = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return
    if (lookupBusy) return

    // First user gesture — request iOS motion permission
    try { await requestMotionPermission() } catch { /* user denied or unsupported */ }

    // Block the flow if no enrollment exists
    setLookupBusy(true)
    setErrorMsg('')
    try {
      const lookup = await lookupEnrollment({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
      if (import.meta.env.DEV) console.log('[PAYGUARD-LOOKUP] result:', lookup)
      if (!lookup.found) {
        setStep('not-enrolled')
        return
      }
      if (lookup.student_id) setStudentId(lookup.student_id)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[PAYGUARD-LOOKUP] error:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Profile lookup failed')
      return
    } finally {
      setLookupBusy(false)
    }

    void behavioral.start()
    setStep('selfie')
  }, [firstName, lastName, behavioral, lookupBusy])

  const handleSelfie = useCallback((b64: string) => {
    if (import.meta.env.DEV) console.log('[PAYGUARD-SELFIE] b64 length:', b64?.length)
    setCaptured(c => ({ ...c, selfieB64: b64 }))
    setStep('vocal')
  }, [])

  const handleVocal = useCallback(async () => {
    setVocalError('')
    let samples: Float32Array
    try {
      samples = await voice.recordAudio(VOCAL_RECORD_MS)
    } catch (err) {
      const errName = err instanceof Error ? err.name || 'Error' : 'Unknown'
      const errMsg = err instanceof Error ? err.message : String(err)
      if (import.meta.env.DEV) console.error('[vocal] recordAudio failed', { errName, errMsg })
      setVocalError(`${errName}: ${errMsg}`)
      setCaptured(c => ({ ...c, vocalEmbedding: null }))
      setStep('reaction')
      return
    }

    if (!samples || samples.length === 0) {
      if (import.meta.env.DEV) console.error('[vocal] recordAudio returned empty buffer')
      setVocalError('Microphone returned empty audio')
      setCaptured(c => ({ ...c, vocalEmbedding: null }))
      setStep('reaction')
      return
    }

    const embedding = voice.extractMFCC(samples, 16000)
    vocalEmbeddingRef.current = embedding
    setCaptured(c => ({ ...c, vocalEmbedding: Array.from(embedding) }))
    setStep('reaction')
  }, [voice])

  const handleReactionDone = useCallback((avgMs: number) => {
    let profile: BehavioralProfile | null = null
    try {
      profile = behavioral.stop()
      if (import.meta.env.DEV) console.log('[BEHAVIORAL DEBUG]', {
        gyroStd: profile.motion.rotation_rate?.mag_std,
        accelStd: profile.motion.accel_gravity?.mag_std,
        motionSamples: profile.motion.samples,
        tapCV: profile.touch.inter_tap_ms_mean / Math.max(1, profile.touch.tap_duration_ms_mean),
        taps: profile.touch.taps,
      })
    } catch { /* already stopped */ }

    setCaptured(c => ({ ...c, reactionMs: avgMs, behavioralProfile: profile }))
    setStep('verifying')
  }, [behavioral])

  // Batch upload — single network phase after all captures are done
  useEffect(() => {
    if (step !== 'verifying') return
    if (!captured.selfieB64 || captured.reactionMs == null) return

    let cancelled = false

    ;(async () => {
      try {
        // 1. Face verify
        const verifyResp = await withRetry(
          () => verifyWorker({
            selfie_b64: captured.selfieB64!,
            first_name: firstName,
            last_name: lastName,
            student_id: studentId ?? undefined,
          }),
          3
        )
        if (cancelled) return
        if (verifyResp.student_id) setStudentId(verifyResp.student_id)
        const resolvedStudentId = verifyResp.student_id || studentId

        // 2. Voice verify (optional — may have failed during capture)
        let vocalScore = 0
        if (captured.vocalEmbedding && captured.vocalEmbedding.length > 0) {
          try {
            const vocalResp = await withRetry(
              () => vocalVerify({
                first_name: firstName,
                last_name: lastName,
                vocal_embedding: captured.vocalEmbedding!,
              }),
              3
            )
            if (cancelled) return
            vocalScore = Math.max(0, Math.min(1, vocalResp.vocal_score))
          } catch (verifyErr) {
            if (import.meta.env.DEV) console.warn('[vocal-verify] failed', verifyErr)
          }
        }

        // 3. Final decision
        if (!resolvedStudentId) {
          if (cancelled) return
          setDecision('REVIEW')
          setStep('decision')
          return
        }

        const behavioralScore = captured.behavioralProfile
          ? behavioralScoreFromProfile(captured.behavioralProfile)
          : 0

        const result = await withRetry(
          () => sendAuthPaymentSignals({
            student_id: resolvedStudentId!,
            vocal_score: vocalScore,
            behavioral_score: behavioralScore,
            reaction_ms: captured.reactionMs!,
          }),
          3
        )
        if (cancelled) return

        const nextAttempts = attempts + 1
        setAttempts(nextAttempts)
        let d: Decision = result.decision
        if (d === 'REJECTED' && nextAttempts >= MAX_ATTEMPTS) {
          d = 'MANUAL_REVIEW'
        }
        if (import.meta.env.DEV) console.log('[PAYGUARD] backend decision', { decision: d, trust_score: result.trust_score, detail: result.detail })
        setDecision(d)
        setStep('decision')
      } catch (err) {
        if (cancelled) return
        setUploadError(err instanceof Error ? err.message : 'Network error')
        setStep('upload-error')
      }
    })()

    return () => { cancelled = true }
  }, [step, captured, studentId, firstName, lastName, attempts])

  const retry = useCallback(() => {
    setDecision(null)
    setErrorMsg('')
    setVocalError('')
    vocalEmbeddingRef.current = null
    setCaptured({ selfieB64: null, vocalEmbedding: null, reactionMs: null, behavioralProfile: null })
    setStudentId(null)
    void behavioral.start()
    setStep('selfie')
  }, [behavioral])

  const restart = useCallback(() => {
    setDecision(null)
    setErrorMsg('')
    setAttempts(0)
    setVocalError('')
    vocalEmbeddingRef.current = null
    setCaptured({ selfieB64: null, vocalEmbedding: null, reactionMs: null, behavioralProfile: null })
    setStudentId(null)
    setUploadError('')
    setStep('identity')
  }, [])

  const progressPct = useMemo(() => {
    switch (step) {
      case 'identity':     return 0
      case 'not-enrolled': return 0
      case 'selfie':       return 20
      case 'vocal':        return 40
      case 'reaction':     return 60
      case 'verifying':    return 85
      case 'upload-error': return 85
      case 'decision':     return 100
    }
  }, [step])

  const period = useMemo(() => `${month} ${year}`, [month, year])

  return (
    <div className="page">
      <div className="logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>← PAYGUARD</div>

      <div className="progress-bar" style={{ width: '100%', maxWidth: 440 }}>
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {step === 'identity' && (
        <>
          <div className="badge badge-green">Step 1 — Identity & Payment</div>
          <h1 className="step-title">Confirm Payment</h1>
          <p className="step-sub">
            Enter your details and the payment information below.
          </p>
          {errorMsg && (
            <div className="card" style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>
              {errorMsg}
            </div>
          )}
          <form onSubmit={handleIdentity} style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>First Name *</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="John"
                  style={inputStyle}
                />
              </div>
              <div className="field">
                <label>Last Name *</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Smith"
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="field">
              <label>Amount (ZAR) *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="15000"
                step="0.01"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Pay Period Month *</label>
                <select value={month} onChange={(e) => setMonth(e.target.value)} required style={inputStyle}>
                  <option value="">Select month</option>
                  {MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Year *</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required
                  placeholder="2026"
                  min="2020"
                  max="2030"
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="field">
              <label>Employer / Site *</label>
              <input
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                required
                placeholder="ABC Construction — Site B"
                style={inputStyle}
              />
            </div>
            <button className="btn btn-primary" type="submit"
              disabled={!firstName.trim() || !lastName.trim() || lookupBusy}>
              {lookupBusy ? 'Looking up...' : 'Continue →'}
            </button>
          </form>
        </>
      )}

      {step === 'not-enrolled' && (
        <>
          <div className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', margin: '0 auto 16px' }}>
            No profile found
          </div>
          <h1 className="step-title">
            {firstName.trim()} {lastName.trim()} is not enrolled yet.
          </h1>
          <p className="step-sub">
            Please complete enrolment first — we need a registered face and
            voice profile to verify identity before releasing payment.
          </p>
          <button className="btn btn-primary" onClick={() => nav('/enroll')}>
            Go to enrolment →
          </button>
          <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setStep('identity')}>
            Try a different name
          </button>
        </>
      )}

      {step === 'selfie' && (
        <>
          <div className="badge badge-green">Step 2 of 4 — Live photo</div>
          <h1 className="step-title">Face Verification</h1>
          <p className="step-sub">
            Center your face in the frame and capture. We compare it to your
            registered profile.
          </p>
          <SelfieCapture onCapture={handleSelfie} />
        </>
      )}

      {step === 'vocal' && (
        <>
          <div className="badge badge-green">Step 3 of 4 — Voice sample</div>
          <h1 className="step-title">Voice Verification</h1>
          <p className="step-sub">
            Hold the button and read this short sentence aloud for 3 seconds:
            <br />
            <em style={{ color: 'var(--ink, #fff)' }}>"I confirm this payment release."</em>
          </p>
          {vocalError && (
            <div className="card" style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>
              {vocalError} — continuing without voice.
            </div>
          )}
          {voice.isRecording ? (
            <div className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
              <p style={{ fontSize: 12, color: 'var(--grey)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
                Recording...
              </p>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--green, #22c55e)' }}>
                {(voice.countdownMs / 1000).toFixed(1)}s
              </p>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleVocal}
              disabled={voice.isRecording}
            >
              Start voice sample →
            </button>
          )}
        </>
      )}

      {step === 'reaction' && (
        <>
          <div className="badge badge-green">Step 4 of 4 — Quick tap test</div>
          <h1 className="step-title">Reaction Time</h1>
          <p className="step-sub">
            Tap the button as fast as you can when it turns yellow. 5 short
            rounds.
          </p>
          <ReactionTime onComplete={handleReactionDone} />
        </>
      )}

      {step === 'verifying' && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div className="spinner" />
          <h2 style={{ marginTop: 24 }}>Verifying your identity</h2>
          <p style={{ color: 'var(--secondary-label)', marginTop: 8 }}>
            Please wait, this takes a few seconds.
          </p>
        </div>
      )}

      {step === 'upload-error' && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <h2>Connection failed</h2>
          <p style={{ color: 'var(--secondary-label)', marginTop: 8 }}>
            Your data was captured successfully. Please retry to submit.
          </p>
          {uploadError && (
            <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{uploadError}</p>
          )}
          <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => setStep('verifying')}>
            Retry submission
          </button>
          <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={restart}>
            Start over
          </button>
        </div>
      )}

      {step === 'decision' && decision && (
        <DecisionCard
          decision={decision}
          attempts={attempts}
          firstName={firstName}
          lastName={lastName}
          amount={amount}
          period={period}
          employer={employer}
          onRetry={retry}
          onRestart={restart}
        />
      )}
    </div>
  )
}

interface DecisionCardProps {
  decision: Decision
  attempts: number
  firstName: string
  lastName: string
  amount: string
  period: string
  employer: string
  onRetry: () => void
  onRestart: () => void
}

function DecisionCard({ decision, attempts, firstName, lastName, amount, period, employer, onRetry, onRestart }: DecisionCardProps) {
  const tone = TONE[decision]
  const copy = COPY[decision]
  const canRetry = decision === 'REJECTED' && attempts < MAX_ATTEMPTS

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%' }}>
      <div style={{
        borderRadius: 16,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        padding: '24px 20px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: tone.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, fontWeight: 800, margin: '0 auto 12px',
        }}>
          {tone.glyph}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: tone.color, marginBottom: 8,
        }}>
          {decision.replace('_', ' ')}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          {copy.en}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', marginBottom: 2 }}>
          {copy.zu}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', marginBottom: 12 }}>
          {copy.xh}
        </div>
        <div style={{ fontSize: 13, color: 'var(--grey)', lineHeight: 1.6 }}>
          {copy.sub}
        </div>
      </div>

      {decision === 'APPROVED' && (
        <div className="card" style={{ width: '100%' }}>
          <div className="metric-row">
            <span className="metric-label">Worker</span>
            <span className="metric-value">{firstName} {lastName}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Amount</span>
            <span className="metric-value">ZAR {parseFloat(amount || '0').toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Period</span>
            <span className="metric-value">{period}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Employer / Site</span>
            <span className="metric-value">{employer}</span>
          </div>
        </div>
      )}

      {canRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      )}
      <button className="btn btn-outline" onClick={onRestart}>
        Start a new request
      </button>
    </div>
  )
}
