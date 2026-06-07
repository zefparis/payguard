import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { Button } from '../ui/Button'
import { openPrivacyPolicy } from '../lib/settings'

export function Home() {
  const navigate = useNavigate()
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 32 }}>
      <div style={{ textAlign: 'center', marginTop: 64 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>UniPay Guard</h1>
        <p style={{ color: 'var(--secondary-label)', fontSize: 16 }}>
          Confirmation biométrique des paiements.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <Button onClick={() => navigate(ROUTES.PAY)}>Payer</Button>
        <Button variant="secondary" onClick={() => navigate(ROUTES.ENROLL)}>S'inscrire</Button>
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
          Politique de confidentialité
        </button>
      </div>
    </div>
  )
}
