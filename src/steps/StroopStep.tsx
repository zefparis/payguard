import { useEffect, useState } from 'react'
import { STROOP_ROUNDS } from '../constants/config'

type ColorName = 'RED' | 'GREEN' | 'BLUE' | 'YELLOW'
const COLORS: ColorName[] = ['RED', 'GREEN', 'BLUE', 'YELLOW']
const HEX: Record<ColorName, string> = {
  RED: '#ff453a', GREEN: '#34c759', BLUE: '#0a84ff', YELLOW: '#ffd60a',
}

type Props = { onComplete: (accuracy: number) => void }

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function StroopStep({ onComplete }: Props) {
  const [round, setRound] = useState(0)
  const [word, setWord] = useState<ColorName>('RED')
  const [color, setColor] = useState<ColorName>('GREEN')
  const [correct, setCorrect] = useState(0)

  useEffect(() => {
    setWord(pick(COLORS))
    setColor(pick(COLORS))
  }, [round])

  const choose = (chosen: ColorName) => {
    const ok = chosen === color
    const nextCorrect = correct + (ok ? 1 : 0)
    if (round + 1 >= STROOP_ROUNDS) {
      onComplete(nextCorrect / STROOP_ROUNDS)
    } else {
      setCorrect(nextCorrect)
      setRound(r => r + 1)
    }
  }

  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <h2 style={{ marginBottom: 8 }}>Couleur</h2>
      <p style={{ color: 'var(--secondary-label)', marginBottom: 24 }}>
        Appuyez sur la couleur. Tour {round + 1} sur {STROOP_ROUNDS}.
      </p>
      <div
        style={{
          fontSize: 64, fontWeight: 800, color: HEX[color],
          margin: '48px 0', userSelect: 'none',
        }}
      >
        {word}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => choose(c)}
            style={{
              height: 54, borderRadius: 14, border: 'none',
              background: HEX[c], color: '#fff',
              fontSize: 17, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}
