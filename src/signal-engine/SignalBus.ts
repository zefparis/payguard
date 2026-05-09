// SignalBus acts as a local in-memory buffer for signal collectors.
// Data is consumed by collectors directly (e.g. VoiceCollector.stopAndCompute)
// rather than flushed to a remote endpoint, so no periodic flush is needed.
class SignalBus {
  private readonly buffers = new Map<string, unknown[]>()
  private paused = false

  emit(channel: string, data: unknown): void {
    if (this.paused) return
    const current = this.buffers.get(channel) ?? []
    current.push(data)
    this.buffers.set(channel, current)
  }

  drain(channel: string): unknown[] {
    const buf = this.buffers.get(channel) ?? []
    this.buffers.set(channel, [])
    return buf
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }
}

export const signalBus = new SignalBus()
