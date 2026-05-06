import { useEffect, useRef, useState } from 'react'
import { REFLEX_ROUNDS } from '../constants/config'

type Phase = 'ready' | 'wait' | 'go' | 'done'

type Props = { onComplete: (avgMs: number) => void }

export function ReflexStep({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<number[]>([])
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

  const handleTap = () => {
    if (phase === 'ready') {
      setPhase('wait')
      return
    }
    if (phase === 'wait') {
      // Tapped too early — reset round
      if (timerRef.current) window.clearTimeout(timerRef.current)
      setPhase('ready')
      return
    }
    if (phase === 'go') {
      const ms = performance.now() - goAtRef.current
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
    phase === 'go' ? 'var(--green)' :
    phase === 'wait' ? '#5a3030' :
    'var(--system-background-secondary)'

  const label =
    phase === 'ready' ? `Round ${round + 1} of ${REFLEX_ROUNDS} — tap to start` :
    phase === 'wait' ? 'Wait for green...' :
    phase === 'go' ? 'TAP NOW' :
    'Done'

  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Reflex test</h2>
      <button
        onClick={handleTap}
        style={{
          width: '100%',
          height: 280,
          borderRadius: 20,
          border: 'none',
          background: bg,
          color: '#fff',
          fontSize: 24,
          fontWeight: 700,
          cursor: 'pointer',
          touchAction: 'manipulation',
        }}
      >
        {label}
      </button>
    </div>
  )
}
