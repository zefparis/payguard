import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { flowReducer, initialFlowState } from '../state/flowReducer'
import { SelfieStep } from '../steps/SelfieStep'
import { ReflexStep } from '../steps/ReflexStep'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { ErrorState } from '../ui/ErrorState'
import { enroll, ApiError } from '../lib/api'
import { withRetry } from '../lib/retry'
import { TENANT_ID, MAX_ATTEMPTS } from '../constants/config'
import { ROUTES } from '../constants/routes'
import { saveFlowState, clearFlowState } from '../storage/queue'

export function Enroll() {
  const [state, dispatch] = useReducer(flowReducer, { ...initialFlowState, step: 'identity' })
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    saveFlowState(state)
  }, [state])

  useEffect(() => {
    if (state.step !== 'verifying') return
    const c = state.captured
    if (!c.selfieB64 || c.reactionMs == null) return

    let cancelled = false
    ;(async () => {
      try {
        const result = await withRetry(
          () => enroll({
            selfie_b64: c.selfieB64!,
            first_name: state.firstName,
            last_name: state.lastName,
            email: email || undefined,
            tenant_id: TENANT_ID,
            cognitive_baseline: {
              reflex_ms: c.reactionMs!,
            },
          }),
          MAX_ATTEMPTS,
        )
        if (cancelled) return
        await clearFlowState()
        dispatch({ type: 'SET_DECISION', decision: 'APPROVED', trustScore: result.confidence / 100 })
        navigate(ROUTES.RESULT, { state: { decision: 'APPROVED', context: 'enroll', studentId: result.student_id } })
      } catch (err) {
        if (cancelled) return
        let userMessage = 'Erreur de connexion. Vos données sont sauvegardées.'
        if (err instanceof ApiError) {
          if (err.code === 'FACE_NOT_DETECTED') {
            userMessage = 'Visage non détecté. Placez votre visage dans le cadre.'
          } else if (err.code === 'MISSING_API_KEY' || err.code === 'INVALID_API_KEY') {
            userMessage = 'Erreur de configuration. Contactez le support.'
          } else if (err.status >= 500) {
            userMessage = 'Erreur serveur. Réessayez dans un instant.'
          } else if (err.status === 422) {
            userMessage = err.message
          }
        }
        dispatch({ type: 'UPLOAD_ERROR', message: userMessage })
      }
    })()

    return () => { cancelled = true }
  }, [state.step, state.captured, state.firstName, state.lastName, email, navigate])

  if (state.step === 'identity') {
    return (
      <div style={{ padding: 32 }}>
        <h2 style={{ marginBottom: 24 }}>Informations utilisateur</h2>
        <input
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          placeholder="Prénom"
          style={inputStyle}
        />
        <input
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          placeholder="Nom"
          style={inputStyle}
        />
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email (facultatif)"
          type="email"
          style={inputStyle}
        />
        <Button
          disabled={firstName.trim().length < 2 || lastName.trim().length < 2}
          onClick={() => {
            dispatch({ type: 'SET_IDENTITY', firstName: firstName.trim(), lastName: lastName.trim() })
            dispatch({ type: 'GO_TO_STEP', step: 'selfie' })
          }}
        >
          Continuer
        </Button>
      </div>
    )
  }

  if (state.step === 'selfie') {
    return <SelfieStep onComplete={(b64) => {
      dispatch({ type: 'CAPTURE_SELFIE', selfieB64: b64 })
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
        <h2 style={{ marginTop: 24 }}>Inscription en cours</h2>
        <p style={{ color: 'var(--secondary-label)', marginTop: 8, textAlign: 'center' }}>
          Envoi sécurisé des données.
        </p>
      </div>
    )
  }

  if (state.step === 'upload-error') {
    return (
      <ErrorState
        title="Envoi échoué"
        message={state.uploadError ?? 'Vos données sont sauvegardées.'}
        onRetry={() => dispatch({ type: 'GO_TO_STEP', step: 'verifying' })}
        retryLabel="Réessayer"
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
