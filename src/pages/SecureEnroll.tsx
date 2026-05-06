import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ulid } from 'ulid'

import { SelfieCapture } from '../components/SelfieCapture'
import { StroopTest } from '../components/StroopTest'
import { NeuralReflex } from '../components/NeuralReflex'
import { DigitSpan } from '../components/DigitSpan'
import { BehavioralCapture } from '../components/BehavioralCapture'

import type { BehavioralController, BehavioralProfile } from '../hooks/useBehavioral'

import { enrollWorker } from '../services/api'
import { idbDeleteSession, idbGetSession, idbUpsertSession, type SecureSessionRecord } from '../services/indexedDb'
import { setSecureCollectMode } from '../services/secureMode'
import { generateSessionKeypair, PQ_ALGORITHM, signProfile } from '../services/postQuantum'
import type { CognitiveBaseline } from '../types'

import { voiceCollector } from '../signal-engine'
import { withRetry } from '../utils/retry'
import { TENANT_ID, VOICE_DURATION_MS } from '../config'

type State = 'INIT' | 'COLLECTE' | 'UPLOAD' | 'TERMINE' | 'ERREUR'

type CollectStep = 'identity' | 'selfie' | 'stroop' | 'reflex' | 'voice' | 'digitspan' | 'ready'

const PROGRESS: Record<State, number> = {
  INIT: 10,
  COLLECTE: 45,
  UPLOAD: 85,
  TERMINE: 100,
  ERREUR: 0,
}

type IdentityFormState = {
  firstName: string
  lastName: string
  employeeId: string
  jobRole: string
  employerSite: string
  email: string
}

type IdentityFormProps = {
  form: IdentityFormState
  onSubmit: (e: FormEvent) => void
  onFirstNameChange: (e: ChangeEvent<HTMLInputElement>) => void
  onLastNameChange: (e: ChangeEvent<HTMLInputElement>) => void
  onEmployeeIdChange: (e: ChangeEvent<HTMLInputElement>) => void
  onJobRoleChange: (e: ChangeEvent<HTMLInputElement>) => void
  onEmployerSiteChange: (e: ChangeEvent<HTMLInputElement>) => void
  onEmailChange: (e: ChangeEvent<HTMLInputElement>) => void
}

