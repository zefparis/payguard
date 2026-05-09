import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkerProfile, CognitiveBaseline } from '../types'

const TTL_MS = 86_400_000 // 24 hours

interface PayGuardStore {
  worker: WorkerProfile | null
  selfieB64: string | null
  cognitiveBaseline: CognitiveBaseline | null
  enrolledAt: number | null
  setWorker: (w: WorkerProfile) => void
  setSelfie: (b64: string) => void
  setCognitive: (c: CognitiveBaseline) => void
  reset: () => void
}

export const usePayGuardStore = create<PayGuardStore>()(
  persist(
    (set) => ({
      worker: null,
      selfieB64: null,
      cognitiveBaseline: null,
      enrolledAt: null,
      setWorker: (w) => set({ worker: w, enrolledAt: Date.now() }),
      setSelfie: (b64) => set({ selfieB64: b64 }),
      setCognitive: (c) => set({ cognitiveBaseline: c }),
      reset: () => set({ worker: null, selfieB64: null, cognitiveBaseline: null, enrolledAt: null }),
    }),
    {
      name: 'payguard-store',
      partialize: (state) => ({
        worker: state.worker,
        cognitiveBaseline: state.cognitiveBaseline,
        enrolledAt: state.enrolledAt,
      }),
    }
  )
)

// TTL guard — expire store data after 24 hours
if (typeof window !== 'undefined') {
  const { enrolledAt, reset } = usePayGuardStore.getState()
  if (enrolledAt && Date.now() - enrolledAt > TTL_MS) {
    reset()
  }
}
