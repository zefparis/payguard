import { useState } from 'react'

interface Props { onComplete: (accuracy: number) => void }

const ROUNDS = [
  { type: 'letter', prompt: 'Say the letter:', value: 'B' },
  { type: 'color',  prompt: 'Name this color:', value: 'BLUE', color: '#3b82f6' },
  { type: 'math',   prompt: 'Say the answer:', value: '7 + 5 = ?' },
  { type: 'letter', prompt: 'Say the letter:', value: 'K' },
  { type: 'color',  prompt: 'Name this color:', value: 'RED', color: '#ef4444' },
]

export function VocalImprint({ onComplete }: Props) {
  const [idx, setIdx] = useState(0)
  const [recording, setRecording] = useState(false)
  const [done, setDone] = useState(0)

  function handleRecord() {
    setRecording(true)
    setTimeout(() => {
      setRecording(false)
      const next = idx + 1
      setDone(next)
      if (next >= ROUNDS.length) {
        onComplete(Math.round(85 + Math.random() * 12))
      } else {
        setIdx(next)
      }
    }, 1500)
  }

  const r = ROUNDS[idx]

  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      <div className="badge badge-cyan" style={{ margin: '0 auto 20px' }}>
        Vocal Imprint — {idx + 1}/{ROUNDS.length}
      </div>
      <p style={{ fontSize: 13, color: 'var(--grey)', marginBottom: 24 }}>
        {r.prompt}
      </p>
      <div style={{
        fontSize: r.type === 'math' ? 36 : 72, fontWeight: 800,
        color: r.color || 'var(--cyan)', marginBottom: 32,
        minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {r.type === 'color' ? '' : r.value}
        {r.type === 'color' && (
          <div style={{ width: 80, height: 80, borderRadius: 12, background: r.color }} />
        )}
      </div>
      <button className={`btn ${recording ? 'btn-danger' : 'btn-primary'}`}
        onClick={handleRecord} disabled={recording || done >= ROUNDS.length}>
        {recording ? '● Recording...' : 'Hold & Speak'}
      </button>
      {recording && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 4 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              width: 4, background: 'var(--cyan)', borderRadius: 2,
              height: 8 + Math.random() * 24,
              animation: 'none'
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
