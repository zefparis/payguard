import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelfieCapture } from '../components/SelfieCapture'
import { StroopTest } from '../components/StroopTest'
import { NeuralReflex } from '../components/NeuralReflex'
import { VocalImprint } from '../components/VocalImprint'
import { ReactionTime } from '../components/ReactionTime'
import { BehavioralCapture } from '../components/BehavioralCapture'
import type { BehavioralController, BehavioralProfile } from '../hooks/useBehavioral'
import { usePayGuardStore } from '../store/payguardStore'
import { enrollWorker } from '../services/api'
import { generateSessionKeypair, PQ_ALGORITHM, signProfile } from '../services/postQuantum'
import { behavioralCollector, faceCollector } from '../signal-engine'
import type { CognitiveBaseline } from '../types'

type Step = 'identity' | 'selfie' | 'stroop' | 'reflex' | 'vocal' | 'reaction' | 'submitting' | 'success' | 'error'

const PROGRESS: Record<Step, number> = {
  identity:10, selfie:25, stroop:45, reflex:60, vocal:75, reaction:88, submitting:95, success:100, error:0
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
      <div className="badge badge-green">Step 1 of 6 — Identity</div>
      <h1 className="step-title">Worker Registration</h1>
      <p className="step-sub">Fill in your details. This is your permanent profile.</p>
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
          <label>Job Role</label>
          <input value={form.jobRole} onChange={onJobRoleChange} placeholder="Site Supervisor" />
        </div>
        <div className="field">
          <label>Employer / Site</label>
          <input value={form.employerSite} onChange={onEmployerSiteChange} placeholder="ABC Construction — Site B" />
        </div>
        <div className="field">
          <label>Email (optional)</label>
          <input value={form.email} onChange={onEmailChange} placeholder="your email (optional)" type="email" />
        </div>
        <button className="btn btn-primary" type="submit">
          Continue →
        </button>
      </form>
    </>
  )
})

