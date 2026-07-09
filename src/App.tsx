import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { Home } from './pages/Home'
import { Enroll } from './pages/Enroll'
import { Pay } from './pages/Pay'
import { Result } from './pages/Result'
import { DEMOGUARD_ENABLED } from './demoguard/constants'
import { DemoGuard } from './pages/DemoGuard'

export function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path={ROUTES.HOME} element={<Home />} />
        <Route path={ROUTES.ENROLL} element={<Enroll />} />
        <Route path={ROUTES.PAY} element={<Pay />} />
        <Route path={ROUTES.RESULT} element={<Result />} />
        {DEMOGUARD_ENABLED && <Route path={ROUTES.DEMOGUARD} element={<DemoGuard />} />}
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
    </div>
  )
}
