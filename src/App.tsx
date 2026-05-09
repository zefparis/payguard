import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Enroll } from './pages/Enroll'
import { PaymentConfirm } from './pages/PaymentConfirm'
import { Results } from './pages/Results'
import { SecureEnroll } from './pages/SecureEnroll'
import { pingBackend } from './services/api'
import './index.css'

export default function App() {
  useEffect(() => { pingBackend() }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/enroll"      element={<Enroll />} />
        <Route path="/results"     element={<Results />} />
        <Route path="/secure-enroll" element={<SecureEnroll />} />
        <Route path="/verify"      element={<PaymentConfirm />} />
        <Route path="/confirm"     element={<PaymentConfirm />} />
      </Routes>
    </BrowserRouter>
  )
}