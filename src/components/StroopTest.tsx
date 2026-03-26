import { useEffect, useRef } from 'react'

type Props = {
  onComplete: (score: number) => void
}

const COLORS = [
  { key: 'RED', label: 'Rouge', hex: '#ef4444' },
  { key: 'GREEN', label: 'Vert', hex: '#22c55e' },
  { key: 'BLUE', label: 'Bleu', hex: '#3b82f6' },
  { key: 'YELLOW', label: 'Jaune', hex: '#f59e0b' },
] as const

function makeRound() {
  const word = COLORS[Math.floor(Math.random() * COLORS.length)]
  let color = COLORS[Math.floor(Math.random() * COLORS.length)]
  const congruent = Math.random() > 0.5

  if (congruent) {
    color = word
  } else {
    while (color.key === word.key) {
      color = COLORS[Math.floor(Math.random() * COLORS.length)]
    }
  }

  return { word, color, correct: color.key }
}

export function StroopTest({ onComplete }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }

    ;(window as any).__stroopComplete = onComplete

    const buttonsMarkup = COLORS.map(
      (color) => `
        <button
          type="button"
          data-pick="${color.key}"
          style="
            width: 100%;
            min-height: 64px;
            border-radius: 12px;
            border: 1px solid ${color.hex};
            background: rgba(255,255,255,0.02);
            color: ${color.hex};
            font-size: 18px;
            font-weight: 800;
            cursor: pointer;
          "
        >
          ${color.label}
        </button>
      `,
    ).join('')

    el.innerHTML = `
      <div style="width:100%;text-align:center;background:#050814;border:1px solid rgba(0,194,255,0.18);border-radius:18px;padding:24px 18px;color:#fff;box-sizing:border-box;">
        <div class="badge badge-cyan" style="margin:0 auto 14px;display:inline-block;">Stroop Test — <span data-round>1</span>/10</div>
        <div style="font-size:13px;color:var(--grey);margin-bottom:10px;">Choisissez la <b style="color:#fff;">couleur de l'encre</b>, pas le mot.</div>
        <div style="font-size:13px;color:var(--grey);margin-bottom:18px;">Temps restant : <b data-timer style="color:#00C2FF;">5.0s</b></div>
        <div data-stimulus style="font-size:64px;font-weight:900;letter-spacing:2px;min-height:92px;display:flex;align-items:center;justify-content:center;margin-bottom:22px;"></div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
          ${buttonsMarkup}
        </div>
      </div>
    `

    const roundEl = el.querySelector('[data-round]') as HTMLSpanElement | null
    const timerEl = el.querySelector('[data-timer]') as HTMLSpanElement | null
    const stimulusEl = el.querySelector('[data-stimulus]') as HTMLDivElement | null
    const buttonEls = Array.from(el.querySelectorAll('[data-pick]')) as HTMLButtonElement[]

    if (!roundEl || !timerEl || !stimulusEl || buttonEls.length === 0) {
      return () => {
        delete (window as any).__stroopComplete
        el.innerHTML = ''
      }
    }

    const ROUNDS = 10
    const ROUND_DURATION_MS = 5000
    let idx = 0
    let score = 0
    let activeRound = makeRound()
    let answered = false
    let finished = false
    let roundStartedAt = 0
    let rafId = 0
    let nextRoundTimeout = 0

    const setButtonsDisabled = (disabled: boolean) => {
      buttonEls.forEach((button) => {
        button.disabled = disabled
        button.style.opacity = disabled ? '0.6' : '1'
        button.style.cursor = disabled ? 'default' : 'pointer'
      })
    }

    const renderStimulus = () => {
      roundEl.textContent = String(idx + 1)
      stimulusEl.textContent = activeRound.word.label
      stimulusEl.style.color = activeRound.color.hex
      stimulusEl.style.fontSize = '64px'
      timerEl.textContent = '5.0s'
      setButtonsDisabled(false)
    }

    const finish = () => {
      if (finished) {
        return
      }

      finished = true
      cancelAnimationFrame(rafId)
      window.clearTimeout(nextRoundTimeout)
      const finalScore = Math.round((score / ROUNDS) * 100)
      const complete = (window as any).__stroopComplete as ((value: number) => void) | undefined
      complete?.(finalScore)
    }

    const loop = (now: number) => {
      if (finished) {
        return
      }

      const remaining = Math.max(0, ROUND_DURATION_MS - (now - roundStartedAt))
      timerEl.textContent = `${(remaining / 1000).toFixed(1)}s`

      if (!answered && remaining <= 0) {
        handleAnswer('')
        return
      }

      rafId = window.requestAnimationFrame(loop)
    }

    const startRound = () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(nextRoundTimeout)
      activeRound = makeRound()
      answered = false
      roundStartedAt = performance.now()
      renderStimulus()
      rafId = window.requestAnimationFrame(loop)
    }

    const handleAnswer = (picked: string) => {
      if (answered || finished) {
        return
      }

      answered = true
      cancelAnimationFrame(rafId)
      setButtonsDisabled(true)

      const correct = picked === activeRound.correct
      if (correct) {
        score += 1
      }

      stimulusEl.textContent = correct ? '✓' : '✗'
      stimulusEl.style.color = correct ? '#22c55e' : '#ef4444'
      stimulusEl.style.fontSize = '56px'
      timerEl.textContent = '0.0s'

      nextRoundTimeout = window.setTimeout(() => {
        idx += 1
        if (idx >= ROUNDS) {
          finish()
          return
        }

        startRound()
      }, 400)
    }

    const listeners = buttonEls.map((button) => {
      const listener = () => handleAnswer(button.dataset.pick ?? '')
      button.addEventListener('click', listener)
      return { button, listener }
    })

    startRound()

    return () => {
      finished = true
      cancelAnimationFrame(rafId)
      window.clearTimeout(nextRoundTimeout)
      listeners.forEach(({ button, listener }) => button.removeEventListener('click', listener))
      delete (window as any).__stroopComplete
      el.innerHTML = ''
    }
  }, [onComplete])

  return <div ref={ref} style={{ width: '100%' }} />
}
