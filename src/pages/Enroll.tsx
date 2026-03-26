import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelfieCapture } from '../components/SelfieCapture'
import { StroopTest } from '../components/StroopTest'
import { NeuralReflex } from '../components/NeuralReflex'
import { DigitSpan } from '../components/DigitSpan'
import { BehavioralCapture } from '../components/BehavioralCapture'
import type { BehavioralController } from '../hooks/useBehavioral'
import { useVoiceBiometrics } from '../hooks/useVoiceBiometrics'
import { usePayGuardStore } from '../store/payguardStore'
import { enrollWorker } from '../services/api'
import { generateSessionKeypair, PQ_ALGORITHM, signProfile } from '../services/postQuantum'
import { behavioralCollector, faceCollector, signalBus } from '../signal-engine'
import type { CognitiveBaseline } from '../types'

type Step = 'identity' | 'selfie' | 'stroop' | 'reflex' | 'voice' | 'digitspan' | 'uploading' | 'error'

const PROGRESS: Record<Step, number> = {
  identity: 10,
  selfie: 25,
  stroop: 45,
  reflex: 60,
  voice: 75,
  digitspan: 90,
  uploading: 96,
  error: 0,
}

type CollectedEnrollment = {
  firstName: string
  lastName: string
  employeeId: string
  jobRole: string
  employerSite: string
  email: string
  selfieB64: string
  stroopScore: number
  reflexMs: number
  voiceBlob: Blob | null
  voiceSamples: Float32Array | null
  digitSpan: number
}

const INITIAL_COLLECTED: CollectedEnrollment = {
  firstName: '',
  lastName: '',
  employeeId: '',
  jobRole: '',
  employerSite: '',
  email: '',
  selfieB64: '',
  stroopScore: 0,
  reflexMs: 0,
  voiceBlob: null,
  voiceSamples: null,
  digitSpan: 0,
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function rms(arr: Float32Array) {
  let sum = 0
  for (let i = 0; i < arr.length; i += 1) {
    sum += arr[i] * arr[i]
  }
  return arr.length ? Math.sqrt(sum / arr.length) : 0
}

function toMonoFloat32(audioBuffer: AudioBuffer) {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0)
  }

  const left = audioBuffer.getChannelData(0)
  const right = audioBuffer.getChannelData(1)
  const out = new Float32Array(audioBuffer.length)

  for (let i = 0; i < out.length; i += 1) {
    out[i] = (left[i] + right[i]) * 0.5
  }

  return out
}

function resampleLinear(input: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) {
    return input
  }

  const ratio = outputRate / inputRate
  const outLen = Math.max(1, Math.floor(input.length * ratio))
  const out = new Float32Array(outLen)

  for (let i = 0; i < outLen; i += 1) {
    const t = i / ratio
    const i0 = Math.floor(t)
    const i1 = Math.min(input.length - 1, i0 + 1)
    const frac = t - i0
    out[i] = input[i0] * (1 - frac) + input[i1] * frac
  }

  return out
}

