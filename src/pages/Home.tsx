import { useNavigate } from 'react-router-dom'

export function Home() {
  const nav = useNavigate()
  return (
    <div className="page">
      <div className="logo">💰 PAYGUARD</div>
      <h1 className="step-title" style={{ fontSize: 30, marginBottom: 8 }}>Payroll Validation</h1>
      <p className="step-sub">
        Biometric payment confirmation for workers.<br />
        Powered by Hybrid Vector — 3 French patents.
      </p>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => nav('/enroll')}>
          <div className="badge badge-green">New worker</div>
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Register</h2>
          <p style={{ fontSize: 13, color: 'var(--grey)', lineHeight: 1.6 }}>
            First-time enrollment — takes 3 minutes.<br />
            Identity + biometric profile + cognitive baseline.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 20 }}>
            Start Enrollment →
          </button>
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={() => nav('/confirm')}>
          <div className="badge badge-green">Payment</div>
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Confirm Payment</h2>
          <p style={{ fontSize: 13, color: 'var(--grey)', lineHeight: 1.6 }}>
            Received your salary? Confirm with your face.<br />
            Biometrically certified proof of payment.
          </p>
          <button className="btn btn-success" style={{ marginTop: 20 }}>
            Confirm Payment →
          </button>
        </div>
      </div>

      <div style={{ marginTop: 40, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['AWS Rekognition', 'ML-KEM FIPS 203', 'Air-gap ready'].map(t => (
          <span key={t} className="badge badge-green">{t}</span>
        ))}
      </div>
    </div>
  )
}
