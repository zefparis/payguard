import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelfieCapture } from '../components/SelfieCapture'
import { verifyWorker } from '../services/api'

type Step = 'details' | 'selfie' | 'verifying' | 'success' | 'failed'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function PaymentConfirm() {
  const nav = useNavigate()
  const [step, setStep] = useState<Step>('details')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [employer, setEmployer] = useState('')
  const [result, setResult] = useState<{ similarity: number; firstName: string } | null>(null)
  const [, setSelfieB64] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const timestamp = new Date().toLocaleString('en-ZA', { 
    dateStyle: 'medium', 
    timeStyle: 'short' 
  })

  function handleDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName || !lastName || !amount || !month || !year) return
    setStep('selfie')
  }

  async function handleSelfie(b64: string) {
    setSelfieB64(b64)
    setStep('verifying')
    try {
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
    <div className="page">
      <div className="logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>← PAYGUARD</div>

      {step === 'details' && (
        <>
          <div className="badge badge-green">Step 1 — Payment Details</div>
          <h1 className="step-title">Confirm Your Payment</h1>
          <p className="step-sub">Enter your payment details to verify salary receipt.</p>
          <form onSubmit={handleDetails} style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>First Name *</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="John" />
              </div>
              <div className="field">
                <label>Last Name *</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Smith" />
              </div>
            </div>
            <div className="field">
              <label>Employee ID</label>
              <input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="EMP-001" />
            </div>
            <div className="field">
              <label>Amount (ZAR) *</label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                required 
                placeholder="15000" 
                step="0.01"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Pay Period Month *</label>
                <select value={month} onChange={e => setMonth(e.target.value)} required>
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
                  onChange={e => setYear(e.target.value)} 
                  required 
                  placeholder="2026"
                  min="2020"
                  max="2030"
                />
              </div>
            </div>
            <div className="field">
              <label>Employer / Site Name</label>
              <input value={employer} onChange={e => setEmployer(e.target.value)} placeholder="ABC Construction — Site B" />
            </div>
            <button className="btn btn-primary" type="submit">
              Continue →
            </button>
          </form>
        </>
      )}

      {step === 'selfie' && (
        <>
          <div className="badge badge-green">Step 2 — Identity Verification</div>
          <h1 className="step-title">Face Verification</h1>
          <p className="step-sub">Look at the camera to confirm your identity.</p>
          <SelfieCapture onCapture={handleSelfie} />
        </>
      )}

      {step === 'verifying' && (
        <>
          <h1 className="step-title">Verifying...</h1>
          <p className="step-sub">Matching your face against registered profile</p>
          <div style={{ marginTop: 40, color: 'var(--green)', fontSize: 48 }}>💰</div>
        </>
      )}

      {step === 'success' && (
        <>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <div className="badge badge-green" style={{ margin: '0 auto 16px' }}>✓ Confirmed</div>
          <h1 className="step-title">Payment Confirmed</h1>
          <p className="step-sub">Your salary receipt has been biometrically verified</p>
          <div className="card" style={{ width: '100%', marginTop: 16 }}>
            <div className="metric-row">
              <span className="metric-label">Worker</span>
              <span className="metric-value">{firstName} {lastName}</span>
            </div>
            {employeeId && (
              <div className="metric-row">
                <span className="metric-label">Employee ID</span>
                <span className="metric-value">{employeeId}</span>
              </div>
            )}
            <div className="metric-row">
              <span className="metric-label">Amount</span>
              <span className="metric-value" style={{ color: 'var(--green)', fontSize: 16, fontWeight: 700 }}>
                ZAR {parseFloat(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Pay Period</span>
              <span className="metric-value">{month} {year}</span>
            </div>
            {employer && (
              <div className="metric-row">
                <span className="metric-label">Employer</span>
                <span className="metric-value">{employer}</span>
              </div>
            )}
            <div className="metric-row">
              <span className="metric-label">Timestamp</span>
              <span className="metric-value">{timestamp}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Match Score</span>
              <span className="metric-value" style={{ color: 'var(--green)' }}>{result?.similarity}%</span>
            </div>
          </div>
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: 'rgba(34,197,94,0.08)', 
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--grey)',
            textAlign: 'center'
          }}>
            🔒 This confirmation is biometrically certified
          </div>
          <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => nav('/')}>
            Done
          </button>
        </>
      )}

      {step === 'failed' && (
        <>
          <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
          <div className="badge" style={{ background:'rgba(239,68,68,0.12)', color:'var(--red)', border:'1px solid rgba(239,68,68,0.25)', margin:'0 auto 16px' }}>
            Not Verified
          </div>
          <h1 className="step-title">Identity Not Verified</h1>
          <p className="step-sub">
            {errorMsg || `Face match failed — payment cannot be confirmed. Match score: ${result?.similarity}%`}
          </p>
          <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 20 }}>
            <button className="btn btn-outline" onClick={() => setStep('selfie')}>Try Again</button>
            <button className="btn btn-outline" onClick={() => nav('/')}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}
