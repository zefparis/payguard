import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { DIGIT_SPAN_ROUNDS } from '../constants/config'

type Phase = 'show' | 'input' | 'done'

type Props = { onComplete: (score: number) => void }

function generateSequence(length: number): string {
  let s = ''
  for (let i = 0; i < length; i++) s += Math.floor(Math.random() * 10).toString()
  return s
}

export function DigitSpanStep({ onComplete }: Props) {
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<Phase>('show')
  const [sequence, setSequence] = useState(() => generateSequence(4))
  const [input, setInput] = useState('')
  const [correct, setCorrect] = useState(0)

  useEffect(() => {
    if (phase !== 'show') return
    const t = window.setTimeout(() => setPhase('input'), 2000)
    return () => window.clearTimeout(t)
  }, [phase, round])

  const submit = () => {
    const ok = input === sequence
    const nextCorrect = correct + (ok ? 1 : 0)
    if (round + 1 >= DIGIT_SPAN_ROUNDS) {
      setPhase('done')
      onComplete(nextCorrect / DIGIT_SPAN_ROUNDS)
    } else {
      setCorrect(nextCorrect)
      setRound(r => r + 1)
      setSequence(generateSequence(4 + Math.floor((round + 1) / 2)))
      setInput('')
      setPhase('show')
    }
  }

  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <h2 style={{ marginBottom: 8 }}>Mémoire</h2>
      <p style={{ color: 'var(--secondary-label)', marginBottom: 24 }}>
        Tour {round + 1} sur {DIGIT_SPAN_ROUNDS}
      </p>
      {phase === 'show' && (
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: 8, margin: '40px 0' }}>
          {sequence}
        </div>
      )}
      {phase === 'input' && (
        <>
          <input
            type="tel"
            value={input}
            onChange={e => setInput(e.target.value.replace(/\D/g, ''))}
            placeholder="Entrez les chiffres"
            inputMode="numeric"
            autoFocus
            style={{
              width: '100%',
              padding: 16,
              fontSize: 24,
              textAlign: 'center',
              border: '1px solid var(--separator)',
              borderRadius: 12,
              background: 'var(--system-background-secondary)',
              color: 'var(--label)',
              marginBottom: 16,
              letterSpacing: 4,
            }}
          />
          <Button disabled={input.length === 0} onClick={submit}>Valider</Button>
        </>
      )}
    </div>
  )
}
