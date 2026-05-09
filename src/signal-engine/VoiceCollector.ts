import { signalBus } from './SignalBus'
import { Capacitor } from '@capacitor/core'
import { clamp01, mean, rms, toMonoFloat32, resampleLinear, extractMFCC } from '../lib/audio-utils'

class VoiceCollector {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: BlobPart[] = []

  private embedding: number[] | null = null
  private quality: number | null = null

  async start(): Promise<void> {
    if (this.recorder?.state === 'recording') {
      return
    }

    // reset previous capture results
    this.chunks = []
    this.embedding = null
    this.quality = null

    // En natif, déclencher explicitement la demande de permission et fournir
    // un message d’erreur plus clair.
    if (Capacitor.isNativePlatform()) {
      this.stream = await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          throw new Error('Microphone permission denied: ' + msg)
        })
    } else {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    }
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    this.recorder = new MediaRecorder(this.stream, { mimeType })
    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size === 0) return
      this.chunks.push(event.data)
      signalBus.emit('voice', {
        chunk: event.data,
        timestamp: Date.now(),
      })
    }
    this.recorder.start(250)
  }

  stop(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop()
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
    }

    this.recorder = null
    this.stream = null
  }

  /**
   * Stop and compute embedding/quality from buffered chunks.
   * Prefer this in flows that need `getEmbedding()` / `getQuality()`.
   */
  async stopAndCompute(): Promise<void> {
    const recorder = this.recorder

    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>(resolve => {
        recorder.onstop = () => resolve()
        recorder.stop()
      })
    }

    // Stop tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
    }

    const blob = new Blob(this.chunks, { type: recorder?.mimeType || 'audio/webm' })
    this.recorder = null
    this.stream = null

    if (blob.size === 0) {
      this.embedding = null
      this.quality = null
      return
    }

    const arrayBuffer = await blob.arrayBuffer()
    const audioCtx = new AudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
    const mono = toMonoFloat32(audioBuffer)
    const TARGET_SR = 16000
    const samples = resampleLinear(mono, audioBuffer.sampleRate, TARGET_SR)

    const emb = extractMFCC(samples, TARGET_SR)
    this.embedding = Array.from(emb)

    // quality heuristic (same as hook): energy
    const qEnergy = clamp01((rms(samples) - 0.01) / 0.1)
    this.quality = clamp01(mean(Float32Array.from([qEnergy])))
  }

  getEmbedding(): number[] | null {
    return this.embedding
  }

  getQuality(): number | null {
    return this.quality
  }
}

export const voiceCollector = new VoiceCollector()
