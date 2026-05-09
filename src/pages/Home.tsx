import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { Button } from '../ui/Button'
import { openPrivacyPolicy } from '../lib/settings'

export function Home() {
  const navigate = useNavigate()
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 32 }}>
      <div style={{ textAlign: 'center', marginTop: 64 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>PayGuard</h1>
        <p style={{ color: 'var(--secondary-label)', fontSize: 16 }}>
          Biometric payment confirmation for workers.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <Button onClick={() => navigate(ROUTES.PAY)}>Confirm a payment</Button>
        <Button variant="secondary" onClick={() => navigate(ROUTES.ENROLL)}>Enroll a worker</Button>
      </div>
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <button
          type="button"
          onClick={openPrivacyPolicy}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--secondary-label)',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 8,
          }}
        >
          Privacy Policy
        </button>
      </div>
    </div>
  )
}
