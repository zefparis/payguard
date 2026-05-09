import { useCallback, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Microphone } from '@mozartec/capacitor-microphone'

export type AudioError =
  | { kind: 'permission-denied'; message?: string; name?: string }
  | { kind: 'unavailable'; message?: string; name?: string }
  | { kind: 'other'; message: string }

export function useAudio() {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<AudioError | null>(null)

  const recordFor = useCallback(async (durationMs: number): Promise<Float32Array[]> => {
    setRecording(true)
    setError(null)
    try {
      if (Capacitor.isNativePlatform()) {
        // Native path: use Microphone plugin
        const permResult = await Microphone.requestPermissions()
        if (permResult.microphone !== 'granted') {
          setError({ kind: 'permission-denied', message: 'Microphone permission denied' })
          return []
        }

        await Microphone.startRecording()
        await new Promise(r => setTimeout(r, durationMs))
        const result = await Microphone.stopRecording()

        // Convert base64 audio to Float32Array[]
        const base64 = result.base64String ?? ''
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        // Return as single chunk for backend processing
        const floats = new Float32Array(bytes.buffer)
        return [floats]

      } else {
        // Web path: keep existing getUserMedia
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx()
        const source = ctx.createMediaStreamSource(stream)
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        const samples: Float32Array[] = []

        source.connect(processor)
        processor.connect(ctx.destination)
        processor.onaudioprocess = (e) => {
          samples.push(new Float32Array(e.inputBuffer.getChannelData(0)))
        }

        await new Promise(r => setTimeout(r, durationMs))

        processor.disconnect()
        source.disconnect()
        stream.getTracks().forEach(t => t.stop())
        await ctx.close()
        return samples
      }
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setError({ kind: 'permission-denied', message: err.message, name: err.name })
        } else {
          setError({ kind: 'unavailable', message: err.message, name: err.name })
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
