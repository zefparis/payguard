class SignalBus {
  private readonly buffers = new Map<string, unknown[]>()
  private paused = false

  constructor() {
    window.setInterval(() => {
      this.flushAll()
    }, 1000)
  }

  emit(channel: string, data: unknown): void {
    const current = this.buffers.get(channel) ?? []
    current.push(data)
    this.buffers.set(channel, current)
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  private flushAll(): void {
    if (this.paused) {
      return
    }

    for (const [channel, buffer] of this.buffers.entries()) {
      if (buffer.length === 0) {
        continue
      }

      this.buffers.set(channel, [])
    }
  }
}

export const signalBus = new SignalBus()
