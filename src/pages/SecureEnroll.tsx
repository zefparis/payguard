import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ulid } from 'ulid'

import { SelfieCapture } from '../components/SelfieCapture'
import { StroopTest } from '../components/StroopTest'
import { NeuralReflex } from '../components/NeuralReflex'
import { ReactionTime } from '../components/ReactionTime'
import { BehavioralCapture } from '../components/BehavioralCapture'

import type { BehavioralController, BehavioralProfile } from '../hooks/useBehavioral'
import { useVoiceBiometrics } from '../hooks/useVoiceBiometrics'

import { enrollWorker } from '../services/api'
import { idbDeleteSession, idbGetSession, idbUpsertSession, type SecureSessionRecord } from '../services/indexedDb'
import { setSecureCollectMode } from '../services/secureMode'
import { generateSessionKeypair, PQ_ALGORITHM, signProfile } from '../services/postQuantum'
import type { CognitiveBaseline } from '../types'

type State = 'INIT' | 'COLLECTE' | 'UPLOAD' | 'TERMINE' | 'ERREUR'

type CollectStep = 'identity' | 'selfie' | 'stroop' | 'reflex' | 'audio' | 'reaction' | 'ready'

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
      <div className="badge badge-green">Collecte — Identité</div>
      <h1 className="step-title">Enrôlement sécurisé</h1>
      <p className="step-sub">Infos d’identité (stockées localement pendant la collecte).</p>
      <form onSubmit={onSubmit} style={{ width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Prénom *</label>
            <input value={form.firstName} onChange={onFirstNameChange} required placeholder="John" />
          </div>
          <div className="field">
            <label>Nom *</label>
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
          <label>Email (optionnel)</label>
          <input value={form.email} onChange={onEmailChange} placeholder="email (optionnel)" type="email" />
        </div>
        <button className="btn btn-primary" type="submit">
          Continuer →
        </button>
      </form>
    </>
  )
})

async function sleep(ms: number) {
  await new Promise<void>(r => setTimeout(r, ms))
}

async function withRetry<T>(fn: () => Promise<T>, retries: number, baseDelayMs = 600): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i === retries) break
      await sleep(baseDelayMs * (i + 1))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed')
}

