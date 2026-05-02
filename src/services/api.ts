const API = import.meta.env.VITE_API_URL || 'https://hybrid-vector-api.fly.dev'
const TENANT = import.meta.env.VITE_TENANT_ID
const API_KEY = import.meta.env.VITE_HV_API_KEY

import { isSecureCollectMode } from './secureMode'

const TIMEOUT_MS = 8000

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Request timeout — please retry')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function stripDataUrlPrefix(b64: string): string {
  return b64.replace(/^data:image\/\w+;base64,/, '')
}

const headers = () => {
  if (!API_KEY) throw new Error('Missing VITE_HV_API_KEY')
  if (!TENANT) throw new Error('Missing VITE_TENANT_ID')
  return {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  }
}

export async function enrollWorker(payload: {
  selfie_b64: string
  first_name: string
  last_name: string
  email?: string
  tenant_id: string
  cognitive_baseline?: {
    stroop_score?: number
    reflex_velocity_ms?: number
    vocal_accuracy?: number
    vocal_embedding?: number[]
    vocal_quality?: number
    vocal_similarity_threshold?: number
    reaction_time_ms?: number
    [key: string]: unknown
  }
}): Promise<{ success: boolean; student_id: string; confidence: number }> {
  if (isSecureCollectMode()) throw new Error('Secure collection mode is active: upload blocked (go back online to send).')
  const body: Record<string, unknown> = {
    ...payload,
    selfie_b64: stripDataUrlPrefix(payload.selfie_b64),
    tenant_id: TENANT,
  }
  if (!payload.email) delete body.email
  const res = await fetchWithTimeout(`${API}/payguard/enroll`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Enroll failed: ${res.status}`)
  return res.json()
}

export async function verifyWorker(payload: {
  selfie_b64: string
  first_name: string
  last_name: string
  student_id?: string
}): Promise<{ verified: boolean; similarity: number; student_id: string; first_name: string }> {
  if (isSecureCollectMode()) throw new Error('Secure collection mode is active: verification blocked (go back online).')
  const body: Record<string, unknown> = {
    ...payload,
    selfie_b64: stripDataUrlPrefix(payload.selfie_b64),
    tenant_id: TENANT,
  }
  if (!payload.student_id) delete body.student_id
  const res = await fetchWithTimeout(`${API}/payguard/verify`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Verify failed: ${res.status}`)
  return res.json()
}

export async function lookupEnrollment(payload: {
  first_name: string
  last_name: string
}): Promise<{ found: boolean; student_id?: string; first_name?: string }> {
  const res = await fetchWithTimeout(`${API}/payguard/lookup`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT }),
  })
  if (!res.ok) throw new Error(`lookup failed: ${res.status}`)
  return res.json()
}

export async function vocalVerify(payload: {
  first_name: string
  last_name: string
  vocal_embedding: number[]
}): Promise<{ vocal_score: number; matched: boolean; reason?: string }> {
  const res = await fetchWithTimeout(`${API}/payguard/vocal-verify`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT }),
  })
  if (!res.ok) throw new Error(`vocal-verify failed: ${res.status}`)
  return res.json()
}

export async function sendAuthPaymentSignals(payload: {
  student_id: string
  vocal_score: number
  behavioral_score: number
  reaction_ms: number
}): Promise<{
  decision: 'APPROVED' | 'REVIEW' | 'REJECTED'
  trust_score: number
  detail: { facial: number; vocal: number; reflex: number; behavioral: number }
}> {
  const res = await fetchWithTimeout(`${API}/payguard/auth-payment-signals`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT }),
  })
  if (!res.ok) throw new Error(`auth-payment-signals failed: ${res.status}`)
  return res.json()
}

export async function pingBackend(): Promise<void> {
  try {
    await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) })
  } catch {}
}