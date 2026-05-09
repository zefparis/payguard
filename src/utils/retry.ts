async function sleep(ms: number) {
  await new Promise<void>(r => setTimeout(r, ms))
}

export async function withRetry<T>(fn: () => Promise<T>, retries: number, baseDelayMs = 600): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i === retries) break
      await sleep(baseDelayMs * (i + 1))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Request failed after retries')
}
