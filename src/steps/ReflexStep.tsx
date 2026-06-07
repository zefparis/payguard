import { useEffect, useRef, useState } from 'react'
import { REFLEX_ROUNDS } from '../constants/config'

type Phase = 'ready' | 'wait' | 'go' | 'too_early' | 'done'

type Props = { onComplete: (avgMs: number) => void }

export function ReflexStep({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<number[]>([])
  const [lastMs, setLastMs] = useState<number | null>(null)
  const goAtRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (phase !== 'wait') return
    const delay = 1500 + Math.random() * 2500
    timerRef.current = window.setTimeout(() => {
      goAtRef.current = performance.now()
      setPhase('go')
    }, delay)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'too_early') return
    const t = window.setTimeout(() => setPhase('ready'), 1200)
    return () => window.clearTimeout(t)
  }, [phase])

  const handleTap = () => {
    if (phase === 'ready') {
      setLastMs(null)
      setPhase('wait')
      return
    }
    if (phase === 'wait') {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      setPhase('too_early')
      return
    }
    if (phase === 'go') {
      const ms = performance.now() - goAtRef.current
      setLastMs(Math.round(ms))
      const next = [...results, ms]
      setResults(next)
      if (next.length >= REFLEX_ROUNDS) {
        const avg = next.reduce((a, b) => a + b, 0) / next.length
        setPhase('done')
        onComplete(avg)
      } else {
        setRound(r => r + 1)
        setPhase('ready')
      }
    }
  }

  const bg =
    phase === 'go' ? '#34c759' :
    phase === 'wait' ? '#b91c1c' :
    phase === 'too_early' ? '#ff9f0a' :
    '#2563eb'

  const label =
    phase === 'ready' ? 'DÉMARRER' :
    phase === 'wait' ? 'ATTENDEZ' :
    phase === 'go' ? 'APPUYEZ' :
    phase === 'too_early' ? 'TROP TÔT' :
    'Terminé'

  const hint =
    phase === 'ready' ? 'Appuyez dès que vous voyez le cercle vert.' :
    phase === 'wait' ? 'Attendez le vert.' :
    phase === 'go' ? 'Appuyez maintenant.' :
    phase === 'too_early' ? 'Trop tôt. Réessayez.' :
    'Traitement...'

  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <h2 style={{ marginBottom: 4 }}>Test réflexe</h2>
      <p style={{ color: 'var(--secondary-label)', fontSize: 14, marginBottom: 8 }}>
        Tour {round + 1} sur {REFLEX_ROUNDS}
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {Array.from({ length: REFLEX_ROUNDS }).map((_, i) => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: 5,
            background: i < results.length ? 'var(--green)' : i === round ? 'var(--blue)' : 'var(--separator)',
          }} />
        ))}
      </div>

      <p style={{ color: 'var(--secondary-label)', fontSize: 15, marginBottom: 16, minHeight: 40 }}>
        {hint}
      </p>

      <button
        onClick={handleTap}
        style={{
          width: '100%',
          height: 260,
          borderRadius: 20,
          border: 'none',
          background: bg,
          color: '#ffffff',
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: 1,
          cursor: 'pointer',
          touchAction: 'manipulation',
          transition: 'background 0.15s ease',
        }}
      >
        {label}
      </button>

      {lastMs !== null && phase === 'ready' && (
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--green)' }}>
          Dernier : {lastMs} ms
        </p>
      )}
    </div>
  )
}