const IdentityForm = memo(function IdentityForm({
  form,
  onSubmit,
  onFirstNameChange,
  onLastNameChange,
  onEmployeeIdChange,
  onJobRoleChange,
  onEmployerSiteChange,
  onEmailChange,
}: IdentityFormProps) {
  return (
    <>
      <div className="badge badge-green">Collection — Identity</div>
      <h1 className="step-title">Secure Enrollment</h1>
      <p className="step-sub">Identity details stored locally during collection.</p>
      <form onSubmit={onSubmit} style={{ width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>First Name *</label>
            <input value={form.firstName} onChange={onFirstNameChange} required placeholder="John" />
          </div>
          <div className="field">
            <label>Last Name *</label>
            <input value={form.lastName} onChange={onLastNameChange} required placeholder="Smith" />
          </div>
        </div>
        <div className="field">
          <label>Employee ID</label>
          <input value={form.employeeId} onChange={onEmployeeIdChange} placeholder="EMP-001" />
        </div>
        <div className="field">
          <label>Job role</label>
          <input value={form.jobRole} onChange={onJobRoleChange} placeholder="Site Supervisor" />
        </div>
        <div className="field">
          <label>Employer / Site</label>
          <input value={form.employerSite} onChange={onEmployerSiteChange} placeholder="ABC Construction — Site B" />
        </div>
        <div className="field">
          <label>Email (optional)</label>
          <input value={form.email} onChange={onEmailChange} placeholder="email (optional)" type="email" />
        </div>
        <button className="btn btn-primary" type="submit">
          Continue →
        </button>
      </form>
    </>
  )
})


export function SecureEnroll() {
  const nav = useNavigate()

  const [state, setState] = useState<State>('INIT')
  const [collectStep, setCollectStep] = useState<CollectStep>('identity')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const [sessionId, setSessionId] = useState<string>('')
  const [session, setSession] = useState<SecureSessionRecord | null>(null)

  const [isRecording, setIsRecording] = useState(false)
  const [recordingProgress, setRecordingProgress] = useState(0)

  const behavioralCtrlRef = useRef<BehavioralController | null>(null)
  const [behavioralProfile, setBehavioralProfile] = useState<BehavioralProfile | null>(null)

  const [, setSelfieB64] = useState('')
  const [cognitive, setCog] = useState<Partial<CognitiveBaseline>>({})

  const [form, setForm] = useState<IdentityFormState>({
    firstName: '',
    lastName: '',
    employeeId: '',
    jobRole: '',
    employerSite: '',
    email: '',
  })

  // --- INIT ---
  useEffect(() => {
    void (async () => {
      try {
        setState('INIT')
        setErrorMsg('')

        if (!navigator.onLine) {
          throw new Error('Connection required for INIT. Enable the network and try again.')
        }

        // Auth API key is implicit via env headers() in services/api.ts.
        // “Récupérer config tenant” : on valide juste que le tenant est présent côté env.
        if (!TENANT_ID) throw new Error('Missing VITE_TENANT_ID')

        const sid = ulid()
        const rec: SecureSessionRecord = {
          session_id: sid,
          tenant_id: TENANT_ID,
          created_at: new Date().toISOString(),
          state: 'INIT',
        }
        await idbUpsertSession(rec)
        setSessionId(sid)
        setSession(rec)

        // Enter COLLECTE (offline volontaire)
        setSecureCollectMode(true)
        await idbUpsertSession({ ...rec, state: 'COLLECTE' })
        setSession({ ...rec, state: 'COLLECTE' })
        setState('COLLECTE')
        setCollectStep('identity')
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'INIT failed')
        setState('ERREUR')
      }
    })()

    return () => {
      // Ne pas forcer false ici: on laisse l’utilisateur reprendre là où il en est.
    }
  }, [])

  const secureBanner = useMemo(() => {
    if (state !== 'COLLECTE') return null
    return (
      <div className="secure-banner">
        Secure collection mode — no network calls
      </div>
    )
  }, [state])

  const onBehavioralController = useCallback((controller: BehavioralController) => {
    behavioralCtrlRef.current = controller
  }, [])

  // --- identity handlers ---
  const handleFirstNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, firstName: e.target.value })), [])
  const handleLastNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, lastName: e.target.value })), [])
  const handleEmployeeIdChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, employeeId: e.target.value })), [])
  const handleJobRoleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, jobRole: e.target.value })), [])
  const handleEmployerSiteChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, employerSite: e.target.value })), [])
  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, email: e.target.value })), [])

  const handleIdentity = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!form.firstName || !form.lastName) return
    if (!sessionId) return

    const next: SecureSessionRecord = {
      session_id: sessionId,
      tenant_id: TENANT_ID,
      created_at: session?.created_at ?? new Date().toISOString(),
      state: 'COLLECTE',
      identity: {
        first_name: form.firstName,
        last_name: form.lastName,
        employee_id: form.employeeId || undefined,
        job_role: form.jobRole || undefined,
        employer_site: form.employerSite || undefined,
        email: form.email || undefined,
      },
    }
    await idbUpsertSession(next)
    setSession(next)
    setCollectStep('selfie')
  }, [form, session?.created_at, sessionId])

  async function handleSelfie(b64: string) {
    if (!sessionId) return
    setSelfieB64(b64)
    const current = (await idbGetSession(sessionId))
    if (!current) return
    const next = { ...current, selfie_b64: b64, state: 'COLLECTE' as const }
    await idbUpsertSession(next)
    setSession(next)
    setCollectStep('stroop')
  }

  async function handleStroop(score: number) {
    setCog(c => ({ ...c, stroopScore: score }))
    setCollectStep('reflex')
  }

  async function handleReflex(ms: number) {
    setCog(c => ({ ...c, reflexVelocityMs: ms }))
    setCollectStep('voice')
  }

  async function handleVoiceEmbeddingCapture() {
    if (!sessionId) return
    setErrorMsg('')

    // permission micro
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      testStream.getTracks().forEach(t => t.stop())
    } catch {
      setErrorMsg('Allow microphone access in settings')
      setState('ERREUR')
      return
    }

    setIsRecording(true)
    setRecordingProgress(0)

    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / VOICE_DURATION_MS) * 100, 100)
      setRecordingProgress(pct)
      if (pct >= 100) clearInterval(interval)
    }, 50)

    try {
      await voiceCollector.start()
      await new Promise<void>(r => setTimeout(r, VOICE_DURATION_MS))
      await voiceCollector.stopAndCompute()
      clearInterval(interval)
      setRecordingProgress(100)
    } catch (e) {
      clearInterval(interval)
      setErrorMsg(e instanceof Error ? e.message : 'Microphone error')
      setState('ERREUR')
      return
    } finally {
      setIsRecording(false)
    }

    const embedding = voiceCollector.getEmbedding()
    const quality = voiceCollector.getQuality()

    const current = await idbGetSession(sessionId)
    if (!current) return

    const next: SecureSessionRecord = {
      ...current,
      state: 'COLLECTE',
      // Store voice biometrics in local session (native: Preferences / web: IndexedDB)
      cognitive_baseline: {
        ...(current.cognitive_baseline ?? {}),
        vocal_embedding: embedding,
        vocal_quality: quality,
      },
    }
    await idbUpsertSession(next)
    setSession(next)
    setCollectStep('digitspan')
  }

  async function handleDigitSpan(span: number) {
    setCog(c => ({ ...c, digitSpan: span }))
    setCollectStep('ready')

    // On stoppe le profil behavioral à la fin de la collecte (comme avant dans handleReaction)
    const behavioral = behavioralCtrlRef.current?.stop() ?? null
    if (behavioral) setBehavioralProfile(behavioral)

    if (!sessionId) return
    const current = (await idbGetSession(sessionId))
    if (!current) return

    const next: SecureSessionRecord = {
      ...current,
      state: 'COLLECTE',
      behavioral_profile: behavioral,
      cognitive_baseline: {
        ...(current.cognitive_baseline ?? {}),
        stroop_score: cognitive.stroopScore ? cognitive.stroopScore / 100 : (current.cognitive_baseline as any)?.stroop_score,
        reflex_velocity_ms: cognitive.reflexVelocityMs ?? (current.cognitive_baseline as any)?.reflex_velocity_ms,
        digit_span: span,
      },
    }
    await idbUpsertSession(next)
    setSession(next)
  }

  async function goUpload() {
    if (!sessionId) return
    setErrorMsg('')
    setState('UPLOAD')

    try {
      if (!navigator.onLine) {
        throw new Error('Connection required for UPLOAD. Re-enable the network and try again.')
      }
      setSecureCollectMode(false)

      const current = await idbGetSession(sessionId)
      if (!current) throw new Error('Local session not found (IndexedDB)')

      const identity = current.identity
      if (!identity?.first_name || !identity.last_name) throw new Error('Incomplete identity')
      if (!current.selfie_b64) throw new Error('Missing selfie')

      // Reproduit l’enrichissement existant (PQ signature + behavioral)
      const { publicKey: pq_public_key, privateKey } = generateSessionKeypair()
      const pq_signature = signProfile(current.cognitive_baseline ?? {}, privateKey)

      // Payload cognitif cible (cognitive_baseline)
      // - supprimer reaction_time_ms
      // - ajouter digit_span
      // - garder stroop_score, reflex_velocity_ms, vocal_embedding, vocal_quality
      // - + enrichissement behavioral/pq/session_id (déjà attendu côté API)
      const { reaction_time_ms: _rt, ...cogWithoutReaction } = (current.cognitive_baseline ?? {}) as Record<string, unknown>

      const cognitive_baseline = {
        ...cogWithoutReaction,
        digit_span: (cogWithoutReaction as any).digit_span ?? 0,
        behavioral: current.behavioral_profile ?? null,
        pq_public_key,
        pq_signature,
        pq_algorithm: PQ_ALGORITHM,
        session_id: current.session_id,
      }

      await withRetry(
        () => enrollWorker({
          selfie_b64: current.selfie_b64!,
          first_name: identity.first_name,
          last_name: identity.last_name,
          email: identity.email || `${identity.first_name}.${identity.last_name}@payguard.local`,
          tenant_id: current.tenant_id,
          cognitive_baseline,
        }),
        3
      )

      await idbDeleteSession(sessionId)

      nav('/results')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Upload failed')
      setState('ERREUR')
    }
  }

  const deviceType = useMemo(() => (behavioralProfile as BehavioralProfile | null)?.device?.device_type ?? 'unknown', [behavioralProfile])

  const isMotionPhase = useMemo(
    () => state === 'COLLECTE' && ['identity', 'selfie', 'voice'].includes(collectStep),
    [state, collectStep],
  )
  const isPointerPhase = useMemo(
    () => state === 'COLLECTE',
    [state],
  )

  return (
    <BehavioralCapture motionEnabled={isMotionPhase} pointerEnabled={isPointerPhase} onController={onBehavioralController}>
      <div className="page">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>← PAYGUARD</div>

        <div className="progress-bar" style={{ width: '100%', maxWidth: 440 }}>
          <div className="progress-fill" style={{ width: `${PROGRESS[state]}%` }} />
        </div>

        {secureBanner}

        {state === 'COLLECTE' && collectStep === 'identity' && (
          <IdentityForm
            form={form}
            onSubmit={handleIdentity}
            onFirstNameChange={handleFirstNameChange}
            onLastNameChange={handleLastNameChange}
            onEmployeeIdChange={handleEmployeeIdChange}
            onJobRoleChange={handleJobRoleChange}
            onEmployerSiteChange={handleEmployerSiteChange}
            onEmailChange={handleEmailChange}
          />
        )}

        {state === 'COLLECTE' && collectStep === 'selfie' && (
          <>
            <div className="badge badge-green">Collection — Photo</div>
            <h1 className="step-title">Selfie</h1>
            <p className="step-sub">Offline capture, then IndexedDB storage.</p>
            <SelfieCapture onCapture={handleSelfie} />
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'stroop' && (
          <>
            <div className="badge badge-amber">Collection — Cognitive Test</div>
            <h1 className="step-title">Stroop Test</h1>
            <StroopTest onComplete={handleStroop} />
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'reflex' && (
          <>
            <div className="badge badge-amber">Collection — Cognitive Test</div>
            <h1 className="step-title">Neural Reflex</h1>
            <NeuralReflex onComplete={handleReflex} />
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'voice' && (
          <>
            <div className="badge badge-amber">Collection — Voice</div>
            <h1 className="step-title">Voice Imprint</h1>
            <p className="step-sub">
              Speak normally for 4 seconds.
            </p>

            {!isRecording && recordingProgress === 0 && (
              <button className="btn btn-primary" onClick={handleVoiceEmbeddingCapture}>
                🎤 Start Recording
              </button>
            )}

            {isRecording && (
              <div className="voice-recording">
                <div className="voice-mic">🎤</div>

                <p className="voice-recording-text">
                  Recording in progress...
                </p>

                <div className="voice-progress-outer">
                  <div
                    className="voice-progress-inner"
                    style={{ width: `${recordingProgress}%` }}
                  />
                </div>

                <p className="voice-timer">
                  {Math.round(recordingProgress / 25)}s / 4s
                </p>
              </div>
            )}

            {recordingProgress === 100 && !isRecording && (
              <div className="voice-done">✅</div>
            )}
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'digitspan' && (
          <>
            <div className="badge badge-amber">
              Collection — Memory
            </div>
            <h1 className="step-title">Digit Span</h1>
            <DigitSpan onComplete={handleDigitSpan} />
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'ready' && (
          <>
            <div className="badge badge-green">Collection Complete</div>
            <h1 className="step-title">Ready to Upload</h1>
            <p className="step-sub">
              Session: <b>{sessionId.slice(0, 12)}...</b><br />
              device: <b>{deviceType}</b>
            </p>
            <button className="btn btn-success" onClick={goUpload}>
              Go Online & Upload →
            </button>
          </>
        )}

        {state === 'UPLOAD' && (
          <>
            <div className="badge badge-green">Upload</div>
            <h1 className="step-title">Uploading...</h1>
            <p className="step-sub">Reading IndexedDB → POST /edguard/enroll (retry x3)</p>
            <div className="spinner" />
          </>
        )}

        {state === 'TERMINE' && (
          <>
            <div className="badge badge-green" style={{ margin: '0 auto 20px' }}>✓ Completed</div>
            <h1 className="step-title">Session Uploaded</h1>
            <p className="step-sub">
              Saved session_id: <b>{sessionId}</b>
            </p>
            <button className="btn btn-primary" onClick={() => nav('/')}>Back Home</button>
          </>
        )}

        {state === 'ERREUR' && (
          <>
            <div className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', margin: '0 auto 20px' }}>
              Error
            </div>
            <h1 className="step-title">Failed</h1>
            <p className="step-sub">{errorMsg || 'An error occurred.'}</p>
            <button className="btn btn-outline" onClick={() => window.location.reload()}>
              Restart
            </button>
          </>
        )}
      </div>
    </BehavioralCapture>
  )
}
