import { useEffect, useRef } from 'react'

type Props = {
  onComplete: (span: number) => void
}

function randDigit() {
  return Math.floor(Math.random() * 10)
}

function buildSequence(len: number) {
  return Array.from({ length: len }, () => randDigit()).join('')
}

export function DigitSpan({ onComplete }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }

    ;(window as any).__digitSpanComplete = onComplete

    el.innerHTML = `
      <div style="width:100%;background:#060a12;border:1px solid rgba(0,194,255,0.18);border-radius:18px;padding:24px 18px;color:#fff;box-sizing:border-box;">
        <div class="badge badge-cyan" style="margin:0 auto 16px;display:inline-block;">Digit Span — Round <span data-round>1</span>/3</div>
        <div data-phase-label style="font-size:13px;color:var(--grey);text-align:center;margin-bottom:12px;">Memorize the sequence.</div>
        <div data-sequence style="font-size:64px;font-weight:900;letter-spacing:8px;color:#00C2FF;text-align:center;min-height:92px;display:flex;align-items:center;justify-content:center;font-family:Syne,system-ui,sans-serif;"></div>
        <div data-timer style="font-size:13px;color:var(--grey);text-align:center;margin-top:8px;">Countdown: <span data-timer-value style="color:#fff;font-weight:700;">2.0s</span></div>
        <div data-progress-track style="width:100%;max-width:440px;height:10px;margin:12px auto 0;background:rgba(255,255,255,0.06);border-radius:999px;overflow:hidden;">
          <div data-progress-fill style="width:100%;height:100%;background:linear-gradient(90deg,#00C2FF,#38bdf8);border-radius:999px;"></div>
        </div>
        <div data-input-wrap style="display:none;margin-top:18px;">
          <div style="width:100%;max-width:440px;margin:0 auto 14px;background:#0d1320;border:1px solid rgba(0,194,255,0.12);border-radius:12px;padding:12px 14px;text-align:center;">
            <span style="color:var(--grey);font-size:13px;">Input:</span>
            <b data-input style="display:block;margin-top:6px;letter-spacing:8px;color:#00C2FF;font-size:28px;min-height:34px;font-family:Syne,system-ui,sans-serif;">••••</b>
          </div>
          <div data-grid style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;max-width:440px;margin:0 auto;"></div>
        </div>
      </div>
    `

    const roundEl = el.querySelector('[data-round]') as HTMLSpanElement | null
    const phaseLabelEl = el.querySelector('[data-phase-label]') as HTMLDivElement | null
    const sequenceEl = el.querySelector('[data-sequence]') as HTMLDivElement | null
    const timerWrapEl = el.querySelector('[data-timer]') as HTMLDivElement | null
    const timerEl = el.querySelector('[data-timer-value]') as HTMLSpanElement | null
    const progressTrackEl = el.querySelector('[data-progress-track]') as HTMLDivElement | null
    const progressFillEl = el.querySelector('[data-progress-fill]') as HTMLDivElement | null
    const inputWrapEl = el.querySelector('[data-input-wrap]') as HTMLDivElement | null
    const inputEl = el.querySelector('[data-input]') as HTMLDivElement | null
    const gridEl = el.querySelector('[data-grid]') as HTMLDivElement | null

    if (!roundEl || !phaseLabelEl || !sequenceEl || !timerWrapEl || !timerEl || !progressTrackEl || !progressFillEl || !inputWrapEl || !inputEl || !gridEl) {
      return () => {
        delete (window as any).__digitSpanComplete
        el.innerHTML = ''
      }
    }

    const rounds = [4, 5, 6] as const
    let roundIdx = 0
    let phase: 'MEMORISE' | 'REPETE' | 'DONE' = 'MEMORISE'
    let sequence = buildSequence(rounds[0])
    let input = ''
    let finished = false
    let rafId = 0
    let memoryStartedAt = 0
    let evaluateTimeout = 0

    // évite double-complete si re-render
    const digits = Array.from({ length: 10 }, (_, i) => i)

    // (Re)start phase MEMORISE à chaque round
    const renderInput = () => {
      const roundLen = rounds[roundIdx] ?? 4
      inputEl.textContent = input.padEnd(roundLen, '•')
    }

    const setButtonsDisabled = (disabled: boolean) => {
      const buttons = Array.from(gridEl.querySelectorAll('[data-digit]')) as HTMLButtonElement[]
      buttons.forEach((button) => {
        button.disabled = disabled
        button.style.opacity = disabled ? '0.55' : '1'
        button.style.cursor = disabled ? 'default' : 'pointer'
      })
    }

    const complete = (span: number) => {
      if (finished) {
        return
      }

      finished = true
      phase = 'DONE'
      cancelAnimationFrame(rafId)
      window.clearTimeout(evaluateTimeout)
      setButtonsDisabled(true)
      const done = (window as any).__digitSpanComplete as ((value: number) => void) | undefined
      done?.(span)
    }

    const renderRepeat = () => {
      const roundLen = rounds[roundIdx] ?? 4
      roundEl.textContent = String(roundIdx + 1)
      phaseLabelEl.textContent = 'Repeat the sequence using the keypad.'
      sequenceEl.textContent = '•'.repeat(roundLen)
      sequenceEl.style.color = '#223042'
      sequenceEl.style.fontFamily = 'Syne,system-ui,sans-serif'
      timerWrapEl.style.display = 'none'
      progressTrackEl.style.display = 'none'
      inputWrapEl.style.display = 'block'
      renderInput()
      setButtonsDisabled(false)
    }

    const renderMemorise = () => {
      roundEl.textContent = String(roundIdx + 1)
      phaseLabelEl.textContent = 'Memorize the sequence.'
      sequenceEl.textContent = sequence
      sequenceEl.style.color = '#00C2FF'
      sequenceEl.style.fontFamily = 'Syne,system-ui,sans-serif'
      timerWrapEl.style.display = 'block'
      progressTrackEl.style.display = 'block'
      inputWrapEl.style.display = 'none'
      timerEl.textContent = '2.0s'
      progressFillEl.style.width = '100%'
    }

    // Countdown MEMORISE (2s)
    const memoryLoop = (now: number) => {
      if (finished || phase !== 'MEMORISE') {
        return
      }

      const remaining = Math.max(0, 2000 - (now - memoryStartedAt))
      timerEl.textContent = `${(remaining / 1000).toFixed(1)}s`
      progressFillEl.style.width = `${(remaining / 2000) * 100}%`

      if (remaining <= 0) {
        phase = 'REPETE'
        renderRepeat()
        return
      }

      rafId = window.requestAnimationFrame(memoryLoop)
    }

    const startRound = () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(evaluateTimeout)
      phase = 'MEMORISE'
      input = ''
      sequence = buildSequence(rounds[roundIdx] ?? 4)
      renderMemorise()
      memoryStartedAt = performance.now()
      rafId = window.requestAnimationFrame(memoryLoop)
    }

    const evaluate = () => {
      if (finished) {
        return
      }

      const lastSuccessSpan = rounds[Math.max(0, roundIdx - 1)] ?? 0
      setButtonsDisabled(true)

      if (input !== sequence) {
        complete(lastSuccessSpan)
        return
      }

      if (roundIdx >= rounds.length - 1) {
        complete(6)
        return
      }

      roundIdx += 1
      startRound()
    }

    const addDigit = (digit: number) => {
      if (finished || phase !== 'REPETE') {
        return
      }

      const roundLen = rounds[roundIdx] ?? 4
      if (input.length >= roundLen) {
        return
      }

      input += String(digit)
      renderInput()

      if (input.length === roundLen) {
        evaluateTimeout = window.setTimeout(() => {
          evaluate()
        }, 180)
      }
    }

    gridEl.innerHTML = digits.map(
      (digit) => `
        <button
          type="button"
          data-digit="${digit}"
          style="
            height: 56px;
            border-radius: 12px;
            border: 1px solid rgba(0,194,255,0.125);
            background: #1a2332;
            color: #fff;
            font-size: 20px;
            font-weight: 800;
            cursor: pointer;
            min-height: 64px;
            -webkit-tap-highlight-color: transparent;
          "
        >
          ${digit}
        </button>
      `,
    ).join('')

    const buttonEls = Array.from(gridEl.querySelectorAll('[data-digit]')) as HTMLButtonElement[]
    const listeners = buttonEls.map((button) => {
      const listener = () => addDigit(Number(button.dataset.digit ?? '0'))
      button.addEventListener('click', listener)
      return { button, listener }
    })

    startRound()

    return () => {
      finished = true
      cancelAnimationFrame(rafId)
      window.clearTimeout(evaluateTimeout)
      listeners.forEach(({ button, listener }) => button.removeEventListener('click', listener))
      delete (window as any).__digitSpanComplete
      el.innerHTML = ''
    }
  }, [onComplete])

  return <div ref={ref} style={{ width: '100%' }} />
}
