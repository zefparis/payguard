import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Enroll } from './pages/Enroll'
import { PaymentConfirm } from './pages/PaymentConfirm'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<Home />} />
        <Route path="/enroll"  element={<Enroll />} />
        <Route path="/confirm" element={<PaymentConfirm />} />
      </Routes>
    </BrowserRouter>
  )
}