async function recordVoiceCapture(durationMs: number, onProgress: (progress: number) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: BlobPart[] = []

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data)
    }
  }

  let progressTimer = 0

  try {
    onProgress(0)
    const startedAt = performance.now()
    progressTimer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      onProgress(Math.min(100, Math.round((elapsed / durationMs) * 100)))
    }, 50)

    recorder.start()
    await new Promise<void>(resolve => setTimeout(resolve, durationMs))

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Microphone recording failed'))
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
      recorder.stop()
    })

    onProgress(100)

    const arrayBuffer = await blob.arrayBuffer()
    const audioCtx = new AudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
    const mono = toMonoFloat32(audioBuffer)
    const samples = resampleLinear(mono, audioBuffer.sampleRate, 16000)
    await audioCtx.close()

    return { blob, samples }
  } finally {
    window.clearInterval(progressTimer)
    stream.getTracks().forEach(track => track.stop())
  }
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
  const { extractMFCC } = useVoiceBiometrics()
  const behavioralCtrlRef = useRef<BehavioralController | null>(null)

  const [step, setStep] = useState<Step>('identity')
  const [form, setForm] = useState<IdentityFormState>({
    firstName: '',
    lastName: '',
    employeeId: '',
    jobRole: '',
    employerSite: '',
    email: '',
  })
  const [collected, setCollected] = useState<CollectedEnrollment>(INITIAL_COLLECTED)
  const [errorMsg, setErrorMsg] = useState('')
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [voiceProgress, setVoiceProgress] = useState(0)
  const [voiceCountdownMs, setVoiceCountdownMs] = useState(4000)

  const isCollectPhase = useMemo(
    () => ['identity', 'selfie', 'stroop', 'reflex', 'voice', 'digitspan'].includes(step),
    [step],
  )

  useEffect(() => {
    behavioralCollector.start()

    return () => {
      behavioralCollector.stop()
      signalBus.resume()
    }
  }, [])

  useEffect(() => {
    if (isCollectPhase) {
      signalBus.pause()
      return
    }

    signalBus.resume()
  }, [isCollectPhase])

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

  const resetEnrollment = useCallback(() => {
    setErrorMsg('')
    setVoiceProgress(0)
    setVoiceCountdownMs(4000)
    setIsVoiceRecording(false)
    setCollected(INITIAL_COLLECTED)
    setForm({
      firstName: '',
      lastName: '',
      employeeId: '',
      jobRole: '',
      employerSite: '',
      email: '',
    })
    setStep('identity')
  }, [])

  const handleIdentity = useCallback((e: FormEvent) => {
    e.preventDefault()

    if (!form.firstName || !form.lastName) {
      return
    }

    setCollected(current => ({
      ...current,
      firstName: form.firstName,
      lastName: form.lastName,
      employeeId: form.employeeId,
      jobRole: form.jobRole,
      employerSite: form.employerSite,
      email: form.email,
    }))
    setStep('selfie')
  }, [form])

  const handleSelfie = useCallback((b64: string) => {
    faceCollector.capture(b64)
    setCollected(current => ({ ...current, selfieB64: b64 }))
    window.setTimeout(() => setStep('stroop'), 400)
  }, [])

  const handleStroop = useCallback((score: number) => {
    setCollected(current => ({ ...current, stroopScore: score }))
    setStep('reflex')
  }, [])

  const handleReflex = useCallback((ms: number) => {
    setCollected(current => ({ ...current, reflexMs: ms }))
    setStep('voice')
  }, [])

  const handleVoiceCapture = useCallback(async () => {
    setErrorMsg('')
    setIsVoiceRecording(true)
    setVoiceProgress(0)
    setVoiceCountdownMs(4000)

    try {
      const capture = await recordVoiceCapture(4000, (progress) => {
        setVoiceProgress(progress)
        setVoiceCountdownMs(Math.max(0, 4000 - Math.round((progress / 100) * 4000)))
      })

      setCollected(current => ({
        ...current,
        voiceBlob: capture.blob,
        voiceSamples: capture.samples,
      }))
      setStep('digitspan')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voice capture failed')
      setStep('error')
    } finally {
      setIsVoiceRecording(false)
    }
  }, [])

  const onBehavioralController = useCallback((controller: BehavioralController) => {
    behavioralCtrlRef.current = controller
  }, [])

  const uploadEnrollment = useCallback(async (data: CollectedEnrollment) => {
    setStep('uploading')
    signalBus.resume()

    try {
      if (!data.firstName || !data.lastName) throw new Error('Missing identity information')
      if (!data.selfieB64) throw new Error('Missing face scan')
      if (!data.voiceBlob || !data.voiceSamples) throw new Error('Missing voice recording')

      const behavioral = behavioralCtrlRef.current?.stop() ?? null
      const vocalEmbedding = Array.from(extractMFCC(data.voiceSamples, 16000))
      const vocalQuality = clamp01((rms(data.voiceSamples) - 0.01) / 0.1)
      const vocalAccuracy = Math.round(vocalQuality * 100)

      const final: CognitiveBaseline = {
        stroopScore: data.stroopScore,
        reflexVelocityMs: data.reflexMs,
        digitSpan: data.digitSpan,
        vocalAccuracy,
        vocalEmbedding,
        vocalQuality,
        vocalSimilarityThreshold: 0.75,
        reactionTimeMs: 0,
      }

      const cognitiveBaseline = {
        stroop_score: final.stroopScore / 100,
        reflex_velocity_ms: final.reflexVelocityMs,
        digit_span: final.digitSpan ?? 0,
        vocal_accuracy: final.vocalAccuracy / 100,
        vocal_embedding: final.vocalEmbedding,
        vocal_quality: final.vocalQuality,
        vocal_similarity_threshold: final.vocalSimilarityThreshold,
        behavioral,
      }

      const { publicKey: pq_public_key, privateKey } = generateSessionKeypair()
      const pq_signature = signProfile(cognitiveBaseline, privateKey)

      const payloadBaseline = {
        ...cognitiveBaseline,
        pq_public_key,
        pq_signature,
        pq_algorithm: PQ_ALGORITHM,
      }

      const tenantId = import.meta.env.VITE_TENANT_ID
      const res = await enrollWorker({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email || '',
        selfie_b64: data.selfieB64,
        tenant_id: tenantId,
        cognitive_baseline: payloadBaseline,
      })

      setWorker({
        workerId: res.student_id,
        firstName: data.firstName,
        lastName: data.lastName,
        employeeId: data.employeeId,
        jobRole: data.jobRole,
        employerSite: data.employerSite,
        tenantId,
        cognitiveBaseline: final,
      })
      setSelfie(data.selfieB64)
      setCognitive(final)

      nav('/results', {
        state: {
          faceScore: res.confidence,
          reflexMs: final.reflexVelocityMs,
          digitSpan: final.digitSpan ?? 0,
          voiceScore: final.vocalAccuracy,
        },
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Enrollment upload failed')
      setStep('error')
    }
  }, [extractMFCC, nav, setCognitive, setSelfie, setWorker])

  const handleDigitSpan = useCallback((span: number) => {
    const finalCollected: CollectedEnrollment = {
      ...collected,
      digitSpan: span,
    }

    setCollected(finalCollected)
    void uploadEnrollment(finalCollected)
  }, [collected, uploadEnrollment])

  return (
    <BehavioralCapture enabled={isCollectPhase} onController={onBehavioralController}>
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
            <div className="badge badge-green">Step 2 of 6 — Face Scan</div>
            <h1 className="step-title">Face Scan</h1>
            <p className="step-sub">Capture your selfie locally. No network is used during collection.</p>
            <SelfieCapture onCapture={handleSelfie} />
          </>
        )}

        {step === 'stroop' && (
          <>
            <div className="badge badge-amber">Step 3 of 6 — Stroop Test</div>
            <h1 className="step-title">Stroop Test</h1>
            <StroopTest onComplete={handleStroop} />
          </>
        )}

        {step === 'reflex' && (
          <>
            <div className="badge badge-amber">Step 4 of 6 — Reflex Test</div>
            <h1 className="step-title">Reflex Test</h1>
            <NeuralReflex onComplete={handleReflex} />
          </>
        )}

        {step === 'voice' && (
          <>
            <div className="badge badge-amber">Step 5 of 6 — Voice Recording</div>
            <h1 className="step-title">Voice Recording</h1>
            <p className="step-sub">Record a 4-second voice sample locally. No network is used during collection.</p>

            {!isVoiceRecording && (
              <button className="btn btn-primary" onClick={() => void handleVoiceCapture()}>
                Start 4-Second Recording
              </button>
            )}

            <div className="card" style={{ width: '100%', marginTop: 18 }}>
              <div style={{ color: 'var(--grey)', fontSize: 13, marginBottom: 12 }}>Recording progress</div>
              <div style={{ width: '100%', height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${voiceProgress}%`, height: '100%', background: 'linear-gradient(90deg,#00C2FF,#38bdf8)', transition: 'width 80ms linear' }} />
              </div>
              <div style={{ marginTop: 12, color: '#d7f9ff', fontWeight: 700 }}>
                {isVoiceRecording ? `Recording... ${(voiceCountdownMs / 1000).toFixed(1)}s` : collected.voiceBlob ? 'Voice sample captured' : 'Ready to record'}
              </div>
            </div>
          </>
        )}

        {step === 'digitspan' && (
          <>
            <div className="badge badge-amber">Step 6 of 6 — Memory Test</div>
            <h1 className="step-title">Memory Test</h1>
            <DigitSpan onComplete={handleDigitSpan} />
          </>
        )}

        {step === 'uploading' && (
          <>
            <div className="badge badge-green">Upload</div>
            <h1 className="step-title">Uploading...</h1>
            <p className="step-sub">Submitting your enrollment package to the backend.</p>
            <div style={{ marginTop: 40, color: 'var(--green)', fontSize: 48 }}>⬡</div>
          </>
        )}

        {step === 'error' && (
          <>
            <div className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', margin: '0 auto 20px' }}>
              Error
            </div>
            <h1 className="step-title">Enrollment Failed</h1>
            <p className="step-sub">{errorMsg || 'An unexpected error occurred.'}</p>
            <button className="btn btn-outline" onClick={resetEnrollment}>Restart Enrollment</button>
          </>
        )}
      </div>
    </BehavioralCapture>
  )
}
