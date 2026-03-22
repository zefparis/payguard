import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelfieCapture } from '../components/SelfieCapture'
import { StroopTest } from '../components/StroopTest'
import { NeuralReflex } from '../components/NeuralReflex'
import { VocalImprint } from '../components/VocalImprint'
import { ReactionTime } from '../components/ReactionTime'
import { usePayGuardStore } from '../store/payguardStore'
import { enrollWorker } from '../services/api'
import type { CognitiveBaseline } from '../types'

type Step = 'identity' | 'selfie' | 'stroop' | 'reflex' | 'vocal' | 'reaction' | 'submitting' | 'success' | 'error'

const PROGRESS: Record<Step, number> = {
  identity:10, selfie:25, stroop:45, reflex:60, vocal:75, reaction:88, submitting:95, success:100, error:0
}

export function Enroll() {
  const nav = useNavigate()
  const { setWorker, setSelfie, setCognitive } = usePayGuardStore()

  const [step, setStep] = useState<Step>('identity')
  const [selfieB64, setSelfieB64] = useState('')
  const [cognitive, setCog] = useState<Partial<CognitiveBaseline>>({})
  const [errorMsg, setErrorMsg] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [confidence, setConf] = useState(0)

  const [form, setForm] = useState({
    firstName: '', lastName: '', employeeId: '', jobRole: '', employerSite: '', email: ''
  })

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleIdentity(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.lastName) return
    setStep('selfie')
  }

  function handleSelfie(b64: string) {
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

  function handleVocal(accuracy: number) {
    setCog(c => ({ ...c, vocalAccuracy: accuracy }))
    setStep('reaction')
  }

  async function handleReaction(ms: number) {
    const final: CognitiveBaseline = {
      stroopScore: cognitive.stroopScore ?? 0,
      reflexVelocityMs: cognitive.reflexVelocityMs ?? 0,
      vocalAccuracy: cognitive.vocalAccuracy ?? 0,
      reactionTimeMs: ms,
    }
    setCog(final)
    setStep('submitting')

    try {
      const res = await enrollWorker({
        selfie_b64: selfieB64,
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email || `${form.firstName}.${form.lastName}@payguard.local`,
        tenant_id: 'payguard-demo',
        cognitive_baseline: {
          stroop_score: final.stroopScore / 100,
          reflex_velocity_ms: final.reflexVelocityMs,
          vocal_accuracy: final.vocalAccuracy / 100,
          reaction_time_ms: final.reactionTimeMs,
        }
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
        tenantId: 'payguard-demo',
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
    <div className="page">
      <div className="logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>← PAYGUARD</div>

      <div className="progress-bar" style={{ width: '100%', maxWidth: 440 }}>
        <div className="progress-fill" style={{ width: `${PROGRESS[step]}%` }} />
      </div>

      {step === 'identity' && (
        <>
          <div className="badge badge-green">Step 1 of 6 — Identity</div>
          <h1 className="step-title">Worker Registration</h1>
          <p className="step-sub">Fill in your details. This is your permanent profile.</p>
          <form onSubmit={handleIdentity} style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>First Name *</label>
                <input value={form.firstName} onChange={field('firstName')} required placeholder="John" />
              </div>
              <div className="field">
                <label>Last Name *</label>
                <input value={form.lastName} onChange={field('lastName')} required placeholder="Smith" />
              </div>
            </div>
            <div className="field">
              <label>Employee ID</label>
              <input value={form.employeeId} onChange={field('employeeId')} placeholder="EMP-001" />
            </div>
            <div className="field">
              <label>Job Role</label>
              <input value={form.jobRole} onChange={field('jobRole')} placeholder="Site Supervisor" />
            </div>
            <div className="field">
              <label>Employer / Site</label>
              <input value={form.employerSite} onChange={field('employerSite')} placeholder="ABC Construction — Site B" />
            </div>
            <div className="field">
              <label>Email (optional)</label>
              <input value={form.email} onChange={field('email')} placeholder="john@company.com" type="email" />
            </div>
            <button className="btn btn-primary" type="submit">
              Continue →
            </button>
          </form>
        </>
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
          <div style={{ marginTop: 40, color: 'var(--green)', fontSize: 48 }}>💰</div>
        </>
      )}

      {step === 'success' && (
        <>
          <div className="badge badge-green" style={{ margin: '0 auto 20px' }}>✓ Registered</div>
          <h1 className="step-title">Profile Created</h1>
          <p className="step-sub">Welcome, {form.firstName}. Your biometric identity is now active.</p>
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
  )
}
