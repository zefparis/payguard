import { useCallback, useRef, useState } from 'react'

export function useAudio() {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)

  const recordFor = useCallback(async (durationMs: number): Promise<Float32Array[]> => {
    setRecording(true)
    setError(null)
    try {
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
      setError(err instanceof Error ? err.message : 'Microphone unavailable')
      throw err
    } finally {
      setRecording(false)
    }
  }, [])

  return { recordFor, recording, error }
}
