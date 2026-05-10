import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { flowReducer, initialFlowState } from '../state/flowReducer'
import { SelfieStep } from '../steps/SelfieStep'
import { VoiceStep } from '../steps/VoiceStep'
import { ReflexStep } from '../steps/ReflexStep'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { ErrorState } from '../ui/ErrorState'
import { lookup, payVerify, ApiError } from '../lib/api'
import { withRetry } from '../lib/retry'
import { MAX_ATTEMPTS } from '../constants/config'
import { ROUTES } from '../constants/routes'

export function Pay() {
  const [state, dispatch] = useReducer(flowReducer, { ...initialFlowState, step: 'identity' })
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState('')
  const [employer, setEmployer] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [identityError, setIdentityError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (state.step !== 'verifying') return
    const c = state.captured
    if (!c.selfieB64 || !c.vocalEmbedding || c.reactionMs == null || !state.studentId) return

    let cancelled = false
    ;(async () => {
      try {
        const result = await withRetry(
          () => payVerify({
            selfie_b64: c.selfieB64!,
            first_name: state.firstName,
            last_name: state.lastName,
            student_id: state.studentId!,
            vocal_embedding: c.vocalEmbedding!,
            reaction_ms: c.reactionMs!,
          }),
          MAX_ATTEMPTS,
        )
        if (cancelled) return

        dispatch({ type: 'SET_DECISION', decision: result.decision, trustScore: result.trust_score })
        navigate(ROUTES.RESULT, {
          state: {
            decision: result.decision,
            trustScore: result.trust_score,
            context: 'pay',
            firstName: state.firstName,
            lastName: state.lastName,
            amount: state.amount,
            period: state.payPeriod,
            employer: state.employer,
          },
        })
      } catch (err) {
        if (cancelled) return
        let userMessage = 'Connection failed. Your data is saved. Tap Retry to submit.'
        if (err instanceof ApiError) {
          if (err.code === 'FACE_NOT_DETECTED') {
            userMessage = 'No face detected. Please ensure good lighting and retry.'
          } else if (err.code === 'NO_MATCH' || err.code === 'IDENTITY_MISMATCH') {
            userMessage = 'Identity verification failed. Please ensure you are the enrolled worker.'
          } else if (err.code === 'MISSING_API_KEY' || err.code === 'INVALID_API_KEY') {
            userMessage = 'App configuration error. Please contact support.'
          } else if (err.status >= 500) {
            userMessage = 'Server error. Please try again in a moment.'
          } else if (err.status === 422) {
            userMessage = err.message
          }
        }
        dispatch({ type: 'UPLOAD_ERROR', message: userMessage })
      }
    })()

    return () => { cancelled = true }
  }, [state.step, state.captured, state.studentId, state.firstName, state.lastName, state.amount, state.payPeriod, state.employer, navigate])

  const submitIdentity = async () => {
    setIdentityError(null)
    setLookingUp(true)
    try {
      const resp = await lookup({ first_name: firstName.trim(), last_name: lastName.trim() })
      if (!resp.found || !resp.student_id) {
        setIdentityError('Worker not enrolled. Please enroll first.')
        return
      }
      dispatch({ type: 'SET_IDENTITY', firstName: firstName.trim(), lastName: lastName.trim(), studentId: resp.student_id })
      dispatch({ type: 'SET_PAYMENT', amount: Number(amount), payPeriod: period.trim(), employer: employer.trim() })
      dispatch({ type: 'GO_TO_STEP', step: 'selfie' })
    } catch {
      setIdentityError('Network error. Check your connection.')
    } finally {
      setLookingUp(false)
    }
  }

  if (state.step === 'identity') {
    const amountNum = Number(amount)
    const valid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && amountNum > 0 && amountNum < 1000000 && period.trim().length > 0 && employer.trim().length > 0
    return (
      <div style={{ padding: 32 }}>
        <h2 style={{ marginBottom: 24 }}>Confirm payment</h2>
        <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" autoCapitalize="words" autoComplete="given-name" style={inputStyle} />
        <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" autoCapitalize="words" autoComplete="family-name" style={inputStyle} />
        <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Amount (ZAR)" type="tel" style={inputStyle} />
        <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Period (e.g. May 2026)" autoCapitalize="words" style={inputStyle} />
        <input value={employer} onChange={e => setEmployer(e.target.value)} placeholder="Employer / Site" autoCapitalize="words" style={inputStyle} />
        {identityError && <p style={{ color: 'var(--red)', marginBottom: 12 }}>{identityError}</p>}
        <Button disabled={!valid || lookingUp} onClick={submitIdentity}>
          {lookingUp ? 'Looking up...' : 'Continue'}
        </Button>
      </div>
    )
  }

  if (state.step === 'selfie') {
    return <SelfieStep onComplete={(b64) => {
      dispatch({ type: 'CAPTURE_SELFIE', selfieB64: b64 })
      dispatch({ type: 'GO_TO_STEP', step: 'voice' })
    }} />
  }

  if (state.step === 'voice') {
    return <VoiceStep onComplete={(emb) => {
      dispatch({ type: 'CAPTURE_VOICE', embedding: emb })
      dispatch({ type: 'GO_TO_STEP', step: 'reflex' })
    }} />
  }

  if (state.step === 'reflex') {
    return <ReflexStep onComplete={(ms) => {
      dispatch({ type: 'CAPTURE_REFLEX', ms })
      dispatch({ type: 'GO_TO_STEP', step: 'verifying' })
    }} />
  }

  if (state.step === 'verifying') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Spinner size={48} />
        <h2 style={{ marginTop: 24 }}>Verifying identity</h2>
        <p style={{ color: 'var(--secondary-label)', marginTop: 8, textAlign: 'center' }}>
          Please wait, this takes a few seconds.
        </p>
      </div>
    )
  }

  if (state.step === 'upload-error') {
    return (
      <ErrorState
        title="Upload failed"
        message={state.uploadError ?? 'Your data is saved. Tap Retry to submit.'}
        onRetry={() => dispatch({ type: 'GO_TO_STEP', step: 'verifying' })}
        retryLabel="Retry"
      />
    )
  }

  return null
}

const inputStyle = {
  width: '100%',
  padding: 16,
  fontSize: 17,
  border: '1px solid var(--separator)',
  borderRadius: 12,
  background: 'var(--system-background-secondary)',
  color: 'var(--label)',
  marginBottom: 12,
} as const
