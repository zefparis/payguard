import { signalBus } from './SignalBus'
import { Capacitor } from '@capacitor/core'

// Lightweight MFCC embedding (copied/adapted from hooks/useVoiceBiometrics)
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function mean(arr: Float32Array): number {
  let s = 0
  for (let i = 0; i < arr.length; i += 1) s += arr[i]
  return arr.length ? s / arr.length : 0
}

function rms(arr: Float32Array): number {
  let s = 0
  for (let i = 0; i < arr.length; i += 1) s += arr[i] * arr[i]
  return arr.length ? Math.sqrt(s / arr.length) : 0
}

function toMonoFloat32(audioBuffer: AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) return audioBuffer.getChannelData(0)
  const left = audioBuffer.getChannelData(0)
  const right = audioBuffer.getChannelData(1)
  const out = new Float32Array(audioBuffer.length)
  for (let i = 0; i < out.length; i += 1) out[i] = (left[i] + right[i]) * 0.5
  return out
}

function resampleLinear(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input
  const ratio = outputRate / inputRate
  const outLen = Math.max(1, Math.floor(input.length * ratio))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i += 1) {
    const t = i / ratio
    const i0 = Math.floor(t)
    const i1 = Math.min(input.length - 1, i0 + 1)
    const frac = t - i0
    out[i] = input[i0] * (1 - frac) + input[i1] * frac
  }
  return out
}

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700)
}

function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1)
}

function hamming(N: number): Float32Array {
  const w = new Float32Array(N)
  for (let n = 0; n < N; n += 1) {
    w[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1))
  }
  return w
}

function dctII(vector: Float32Array, numCoeffs: number): Float32Array {
  const N = vector.length
  const out = new Float32Array(numCoeffs)
  for (let k = 0; k < numCoeffs; k += 1) {
    let sum = 0
    for (let n = 0; n < N; n += 1) {
      sum += vector[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N))
    }
    out[k] = sum
  }
  return out
}

function createMelFilterbank(
  sampleRate: number,
  fftSize: number,
  numFilters: number,
  fMin = 20,
  fMax = 8000
): Float32Array[] {
  const nyquist = sampleRate / 2
  const maxHz = Math.min(fMax, nyquist)

  const melMin = hzToMel(fMin)
  const melMax = hzToMel(maxHz)
  const melPoints: number[] = []
  for (let i = 0; i < numFilters + 2; i += 1) {
    melPoints.push(melMin + (i / (numFilters + 1)) * (melMax - melMin))
  }
  const hzPoints = melPoints.map(m => melToHz(m))
  const binPoints = hzPoints.map(hz => Math.floor(((fftSize + 1) * hz) / sampleRate))

  const filters: Float32Array[] = []
  const numBins = Math.floor(fftSize / 2) + 1

  for (let m = 1; m <= numFilters; m += 1) {
    const f = new Float32Array(numBins)
    const left = binPoints[m - 1]
    const center = binPoints[m]
    const right = binPoints[m + 1]

    for (let k = left; k < center; k += 1) {
      if (k >= 0 && k < numBins) f[k] = (k - left) / Math.max(1, center - left)
    }
    for (let k = center; k < right; k += 1) {
      if (k >= 0 && k < numBins) f[k] = (right - k) / Math.max(1, right - center)
    }
    filters.push(f)
  }
  return filters
}

function spectrumFromFrame(frame: Float32Array, sampleRate: number, fftSize: number): Float32Array {
  // Direct DFT magnitude (O(N^2)) but N is small (~512).
  void sampleRate
  const numBins = Math.floor(fftSize / 2) + 1
  const out = new Float32Array(numBins)
  for (let k = 0; k < numBins; k += 1) {
    let re = 0
    let im = 0
    const w = (2 * Math.PI * k) / fftSize
    for (let n = 0; n < fftSize; n += 1) {
      const x = frame[n]
      re += x * Math.cos(w * n)
      im -= x * Math.sin(w * n)
    }
    out[k] = Math.sqrt(re * re + im * im)
  }
  return out
}

function extractMFCC(audioData: Float32Array, sampleRate: number): Float32Array {
  const winSize = Math.floor(sampleRate * 0.025)
  const hopSize = Math.floor(sampleRate * 0.01)
  const fftSize = 1 << Math.ceil(Math.log2(winSize))
  const numMfcc = 40
  const numFilters = 40

  const windowFn = hamming(winSize)
  const filters = createMelFilterbank(sampleRate, fftSize, numFilters)

  const frames: Float32Array[] = []
  for (let start = 0; start + winSize <= audioData.length; start += hopSize) {
    const frame = new Float32Array(fftSize)
    for (let i = 0; i < winSize; i += 1) frame[i] = audioData[start + i] * windowFn[i]
    frames.push(frame)
  }

  if (frames.length === 0) return new Float32Array(192)

  const mfccSum = new Float32Array(numMfcc)
  for (const frame of frames) {
    const spectrum = spectrumFromFrame(frame, sampleRate, fftSize)
    const melEnergies = new Float32Array(numFilters)

    for (let m = 0; m < numFilters; m += 1) {
      let e = 0
      const f = filters[m]
      for (let k = 0; k < spectrum.length; k += 1) e += (spectrum[k] ** 2) * f[k]
      melEnergies[m] = Math.log(1e-10 + e)
    }

    const mfcc = dctII(melEnergies, numMfcc)
    for (let i = 0; i < numMfcc; i += 1) mfccSum[i] += mfcc[i]
  }

  for (let i = 0; i < numMfcc; i += 1) mfccSum[i] /= frames.length

  const targetDim = 192
  const emb = new Float32Array(targetDim)
  let offset = 0
  while (offset < targetDim) {
    const take = Math.min(numMfcc, targetDim - offset)
    emb.set(mfccSum.subarray(0, take), offset)
    offset += take
  }

  let norm = 0
  for (let i = 0; i < emb.length; i += 1) norm += emb[i] * emb[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < emb.length; i += 1) emb[i] /= norm

  return emb
}

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
