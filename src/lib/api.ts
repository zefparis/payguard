import { API_URL, API_KEY, TENANT_ID, REQUEST_TIMEOUT_MS } from '../constants/config'
import type { EnrollPayload, AuthPaymentPayload, Decision } from '../types/flow'

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function enroll(payload: EnrollPayload): Promise<{ student_id: string; confidence: number }> {
  const res = await fetchWithTimeout(`${API_URL}/payguard/enroll`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`enroll failed: ${res.status}`)
  return res.json()
}

export async function verify(payload: { selfie_b64: string; first_name: string; last_name: string; student_id?: string }): Promise<{ verified: boolean; similarity: number; student_id?: string }> {
  const res = await fetchWithTimeout(`${API_URL}/payguard/verify`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT_ID }),
  })
  if (!res.ok) throw new Error(`verify failed: ${res.status}`)
  return res.json()
}

export async function vocalVerify(payload: { first_name: string; last_name: string; vocal_embedding: number[] }): Promise<{ vocal_score: number; matched: boolean }> {
  const res = await fetchWithTimeout(`${API_URL}/payguard/vocal-verify`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT_ID }),
  })
  if (!res.ok) throw new Error(`vocal-verify failed: ${res.status}`)
  return res.json()
}

export async function authPaymentSignals(payload: AuthPaymentPayload): Promise<{ decision: Decision; trust_score: number }> {
  const res = await fetchWithTimeout(`${API_URL}/payguard/auth-payment-signals`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`auth-payment-signals failed: ${res.status}`)
  return res.json()
}
