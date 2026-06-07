import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { flowReducer, initialFlowState } from '../state/flowReducer'
import { SelfieStep } from '../steps/SelfieStep'
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
  const [showNumpad, setShowNumpad] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (state.step !== 'verifying') return
    const c = state.captured
    if (!c.selfieB64 || c.reactionMs == null || !state.studentId) return

    let cancelled = false
    ;(async () => {
      try {
        const result = await withRetry(
          () => payVerify({
            selfie_b64: c.selfieB64!,
            first_name: state.firstName,
            last_name: state.lastName,
            student_id: state.studentId!,
            vocal_embedding: Array(192).fill(0),
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
        let userMessage = 'Erreur de connexion. Vos données sont sauvegardées.'
        if (err instanceof ApiError) {
          if (err.code === 'FACE_NOT_DETECTED') {
            userMessage = 'Visage non détecté. Placez votre visage dans le cadre.'
          } else if (err.code === 'NO_MATCH' || err.code === 'IDENTITY_MISMATCH') {
            userMessage = 'Vérification refusée. Vérifiez l’utilisateur.'
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
  }, [state.step, state.captured, state.studentId, state.firstName, state.lastName, state.amount, state.payPeriod, state.employer, navigate])

  const submitIdentity = async () => {
    setIdentityError(null)
    setLookingUp(true)
    try {
      const resp = await lookup({ first_name: firstName.trim(), last_name: lastName.trim() })
      if (!resp.found || !resp.student_id) {
        setIdentityError('Utilisateur non enregistré.')
        return
      }
      dispatch({ type: 'SET_IDENTITY', firstName: firstName.trim(), lastName: lastName.trim(), studentId: resp.student_id })
      dispatch({ type: 'SET_PAYMENT', amount: Number(amount), payPeriod: period.trim(), employer: employer.trim() })
      dispatch({ type: 'GO_TO_STEP', step: 'selfie' })
    } catch {
      setIdentityError('Erreur de connexion.')
    } finally {
      setLookingUp(false)
    }
  }

  if (state.step === 'identity') {
    const amountNum = Number(amount)
    const valid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && amountNum > 0 && amountNum < 1000000 && period.trim().length > 0 && employer.trim().length > 0
    return (
      <div style={{ padding: 32 }}>
        <h2 style={{ marginBottom: 24 }}>Confirmer le paiement</h2>
        <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Prénom" autoCapitalize="words" autoComplete="given-name" style={inputStyle} />
        <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Nom" autoCapitalize="words" autoComplete="family-name" style={inputStyle} />
        <div
          onClick={() => setShowNumpad(true)}
          style={{ ...inputStyle, display: 'flex', alignItems: 'center', cursor: 'pointer', color: amount ? 'var(--label)' : 'var(--secondary-label)', userSelect: 'none' }}
        >
          {amount || 'Montant (ZAR)'}
        </div>
        {showNumpad && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowNumpad(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--system-background)', borderRadius: '16px 16px 0 0', padding: '16px 12px env(safe-area-inset-bottom, 12px)' }}>
              <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 16, minHeight: 40 }}>{amount || '0'} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--secondary-label)' }}>ZAR</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map(k => (
                  <button
                    key={k}
                    onClick={() => { if (k === '⌫') setAmount(prev => prev.slice(0,-1)); else if (k) setAmount(prev => prev.length < 7 ? prev + k : prev); }}
                    disabled={!k}
                    style={{ padding: 16, fontSize: 22, fontWeight: 600, border: 'none', borderRadius: 12, background: k ? 'var(--system-background-secondary)' : 'transparent', color: 'var(--label)', cursor: k ? 'pointer' : 'default' }}
                  >{k}</button>
                ))}
              </div>
              <button onClick={() => setShowNumpad(false)} style={{ width: '100%', marginTop: 12, padding: 14, fontSize: 16, fontWeight: 700, border: 'none', borderRadius: 12, background: 'var(--green)', color: '#fff', cursor: 'pointer' }}>Terminé</button>
            </div>
          </div>
        )}
        <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Période (ex. mai 2026)" autoCapitalize="words" style={inputStyle} />
        <input value={employer} onChange={e => setEmployer(e.target.value)} placeholder="Employeur / site" autoCapitalize="words" style={inputStyle} />
        {identityError && <p style={{ color: 'var(--red)', marginBottom: 12 }}>{identityError}</p>}
        <Button disabled={!valid || lookingUp} onClick={submitIdentity}>
          {lookingUp ? 'Recherche...' : 'Continuer'}
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
        <h2 style={{ marginTop: 24 }}>Vérification en cours</h2>
        <p style={{ color: 'var(--secondary-label)', marginTop: 8, textAlign: 'center' }}>
          Patientez quelques secondes.
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
