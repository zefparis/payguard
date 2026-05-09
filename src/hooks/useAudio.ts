import { useCallback, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'

// Camera plugin only supports 'camera'|'photos' but Android groups
// camera and microphone permissions together at runtime
type AnyPermissions = { permissions: string[] }

export type AudioError =
  | { kind: 'permission-denied'; message?: string; name?: string }
  | { kind: 'unavailable' }
  | { kind: 'other'; message: string }

export function useAudio() {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<AudioError | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)

  const recordFor = useCallback(async (durationMs: number): Promise<Float32Array[]> => {
    setRecording(true)
    setError(null)
    try {
      // Sur Android natif, demande la permission micro via Capacitor
      // avant getUserMedia pour éviter le NotAllowedError du WebView
      if (Capacitor.getPlatform() === 'android') {
        const result = await (Camera.requestPermissions as unknown as (opts: AnyPermissions) => Promise<Record<string, string>>)({
          permissions: ['microphone']
        })
        if (result.microphone !== 'granted') {
          setError({ kind: 'permission-denied', message: 'Microphone permission denied', name: 'NotAllowedError' })
          setRecording(false)
          return []
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      ctxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      const samples: Float32Array[] = []

      source.connect(processor)
      processor.connect(ctx.destination)
      processor.onaudioprocess = (e) => {
        const ch = e.inputBuffer.getChannelData(0)
        samples.push(new Float32Array(ch))
      }

      await new Promise(r => setTimeout(r, durationMs))

      processor.disconnect()
      source.disconnect()
      stream.getTracks().forEach(t => t.stop())
      await ctx.close()
      ctxRef.current = null

      return samples
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setError({ kind: 'permission-denied', message: err.message, name: err.name })
        } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
          setError({ kind: 'unavailable' })
        } else {
          setError({ kind: 'other', message: err.message })
        }
      } else {
        setError({ kind: 'other', message: err instanceof Error ? err.message : 'Microphone unavailable' })
      }
      throw err
    } finally {
      setRecording(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { recordFor, recording, error, clearError }
}
