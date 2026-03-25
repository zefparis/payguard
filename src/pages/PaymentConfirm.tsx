import { memo, useCallback, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelfieCapture } from '../components/SelfieCapture'
import { verifyWorker } from '../services/api'
import { BehavioralCapture } from '../components/BehavioralCapture'
import type { BehavioralController, BehavioralProfile } from '../hooks/useBehavioral'
import { generateSessionKeypair, PQ_ALGORITHM, signProfile } from '../services/postQuantum'

type Step = 'identity' | 'details' | 'selfie' | 'verifying' | 'success' | 'failed'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

type IdentityStepProps = {
  firstName: string
  lastName: string
  onSubmit: (e: FormEvent) => void
  onFirstNameChange: (e: ChangeEvent<HTMLInputElement>) => void
  onLastNameChange: (e: ChangeEvent<HTMLInputElement>) => void
}

const IdentityStep = memo(function IdentityStep({
  firstName,
  lastName,
  onSubmit,
  onFirstNameChange,
  onLastNameChange,
}: IdentityStepProps) {
  return (
    <>
      <div className="badge badge-green">Step 1 — Identity</div>
      <h1 className="step-title">Confirm Payment</h1>
      <p className="step-sub">Enter your name. Then confirm with a selfie.</p>
      <form onSubmit={onSubmit} style={{ width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>First Name *</label>
            <input value={firstName} onChange={onFirstNameChange} required placeholder="John" />
          </div>
          <div className="field">
            <label>Last Name *</label>
            <input value={lastName} onChange={onLastNameChange} required placeholder="Smith" />
          </div>
        </div>
        <button className="btn btn-primary" type="submit">
          Continue →
        </button>
      </form>
    </>
  )
})

type PaymentDetailsStepProps = {
  amount: string
  employer: string
  month: string
  months: string[]
  year: string
  onSubmit: (e: FormEvent) => void
  onAmountChange: (e: ChangeEvent<HTMLInputElement>) => void
  onEmployerChange: (e: ChangeEvent<HTMLInputElement>) => void
  onMonthChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onYearChange: (e: ChangeEvent<HTMLInputElement>) => void
}

const PaymentDetailsStep = memo(function PaymentDetailsStep({
  amount,
  employer,
  month,
  months,
  year,
  onSubmit,
  onAmountChange,
  onEmployerChange,
  onMonthChange,
  onYearChange,
}: PaymentDetailsStepProps) {
  return (
    <>
      <div className="badge badge-green">Step 2 — Payment Details</div>
      <h1 className="step-title">Payment Details</h1>
      <p className="step-sub">Amount, pay period, employer/site.</p>
      <form onSubmit={onSubmit} style={{ width: '100%' }}>
        <div className="field">
          <label>Amount (ZAR) *</label>
          <input
            type="number"
            value={amount}
            onChange={onAmountChange}
            required
            placeholder="15000"
            step="0.01"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Pay Period Month *</label>
            <select value={month} onChange={onMonthChange} required>
              <option value="">Select month</option>
              {months.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Year *</label>
            <input
              type="number"
              value={year}
              onChange={onYearChange}
              required
              placeholder="2026"
              min="2020"
              max="2030"
            />
          </div>
        </div>
        <div className="field">
          <label>Employer / Site *</label>
          <input value={employer} onChange={onEmployerChange} required placeholder="ABC Construction — Site B" />
        </div>
        <button className="btn btn-primary" type="submit">
          Continue →
        </button>
      </form>
    </>
  )
})

export function PaymentConfirm() {
  const nav = useNavigate()
  const [step, setStep] = useState<Step>('identity')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [employer, setEmployer] = useState('')
  const [result, setResult] = useState<{ similarity: number; firstName: string } | null>(null)
  const [, setSelfieB64] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const behavioralCtrlRef = useRef<BehavioralController | null>(null)
  const [behavioralProfile, setBehavioralProfile] = useState<BehavioralProfile | null>(null)
  const [pqPublicKey, setPqPublicKey] = useState<string | null>(null)
  const [pqSignature, setPqSignature] = useState<string | null>(null)

  const behavioralCaptured = useMemo(() => Boolean(behavioralProfile), [behavioralProfile])
  const pqCaptured = useMemo(() => Boolean(pqPublicKey && pqSignature), [pqPublicKey, pqSignature])
  const deviceType = useMemo(() => behavioralProfile?.device.device_type ?? 'unknown', [behavioralProfile])

  const timestamp = useMemo(() => new Date().toLocaleString('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }), [])

  const period = useMemo(() => `${month} ${year}`, [month, year])

  const onBehavioralController = useCallback((controller: BehavioralController) => {
    behavioralCtrlRef.current = controller
  }, [])

  const handleFirstNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value)
  }, [])

  const handleLastNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value)
  }, [])

  const handleAmountChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value)
  }, [])

  const handleMonthChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setMonth(e.target.value)
  }, [])

  const handleYearChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setYear(e.target.value)
  }, [])

  const handleEmployerChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmployer(e.target.value)
  }, [])

  const handleIdentity = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!firstName || !lastName) return
    setStep('details')
  }, [firstName, lastName])

  const handleDetails = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!amount || !month || !year) return
    setStep('selfie')
  }, [amount, month, year])

  async function handleSelfie(b64: string) {
    setSelfieB64(b64)
    setStep('verifying')
    try {
      // Stop behavioral capture right before network calls
      const behavioral = behavioralCtrlRef.current?.stop()
      if (behavioral) setBehavioralProfile(behavioral)

      // Create session PQ keypair + deterministic signature of payment details
      const pqProfile = {
        first_name: firstName,
        last_name: lastName,
        amount_zar: amount,
        period,
        employer_site: employer,
        behavioral,
      }
      const { publicKey: pq_public_key, privateKey } = generateSessionKeypair()
      const pq_signature = signProfile(pqProfile, privateKey)
      setPqPublicKey(pq_public_key)
      setPqSignature(pq_signature)

      const res = await verifyWorker({ selfie_b64: b64, first_name: firstName, last_name: lastName })
      if (res.verified) {
        setResult({ similarity: Math.round(res.similarity), firstName: res.first_name })
        setStep('success')
      } else {
        setResult({ similarity: Math.round(res.similarity), firstName: firstName })
        setStep('failed')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed')
      setStep('failed')
    }
  }

  return (
    <BehavioralCapture enabled={step !== 'identity' && step !== 'details'} onController={onBehavioralController}>
      <div className="page">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>← PAYGUARD</div>

        {step === 'identity' && (
          <IdentityStep
            firstName={firstName}
            lastName={lastName}
            onSubmit={handleIdentity}
            onFirstNameChange={handleFirstNameChange}
            onLastNameChange={handleLastNameChange}
          />
        )}

        {step === 'details' && (
          <PaymentDetailsStep
            amount={amount}
            employer={employer}
            month={month}
            months={MONTHS}
            year={year}
            onSubmit={handleDetails}
            onAmountChange={handleAmountChange}
            onEmployerChange={handleEmployerChange}
            onMonthChange={handleMonthChange}
            onYearChange={handleYearChange}
          />
        )}

        {step === 'selfie' && (
          <>
            <div className="badge badge-green">Step 3 — Selfie Verification</div>
            <h1 className="step-title">Face Verification</h1>
            <p className="step-sub">Look at the camera to confirm your identity.</p>
            <SelfieCapture onCapture={handleSelfie} />
          </>
        )}

        {step === 'verifying' && (
          <>
            <h1 className="step-title">Verifying...</h1>
            <p className="step-sub">Matching your face against registered profile</p>
            <div style={{ marginTop: 40, color: 'var(--green)', fontSize: 48 }}>⬡</div>
          </>
        )}

        {step === 'success' && (
          <>
            <div className="badge badge-green" style={{ margin: '0 auto 16px' }}>✓ Payment Confirmed</div>
            <h1 className="step-title">Payment Confirmed</h1>
            <p className="step-sub">Biometrically verified receipt</p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
              <div className="badge badge-green" style={{ marginBottom: 0 }}>device: {deviceType}</div>
            </div>

            <div className="card" style={{ width: '100%', marginTop: 8 }}>
              <div className="metric-row">
                <span className="metric-label">Worker</span>
                <span className="metric-value">{firstName} {lastName}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Amount</span>
                <span className="metric-value">ZAR {parseFloat(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Period</span>
                <span className="metric-value">{period}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Employer / Site</span>
                <span className="metric-value">{employer}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Time</span>
                <span className="metric-value">{timestamp}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Match</span>
                <span className="metric-value">{result?.similarity}%</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Behavioral</span>
                <span className="metric-value">{behavioralCaptured ? 'captured ✓' : 'not captured'}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Post-quantum</span>
                <span className="metric-value">{pqCaptured ? `${PQ_ALGORITHM} ✓` : 'not captured'}</span>
              </div>
            </div>
            <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => nav('/')}
            >Done</button>
          </>
        )}

        {step === 'failed' && (
          <>
            <div className="badge" style={{ background:'rgba(239,68,68,0.12)', color:'var(--red)', border:'1px solid rgba(239,68,68,0.25)', margin:'0 auto 16px' }}>
              Not Verified
            </div>
            <h1 className="step-title">Identity Not Verified</h1>
            <p className="step-sub">
              {errorMsg || `Face match failed. Match score: ${result?.similarity}%`}
            </p>
            <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setStep('selfie')}>Try Again</button>
              <button className="btn btn-outline" onClick={() => nav('/')}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </BehavioralCapture>
  )
}
