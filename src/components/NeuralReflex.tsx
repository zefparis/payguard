import { useEffect, useRef } from 'react'

type Props = {
  onComplete: (velocityMs: number) => void
}

export function NeuralReflex({ onComplete }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }

    ;(window as any).__reflexComplete = onComplete

    el.innerHTML = `
      <div style="width:100%;text-align:center;background:#04070d;border:1px solid rgba(0,255,0,0.18);border-radius:18px;padding:24px 18px;color:#fff;box-sizing:border-box;">
        <div class="badge badge-cyan" style="margin:0 auto 14px;display:inline-block;">Neural Reflex — <span data-round>1</span>/3</div>
        <div style="font-size:13px;color:var(--grey);margin-bottom:16px;">Touchez la cible dès qu'elle devient <b style="color:#00FF00;">verte</b>.</div>
        <div data-average style="font-size:13px;color:var(--grey);margin-bottom:14px;">Moyenne : -- ms</div>
        <button type="button" data-surface style="width:100%;min-height:320px;border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:#090d18;color:#cbd5e1;cursor:pointer;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;">
          <div data-status style="font-size:32px;font-weight:800;letter-spacing:0.04em;">Prêt...</div>
          <div data-subtitle style="font-size:16px;color:#94a3b8;">Attendez le signal</div>
          <div data-target style="width:200px;height:200px;border-radius:999px;background:#00FF00;box-shadow:0 0 40px rgba(0,255,0,0.4);display:none;align-items:center;justify-content:center;color:#03120a;font-size:30px;font-weight:900;">Appuyez !</div>
        </button>
      </div>
    `

    const roundEl = el.querySelector('[data-round]') as HTMLSpanElement | null
    const averageEl = el.querySelector('[data-average]') as HTMLDivElement | null
    const surfaceEl = el.querySelector('[data-surface]') as HTMLButtonElement | null
    const statusEl = el.querySelector('[data-status]') as HTMLDivElement | null
    const subtitleEl = el.querySelector('[data-subtitle]') as HTMLDivElement | null
    const targetEl = el.querySelector('[data-target]') as HTMLDivElement | null

    if (!roundEl || !averageEl || !surfaceEl || !statusEl || !subtitleEl || !targetEl) {
      return () => {
        delete (window as any).__reflexComplete
        el.innerHTML = ''
      }
    }

    const ROUNDS = 3
    let roundIndex = 0
    let phase: 'ready' | 'go' | 'feedback' | 'done' = 'ready'
    let goStartedAt = 0
    let readyStartedAt = 0
    let readyDelay = 0
    let readyTimeout = 0
    let feedbackTimeout = 0
    let rafId = 0
    let finished = false
    const times: number[] = []

    const updateAverage = () => {
      if (times.length === 0) {
        averageEl.textContent = 'Moyenne : -- ms'
        return
      }

      const avg = Math.round(times.reduce((sum, value) => sum + value, 0) / times.length)
      averageEl.textContent = `Moyenne : ${avg} ms`
    }

    const renderReady = () => {
      roundEl.textContent = String(roundIndex + 1)
      surfaceEl.style.background = '#090d18'
      surfaceEl.style.borderColor = 'rgba(255,255,255,0.08)'
      statusEl.style.color = '#fff'
      statusEl.textContent = 'Prêt...'
      subtitleEl.textContent = 'Attendez le signal'
      targetEl.style.display = 'none'
      updateAverage()
    }

    const renderGo = () => {
      roundEl.textContent = String(roundIndex + 1)
      surfaceEl.style.background = '#03120a'
      surfaceEl.style.borderColor = 'rgba(0,255,0,0.48)'
      statusEl.style.color = '#00FF00'
      statusEl.textContent = 'Appuyez !'
      subtitleEl.textContent = 'Touchez immédiatement la cible'
      targetEl.style.display = 'flex'
      updateAverage()
    }

    const renderFeedback = (label: string, color: string) => {
      surfaceEl.style.background = '#090d18'
      surfaceEl.style.borderColor = 'rgba(255,255,255,0.08)'
      statusEl.style.color = color
      statusEl.textContent = label
      subtitleEl.textContent = 'Préparation du round suivant'
      targetEl.style.display = 'none'
      updateAverage()
    }

    const finish = () => {
      if (finished) {
        return
      }

      finished = true
      phase = 'done'
      window.clearTimeout(readyTimeout)
      window.clearTimeout(feedbackTimeout)
      cancelAnimationFrame(rafId)
      const avg = Math.round(times.reduce((sum, value) => sum + value, 0) / times.length)
      renderFeedback(`${avg} ms`, '#00FF00')
      subtitleEl.textContent = 'Test complete'
      const complete = (window as any).__reflexComplete as ((value: number) => void) | undefined
      complete?.(avg)
    }

    const readyLoop = (now: number) => {
      if (finished || phase !== 'ready') {
        return
      }

      const remaining = Math.max(0, readyDelay - (now - readyStartedAt))
      subtitleEl.textContent = `Signal dans ${(remaining / 1000).toFixed(1)}s`
      rafId = window.requestAnimationFrame(readyLoop)
    }

    const goLoop = (now: number) => {
      if (finished || phase !== 'go') {
        return
      }

      const pulse = (Math.sin((now - goStartedAt) / 140) + 1) / 2
      const scale = 1 + pulse * 0.06
      targetEl.style.transform = `scale(${scale.toFixed(3)})`
      rafId = window.requestAnimationFrame(goLoop)
    }

    const startReadyPhase = () => {
      window.clearTimeout(readyTimeout)
      window.clearTimeout(feedbackTimeout)
      cancelAnimationFrame(rafId)
      phase = 'ready'
      readyStartedAt = performance.now()
      readyDelay = 1000 + Math.random() * 2000
      renderReady()
      rafId = window.requestAnimationFrame(readyLoop)
      readyTimeout = window.setTimeout(() => {
        cancelAnimationFrame(rafId)
        phase = 'go'
        goStartedAt = performance.now()
        renderGo()
        rafId = window.requestAnimationFrame(goLoop)
      }, readyDelay)
    }

    const handleTap = () => {
      if (finished) {
        return
      }

      if (phase === 'ready') {
        window.clearTimeout(readyTimeout)
        cancelAnimationFrame(rafId)
        phase = 'feedback'
        renderFeedback('Trop tôt !', '#ef4444')
        feedbackTimeout = window.setTimeout(() => {
          startReadyPhase()
        }, 700)
        return
      }

      if (phase !== 'go') {
        return
      }

      phase = 'feedback'
      window.clearTimeout(readyTimeout)
      cancelAnimationFrame(rafId)
      const ms = Math.round(performance.now() - goStartedAt)
      times.push(ms)
      renderFeedback(`${ms} ms`, '#00FF00')

      feedbackTimeout = window.setTimeout(() => {
        roundIndex += 1
        if (roundIndex >= ROUNDS) {
          finish()
          return
        }

        startReadyPhase()
      }, 600)
    }

    surfaceEl.addEventListener('click', handleTap)
    startReadyPhase()

    return () => {
      finished = true
      window.clearTimeout(readyTimeout)
      window.clearTimeout(feedbackTimeout)
      cancelAnimationFrame(rafId)
      surfaceEl.removeEventListener('click', handleTap)
      delete (window as any).__reflexComplete
      el.innerHTML = ''
    }
  }, [onComplete])

  return <div ref={ref} style={{ width: '100%' }} />
}
