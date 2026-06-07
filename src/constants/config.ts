export const API_URL = import.meta.env.VITE_API_URL as string
export const TENANT_ID = (import.meta.env.VITE_TENANT_ID as string) || 'unipay-congo'
export const API_KEY = (import.meta.env.VITE_HV_API_KEY as string) || 'unipay-congo-key-2026'

export const VOICE_DURATION_MS = 4000
export const MAX_ATTEMPTS = 3
export const REQUEST_TIMEOUT_MS = 8000
export const REFLEX_ROUNDS = 2
export const DIGIT_SPAN_ROUNDS = 3
export const STROOP_ROUNDS = 6
