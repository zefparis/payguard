import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type ResultsMetrics = {
  faceScore: number
  reflexMs: number
  digitSpan: number
  voiceScore: number
}

type ResultsProps = Partial<ResultsMetrics>

type LocationState = Partial<ResultsMetrics> | null

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function Results(props: ResultsProps) {
  const nav = useNavigate()
  const location = useLocation()
  const state = (location.state as LocationState) ?? null

  const faceScore = props.faceScore ?? state?.faceScore ?? 0
  const reflexMs = props.reflexMs ?? state?.reflexMs ?? 0
  const digitSpan = props.digitSpan ?? state?.digitSpan ?? 0
  const voiceScore = props.voiceScore ?? state?.voiceScore ?? 0

  const trustScore = useMemo(() => {
    const normalizedFace = clamp(faceScore, 0, 100)
    const normalizedReflex = clamp(100 - ((reflexMs - 180) / 420) * 100, 0, 100)
    const normalizedSpan = clamp((digitSpan / 6) * 100, 0, 100)
    const normalizedVoice = clamp(voiceScore, 0, 100)

    return Math.round(
      normalizedFace * 0.35 +
        normalizedReflex * 0.2 +
        normalizedSpan * 0.2 +
        normalizedVoice * 0.25,
    )
  }, [digitSpan, faceScore, reflexMs, voiceScore])

  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    let rafId = 0
    const duration = 1400
    const start = performance.now()

    const tick = (now: number) => {
      const progress = clamp((now - start) / duration, 0, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(Math.round(trustScore * eased))

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick)
      }
    }

    rafId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [trustScore])

  const gaugeColor = trustScore > 80 ? '#22c55e' : trustScore >= 50 ? '#f59e0b' : '#ef4444'
  const radius = 82
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (circumference * animatedScore) / 100

  const metrics = [
    {
      label: 'Facial match',
      value: `${faceScore.toFixed(2)}%`,
      accent: '#00C2FF',
    },
    {
      label: 'Reflex time',
      value: `${Math.round(reflexMs)}ms`,
      accent: '#22c55e',
    },
    {
      label: 'Cognitive span',
      value: `${digitSpan}/6`,
      accent: '#f59e0b',
    },
    {
      label: 'Voice quality',
      value: `${Math.round(voiceScore)}`,
      accent: '#a855f7',
    },
  ]

  const badges = [
    '✓ Post-quantum signed',
    '✓ Celestial entropy sealed',
    '✓ Biometric profile stored',
  ]

  return (
    <div className="page" style={{ minHeight: '100vh', justifyContent: 'flex-start', paddingTop: 32, paddingBottom: 32 }}>
      <style>{`
        @keyframes resultsFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(0,194,255,0); }
          50% { transform: scale(1.02); box-shadow: 0 0 18px rgba(0,194,255,0.22); }
        }
      `}</style>

      <div className="logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>← PAYGUARD</div>
      <div style={{ width: '100%', maxWidth: 560, animation: 'resultsFadeUp 0.55s ease-out both' }}>
        <div className="badge badge-green" style={{ margin: '0 auto 16px', display: 'inline-flex' }}>
          Enrollment Report
        </div>
        <h1 className="step-title" style={{ marginBottom: 10 }}>HCS Trust Results</h1>
        <p className="step-sub" style={{ maxWidth: 520, margin: '0 auto 24px' }}>
          Your biometric enrollment has been processed across facial, reflex, cognitive and voice layers.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, width: '100%' }}>
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="card"
              style={{
                width: '100%',
                background: 'linear-gradient(180deg, rgba(7,11,18,0.96) 0%, rgba(10,14,24,0.9) 100%)',
                border: '1px solid rgba(0,194,255,0.12)',
                animation: 'resultsFadeUp 0.55s ease-out both',
                animationDelay: `${index * 120}ms`,
              }}
            >
              <div style={{ color: 'var(--grey)', fontSize: 13, marginBottom: 10 }}>{metric.label}</div>
              <div style={{ color: metric.accent, fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{metric.value}</div>
            </div>
          ))}
        </div>

        <div
          className="card"
          style={{
            width: '100%',
            marginTop: 18,
            background: 'radial-gradient(circle at top, rgba(0,194,255,0.12), rgba(4,7,12,0.96) 55%)',
            border: '1px solid rgba(0,194,255,0.16)',
            animation: 'resultsFadeUp 0.7s ease-out both',
            animationDelay: '240ms',
          }}
        >
          <div style={{ textAlign: 'center', color: '#8fb7c5', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18 }}>
            HCS Trust Score
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div style={{ position: 'relative', width: 220, height: 220 }}>
              <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="110" cy="110" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="16" fill="none" />
                <circle
                  cx="110"
                  cy="110"
                  r={radius}
                  stroke={gaugeColor}
                  strokeWidth="16"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: 'stroke-dashoffset 90ms linear, stroke 220ms ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 56, fontWeight: 900, color: gaugeColor, lineHeight: 1 }}>{animatedScore}</div>
                <div style={{ marginTop: 10, fontSize: 12, letterSpacing: '0.16em', color: '#d7f9ff', textTransform: 'uppercase', textAlign: 'center' }}>
                  Identity Certified
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', color: '#9fb8c4', fontSize: 14 }}>
            Weighted from face, reflex, cognitive span and voice quality signals.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, width: '100%', marginTop: 18 }}>
          {badges.map((badge, index) => (
            <div
              key={badge}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid rgba(0,194,255,0.14)',
                background: 'rgba(0,194,255,0.06)',
                color: '#dffbff',
                fontWeight: 700,
                animation: `resultsFadeUp 0.7s ease-out both, badgePulse 2.2s ease-in-out ${0.6 + index * 0.15}s infinite`,
                animationDelay: `${360 + index * 120}ms, ${0.6 + index * 0.15}s`,
              }}
            >
              {badge}
            </div>
          ))}
        </div>

        <button className="btn btn-success" style={{ width: '100%', marginTop: 22 }} onClick={() => nav('/verify')}>
          Proceed to Payment →
        </button>
      </div>
    </div>
  )
}
