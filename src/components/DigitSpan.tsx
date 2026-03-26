import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  onComplete: (span: number) => void
}

type Phase = 'MEMORISE' | 'REPETE'

function randDigit() {
  return Math.floor(Math.random() * 10)
}

function buildSequence(len: number) {
  return Array.from({ length: len }, () => randDigit()).join('')
}

export function DigitSpan({ onComplete }: Props) {
  const rounds = useMemo(() => [4, 5, 6] as const, [])

  const [roundIdx, setRoundIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('MEMORISE')
  const [sequence, setSequence] = useState(() => buildSequence(rounds[0]))
  const [remainingMs, setRemainingMs] = useState(2000)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // évite double-complete si re-render
  const completedRef = useRef(false)

  const roundLen = rounds[roundIdx] ?? 4
  const lastSuccessSpan = rounds[Math.max(0, roundIdx - 1)] ?? 0

  // (Re)start phase MEMORISE à chaque round
  useEffect(() => {
    completedRef.current = false
    setPhase('MEMORISE')
    setRemainingMs(2000)
    setInput('')
    setError(null)
    setSequence(buildSequence(roundLen))
  }, [roundLen])

  // Countdown MEMORISE (2s)
  useEffect(() => {
    if (phase !== 'MEMORISE') return

    const start = Date.now()
    const iv = setInterval(() => {
      const elapsed = Date.now() - start
      const next = Math.max(0, 2000 - elapsed)
      setRemainingMs(next)
      if (next <= 0) {
        clearInterval(iv)
        setPhase('REPETE')
      }
    }, 50)
    return () => clearInterval(iv)
  }, [phase, roundIdx])

  const addDigit = useCallback(
    (d: number) => {
      if (phase !== 'REPETE') return
      setError(null)
      setInput(prev => {
        if (prev.length >= roundLen) return prev
        return prev + String(d)
      })
    },
    [phase, roundLen]
  )

  const backspace = useCallback(() => {
    if (phase !== 'REPETE') return
    setError(null)
    setInput(prev => prev.slice(0, -1))
  }, [phase])

  const validate = useCallback(() => {
    if (phase !== 'REPETE') return
    if (completedRef.current) return
    if (input.length !== roundLen) {
      setError(`Entrez ${roundLen} chiffres.`)
      return
    }

    const ok = input === sequence
    if (!ok) {
      completedRef.current = true
      onComplete(lastSuccessSpan)
      return
    }

    if (roundIdx >= rounds.length - 1) {
      completedRef.current = true
      onComplete(6)
      return
    }

    // round suivant
    setRoundIdx(i => i + 1)
  }, [phase, input, roundLen, sequence, roundIdx, rounds.length, onComplete, lastSuccessSpan])

  const digits = useMemo(() => Array.from({ length: 10 }, (_, i) => i), [])

  return (
    <div style={{ width: '100%' }}>
      <div
        className="badge badge-cyan"
        style={{ margin: '0 auto 16px', display: 'inline-block' }}
      >
        Digit Span — Round {roundIdx + 1}/3
      </div>

      {phase === 'MEMORISE' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--grey)', margin: '0 0 12px' }}>
            <b>Mémorise</b> la séquence.
          </p>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: 6,
              color: '#00C2FF',
              margin: '12px 0 10px',
              userSelect: 'none',
            }}
          >
            {sequence}
          </div>

          <div
            style={{
              fontSize: 13,
              color: 'var(--grey)',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span>Compte à rebours :</span>
            <b style={{ color: 'var(--text)', minWidth: 42, textAlign: 'left' }}>
              {(remainingMs / 1000).toFixed(1)}s
            </b>
          </div>
        </div>
      )}

      {phase === 'REPETE' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--grey)', margin: '0 0 12px', textAlign: 'center' }}>
            <b>Répète</b> la séquence (cachée) puis valide.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 440,
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                <span style={{ color: 'var(--grey)' }}>Saisie :</span>{' '}
                <b style={{ letterSpacing: 4, color: 'var(--text)' }}>{input.padEnd(roundLen, '•')}</b>
              </div>

              <button
                className="btn btn-outline"
                onClick={backspace}
                disabled={input.length === 0}
                style={{ padding: '8px 10px', minWidth: 44 }}
              >
                ⌫
              </button>
            </div>
          </div>

          {error && (
            <div style={{ textAlign: 'center', color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>
              {error}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 10,
              width: '100%',
              maxWidth: 440,
              margin: '0 auto 14px',
            }}
          >
            {digits.map(d => (
              <button
                key={d}
                onClick={() => addDigit(d)}
                disabled={input.length >= roundLen}
                style={{
                  height: 52,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  fontSize: 18,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={validate}
            disabled={input.length !== roundLen}
            style={{ width: '100%', maxWidth: 440, margin: '0 auto', display: 'block' }}
          >
            Valider
          </button>
        </div>
      )}
    </div>
  )
}
