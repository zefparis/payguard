import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { Home } from './pages/Home'
import { Enroll } from './pages/Enroll'
import { Pay } from './pages/Pay'
import { Result } from './pages/Result'
import { DEMOGUARD_ENABLED } from './demoguard/constants'
import { DemoGuard } from './pages/DemoGuard'

function DemoGuardDisabled() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
      <h2>DemoGuard is disabled in this build.</h2>
      <p>Set VITE_DEMOGUARD_ENABLED=true to enable DemoGuard Mobile.</p>
    </div>
  )
}

export function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path={ROUTES.HOME} element={<Home />} />
        <Route path={ROUTES.ENROLL} element={<Enroll />} />
        <Route path={ROUTES.PAY} element={<Pay />} />
        <Route path={ROUTES.RESULT} element={<Result />} />
        <Route path={ROUTES.DEMOGUARD} element={DEMOGUARD_ENABLED ? <DemoGuard /> : <DemoGuardDisabled />} />
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
    </div>
  )
}