export function SecureEnroll() {
  const nav = useNavigate()

  const [state, setState] = useState<State>('INIT')
  const [collectStep, setCollectStep] = useState<CollectStep>('identity')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const [sessionId, setSessionId] = useState<string>('')
  const [session, setSession] = useState<SecureSessionRecord | null>(null)

  const behavioralCtrlRef = useRef<BehavioralController | null>(null)
  const [behavioralProfile, setBehavioralProfile] = useState<BehavioralProfile | null>(null)
  const { recordAudio } = useVoiceBiometrics()

  const [, setSelfieB64] = useState('')
  const [audioSamples, setAudioSamples] = useState<Float32Array | null>(null)
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
          throw new Error('Connexion requise pour INIT. Activez le réseau et réessayez.')
        }

        // Auth API key is implicit via env headers() in services/api.ts.
        // “Récupérer config tenant” : on valide juste que le tenant est présent côté env.
        const tenantId = import.meta.env.VITE_TENANT_ID
        if (!tenantId) throw new Error('Missing VITE_TENANT_ID')

        const sid = ulid()
        const rec: SecureSessionRecord = {
          session_id: sid,
          tenant_id: tenantId,
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
        Mode collecte sécurisé — aucun appel réseau
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
      tenant_id: import.meta.env.VITE_TENANT_ID,
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
    setCollectStep('audio')
  }

  async function handleAudioCapture() {
    try {
      const samples = await recordAudio(2000)
      setAudioSamples(samples)
      setCollectStep('reaction')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Audio capture failed')
      setState('ERREUR')
    }
  }

  async function handleReaction(ms: number) {
    if (!sessionId) return

    const final: CognitiveBaseline = {
      stroopScore: cognitive.stroopScore ?? 0,
      reflexVelocityMs: cognitive.reflexVelocityMs ?? 0,
      vocalAccuracy: 0,
      vocalEmbedding: undefined,
      vocalQuality: undefined,
      vocalSimilarityThreshold: 0.75,
      reactionTimeMs: ms,
    }
    setCog(final)

    const behavioral = behavioralCtrlRef.current?.stop() ?? null
    if (behavioral) setBehavioralProfile(behavioral)

    const current = (await idbGetSession(sessionId))
    if (!current) return

    const next: SecureSessionRecord = {
      ...current,
      state: 'COLLECTE',
      audio_samples_f32: audioSamples ? Array.from(audioSamples) : undefined,
      behavioral_profile: behavioral,
      cognitive_baseline: {
        stroop_score: final.stroopScore / 100,
        reflex_velocity_ms: final.reflexVelocityMs,
        reaction_time_ms: final.reactionTimeMs,
      },
    }
    await idbUpsertSession(next)
    setSession(next)
    setCollectStep('ready')
  }

  async function goUpload() {
    if (!sessionId) return
    setErrorMsg('')
    setState('UPLOAD')

    try {
      if (!navigator.onLine) {
        throw new Error('Connexion requise pour UPLOAD. Réactivez le réseau puis relancez.')
      }
      setSecureCollectMode(false)

      const current = await idbGetSession(sessionId)
      if (!current) throw new Error('Session introuvable en local (IndexedDB)')

      const identity = current.identity
      if (!identity?.first_name || !identity.last_name) throw new Error('Identité incomplète')
      if (!current.selfie_b64) throw new Error('Selfie manquant')

      // Reproduit l’enrichissement existant (PQ signature + behavioral)
      const { publicKey: pq_public_key, privateKey } = generateSessionKeypair()
      const pq_signature = signProfile(current.cognitive_baseline ?? {}, privateKey)

      const cognitive_baseline = {
        ...(current.cognitive_baseline ?? {}),
        behavioral: current.behavioral_profile ?? null,
        pq_public_key,
        pq_signature,
        pq_algorithm: PQ_ALGORITHM,
        // on joint l'audio brut (optionnel côté backend pour l’instant)
        audio_samples_f32: current.audio_samples_f32 ?? null,
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
      window.localStorage.setItem('payguard-last-session-id', sessionId)

      setState('TERMINE')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Upload failed')
      setState('ERREUR')
    }
  }

  const deviceType = useMemo(() => (behavioralProfile as BehavioralProfile | null)?.device?.device_type ?? 'unknown', [behavioralProfile])

  return (
    <BehavioralCapture enabled={state === 'COLLECTE'} onController={onBehavioralController}>
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
            <div className="badge badge-green">Collecte — Photo</div>
            <h1 className="step-title">Selfie</h1>
            <p className="step-sub">Capture hors-ligne puis stockage IndexedDB.</p>
            <SelfieCapture onCapture={handleSelfie} />
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'stroop' && (
          <>
            <div className="badge badge-amber">Collecte — Test cognitif</div>
            <h1 className="step-title">Stroop Test</h1>
            <StroopTest onComplete={handleStroop} />
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'reflex' && (
          <>
            <div className="badge badge-amber">Collecte — Test cognitif</div>
            <h1 className="step-title">Neural Reflex</h1>
            <NeuralReflex onComplete={handleReflex} />
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'audio' && (
          <>
            <div className="badge badge-amber">Collecte — Audio</div>
            <h1 className="step-title">Empreinte vocale (audio brut)</h1>
            <p className="step-sub">Enregistrement 2s. Stockage en local (Float32).</p>

            <button className="btn btn-primary" onClick={handleAudioCapture}>
              Enregistrer 2s
            </button>

            {audioSamples && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--grey)' }}>
                Audio capturé ✓ ({audioSamples.length} samples)
              </div>
            )}
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'reaction' && (
          <>
            <div className="badge badge-amber">Collecte — Test cognitif</div>
            <h1 className="step-title">Reaction Time</h1>
            <ReactionTime onComplete={handleReaction} />
          </>
        )}

        {state === 'COLLECTE' && collectStep === 'ready' && (
          <>
            <div className="badge badge-green">Collecte terminée</div>
            <h1 className="step-title">Prêt à envoyer</h1>
            <p className="step-sub">
              Session: <b>{sessionId.slice(0, 12)}...</b><br />
              device: <b>{deviceType}</b>
            </p>
            <button className="btn btn-success" onClick={goUpload}>
              Repasser en ligne & Upload →
            </button>
          </>
        )}

        {state === 'UPLOAD' && (
          <>
            <div className="badge badge-green">Upload</div>
            <h1 className="step-title">Envoi…</h1>
            <p className="step-sub">Lecture IndexedDB → POST /edguard/enroll (retry x3)</p>
            <div style={{ marginTop: 40, color: 'var(--green)', fontSize: 48 }}>⬡</div>
          </>
        )}

        {state === 'TERMINE' && (
          <>
            <div className="badge badge-green" style={{ margin: '0 auto 20px' }}>✓ Terminé</div>
            <h1 className="step-title">Session envoyée</h1>
            <p className="step-sub">
              Session_id sauvegardé: <b>{sessionId}</b>
            </p>
            <button className="btn btn-primary" onClick={() => nav('/')}>Retour accueil</button>
          </>
        )}

        {state === 'ERREUR' && (
          <>
            <div className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', margin: '0 auto 20px' }}>
              Erreur
            </div>
            <h1 className="step-title">Échec</h1>
            <p className="step-sub">{errorMsg || 'Une erreur est survenue.'}</p>
            <button className="btn btn-outline" onClick={() => window.location.reload()}>
              Recommencer
            </button>
          </>
        )}
      </div>
    </BehavioralCapture>
  )
}