export function Enroll() {
  const nav = useNavigate()
  const { setWorker, setSelfie, setCognitive } = usePayGuardStore()

  useEffect(() => {
    behavioralCollector.start()

    return () => {
      behavioralCollector.stop()
    }
  }, [])

  const [step, setStep] = useState<Step>('identity')
  const [selfieB64, setSelfieB64] = useState('')
  const [cognitive, setCog] = useState<Partial<CognitiveBaseline>>({})
  const [errorMsg, setErrorMsg] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [confidence, setConf] = useState(0)

  const behavioralCtrlRef = useRef<BehavioralController | null>(null)
  const [behavioralProfile, setBehavioralProfile] = useState<BehavioralProfile | null>(null)
  const [pqPublicKey, setPqPublicKey] = useState<string | null>(null)
  const [pqSignature, setPqSignature] = useState<string | null>(null)

  const deviceType = useMemo(() => behavioralProfile?.device.device_type ?? 'unknown', [behavioralProfile])

  const behavioralCaptured = useMemo(() => Boolean(behavioralProfile), [behavioralProfile])
  const pqCaptured = useMemo(() => Boolean(pqPublicKey && pqSignature), [pqPublicKey, pqSignature])

  const [form, setForm] = useState<IdentityFormState>({
    firstName: '', lastName: '', employeeId: '', jobRole: '', employerSite: '', email: ''
  })

  const handleFirstNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, firstName: e.target.value }))
  }, [])

  const handleLastNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, lastName: e.target.value }))
  }, [])

  const handleEmployeeIdChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, employeeId: e.target.value }))
  }, [])

  const handleJobRoleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, jobRole: e.target.value }))
  }, [])

  const handleEmployerSiteChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, employerSite: e.target.value }))
  }, [])

  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, email: e.target.value }))
  }, [])

  const handleIdentity = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!form.firstName || !form.lastName) return
    setStep('selfie')
  }, [form.firstName, form.lastName])

  function handleSelfie(b64: string) {
    faceCollector.capture(b64)
    setSelfieB64(b64)
    setTimeout(() => setStep('stroop'), 600)
  }

  function handleStroop(score: number) {
    setCog(c => ({ ...c, stroopScore: score }))
    setStep('reflex')
  }

  function handleReflex(ms: number) {
    setCog(c => ({ ...c, reflexVelocityMs: ms }))
    setStep('vocal')
  }

  function handleVocal(result: { embedding: number[]; quality: number; threshold: number }) {
    // Store voice biometrics locally
    setCog(c => ({
      ...c,
      vocalAccuracy: Math.round(result.quality * 100),
      vocalEmbedding: result.embedding,
      vocalQuality: result.quality,
      vocalSimilarityThreshold: result.threshold,
    }))
    setStep('reaction')
  }

  const onBehavioralController = useCallback((controller: BehavioralController) => {
    behavioralCtrlRef.current = controller
  }, [])

  async function handleReaction(ms: number) {
    const final: CognitiveBaseline = {
      stroopScore: cognitive.stroopScore ?? 0,
      reflexVelocityMs: cognitive.reflexVelocityMs ?? 0,
      vocalAccuracy: cognitive.vocalAccuracy ?? 0,
      vocalEmbedding: cognitive.vocalEmbedding,
      vocalQuality: cognitive.vocalQuality,
      vocalSimilarityThreshold: cognitive.vocalSimilarityThreshold ?? 0.75,
      reactionTimeMs: ms,
    }
    setCog(final)
    setStep('submitting')

    try {
      // Stop behavioral capture and finalize profile right before submit
      const behavioral = behavioralCtrlRef.current?.stop()
      if (behavioral) setBehavioralProfile(behavioral)

      const cognitiveBaseline = {
        stroop_score: final.stroopScore / 100,
        reflex_velocity_ms: final.reflexVelocityMs,
        vocal_accuracy: final.vocalAccuracy / 100,
        reaction_time_ms: final.reactionTimeMs,
        // New voice biometrics payload (stored in Supabase)
        // -- ALTER TABLE edguard_enrollments
        // -- ADD COLUMN IF NOT EXISTS vocal_embedding JSONB;
        // -- ADD COLUMN IF NOT EXISTS vocal_quality FLOAT;
        vocal_embedding: final.vocalEmbedding,
        vocal_quality: final.vocalQuality,
        vocal_similarity_threshold: final.vocalSimilarityThreshold,
        // New behavioral + post-quantum layers
        // -- ALTER TABLE edguard_enrollments
        // -- ADD COLUMN IF NOT EXISTS behavioral_profile JSONB;
        // -- ADD COLUMN IF NOT EXISTS pq_public_key TEXT;
        // -- ADD COLUMN IF NOT EXISTS pq_signature TEXT;
        behavioral,
      }

      const { publicKey: pq_public_key, privateKey } = generateSessionKeypair()
      const pq_signature = signProfile(cognitiveBaseline, privateKey)
      setPqPublicKey(pq_public_key)
      setPqSignature(pq_signature)

      const payloadBaseline = {
        ...cognitiveBaseline,
        pq_public_key,
        pq_signature,
        pq_algorithm: PQ_ALGORITHM,
      }

      const res = await enrollWorker({
        selfie_b64: selfieB64,
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email || `${form.firstName}.${form.lastName}@payguard.local`,
        tenant_id: import.meta.env.VITE_TENANT_ID,
        cognitive_baseline: payloadBaseline,
      })
      setWorkerId(res.student_id)
      setConf(Math.round(res.confidence))
      setWorker({
        workerId: res.student_id,
        firstName: form.firstName,
        lastName: form.lastName,
        employeeId: form.employeeId,
        jobRole: form.jobRole,
        employerSite: form.employerSite,
        tenantId: import.meta.env.VITE_TENANT_ID,
        cognitiveBaseline: final,
      })
      setSelfie(selfieB64)
      setCognitive(final)
      setStep('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Enrollment failed')
      setStep('error')
    }
  }

  return (
    <BehavioralCapture enabled={step !== 'identity'} onController={onBehavioralController}>
      <div className="page">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>← PAYGUARD</div>

        <div className="progress-bar" style={{ width: '100%', maxWidth: 440 }}>
          <div className="progress-fill" style={{ width: `${PROGRESS[step]}%` }} />
        </div>

        {step === 'identity' && (
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

        {step === 'selfie' && (
        <>
          <div className="badge badge-green">Step 2 of 6 — Biometric</div>
          <h1 className="step-title">Face Registration</h1>
          <p className="step-sub">Look directly at the camera. Ensure good lighting.</p>
          <SelfieCapture onCapture={handleSelfie} />
        </>
        )}

        {step === 'stroop' && (
        <>
          <div className="badge badge-amber">Step 3 of 6 — Cognitive</div>
          <h1 className="step-title">Stroop Test</h1>
          <StroopTest onComplete={handleStroop} />
        </>
        )}

        {step === 'reflex' && (
        <>
          <div className="badge badge-amber">Step 4 of 6 — Cognitive</div>
          <h1 className="step-title">Neural Reflex</h1>
          <NeuralReflex onComplete={handleReflex} />
        </>
        )}

        {step === 'vocal' && (
        <>
          <div className="badge badge-amber">Step 5 of 6 — Cognitive</div>
          <h1 className="step-title">Vocal Imprint</h1>
          <VocalImprint onComplete={handleVocal} />
        </>
        )}

        {step === 'reaction' && (
        <>
          <div className="badge badge-amber">Step 6 of 6 — Cognitive</div>
          <h1 className="step-title">Reaction Time</h1>
          <ReactionTime onComplete={handleReaction} />
        </>
        )}

        {step === 'submitting' && (
        <>
          <h1 className="step-title">Registering...</h1>
          <p className="step-sub">Creating your biometric profile with AWS Rekognition</p>
          <div style={{ marginTop: 40, color: 'var(--green)', fontSize: 48 }}>⬡</div>
        </>
        )}

        {step === 'success' && (
        <>
          <div className="badge badge-green" style={{ margin: '0 auto 20px' }}>✓ Registered</div>
          <h1 className="step-title">Profile Created</h1>
          <p className="step-sub">Welcome, {form.firstName}. Your biometric identity is now active.</p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
          <div className="badge badge-green" style={{ marginBottom: 0 }}>device: {deviceType}</div>
          </div>

          <div className="card" style={{ width: '100%', marginTop: 8 }}>
            <div className="metric-row">
              <span className="metric-label">Worker ID</span>
              <span className="metric-value" style={{ fontSize: 11 }}>{workerId.slice(0,12)}...</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Name</span>
              <span className="metric-value">{form.firstName} {form.lastName}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Site</span>
              <span className="metric-value">{form.employerSite || '—'}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Facial confidence</span>
              <span className="metric-value">{confidence}%</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Stroop score</span>
              <span className="metric-value">{cognitive.stroopScore}%</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Reflex velocity</span>
              <span className="metric-value">{cognitive.reflexVelocityMs}ms</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Reaction time</span>
              <span className="metric-value">{cognitive.reactionTimeMs}ms</span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Behavioral profile</span>
              <span className="metric-value">{behavioralCaptured ? 'captured ✓' : 'not captured'}</span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Post-quantum signature</span>
              <span className="metric-value">{pqCaptured ? `${PQ_ALGORITHM} ✓` : 'not captured'}</span>
            </div>
          </div>
          <button className="btn btn-success" style={{ marginTop: 20 }} onClick={() => nav('/confirm')}>
            Confirm Payment →
          </button>
        </>
      )}

        {step === 'error' && (
        <>
          <div className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', margin: '0 auto 20px' }}>
            Error
          </div>
          <h1 className="step-title">Registration Failed</h1>
          <p className="step-sub">{errorMsg}</p>
          <button className="btn btn-outline" onClick={() => setStep('identity')}>Try Again</button>
        </>
        )}
      </div>
    </BehavioralCapture>
  )
}
