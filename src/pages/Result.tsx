import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { ROUTES } from '../constants/routes'
import type { Decision } from '../types/flow'

type ResultLocationState = {
  decision?: Decision
  trustScore?: number
  context?: 'enroll' | 'pay'
  firstName?: string
  lastName?: string
  amount?: number
  period?: string
  employer?: string
  studentId?: string
}

export function Result() {
  const location = useLocation()
  const navigate = useNavigate()
  const s = (location.state as ResultLocationState | null) ?? {}

  const decision = s.decision ?? 'REVIEW'
  const isApproved = decision === 'APPROVED'
  const isRejected = decision === 'REJECTED' || decision === 'MANUAL_REVIEW'

  const color = isApproved ? 'var(--green)' : isRejected ? 'var(--red)' : 'var(--orange)'
  const title = s.context === 'enroll' ? 'Enrollment complete' : isApproved ? 'Payment approved' : isRejected ? 'Payment rejected' : 'Pending review'
  const subtitle = s.context === 'enroll' ? 'The worker is now enrolled.' : isApproved ? 'You may proceed with disbursement.' : isRejected ? 'This payment has been blocked.' : 'A supervisor must validate.'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 32 }}>
      <div style={{ textAlign: 'center', marginTop: 64 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: color, opacity: 0.12, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {isApproved ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : isRejected ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          )}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, color }}>{title}</h1>
        <p style={{ color: 'var(--secondary-label)', fontSize: 16 }}>{subtitle}</p>

        {s.context === 'pay' && s.firstName && (
          <div style={{ marginTop: 32, padding: 16, background: 'var(--system-background-secondary)', borderRadius: 12, textAlign: 'left' }}>
            <Row label="Worker" value={`${s.firstName} ${s.lastName ?? ''}`} />
            {typeof s.amount === 'number' && <Row label="Amount" value={`ZAR ${s.amount.toLocaleString()}`} />}
            {s.period && <Row label="Period" value={s.period} />}
            {s.employer && <Row label="Employer / Site" value={s.employer} />}
          </div>
        )}
      </div>
      <Button variant="secondary" onClick={() => navigate(ROUTES.HOME, { replace: true })}>
        Start a new request
      </Button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--separator)' }}>
      <span style={{ color: 'var(--secondary-label)' }}>{label}</span>
      <span style={{ color: 'var(--label)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
