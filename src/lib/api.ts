import { API_URL, API_KEY, TENANT_ID, REQUEST_TIMEOUT_MS } from '../constants/config'
import type { EnrollPayload, AuthPaymentPayload, Decision } from '../types/flow'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

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

async function parseError(res: Response, fallbackMessage: string): Promise<ApiError> {
  let code = 'HTTP_ERROR'
  let message = fallbackMessage
  try {
    const body = (await res.json()) as { error?: string; message?: string }
    if (body.error) code = body.error
    if (body.message) message = body.message
  } catch {
    // body not JSON — keep fallback
  }
  return new ApiError(res.status, code, message)
}

export async function enroll(
  payload: EnrollPayload,
): Promise<{ student_id: string; confidence: number }> {
  const res = await fetchWithTimeout(`${API_URL}/payguard/enroll`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw await parseError(res, `enroll failed: ${res.status}`)
  return res.json()
}

export async function verify(payload: {
  selfie_b64: string
  first_name: string
  last_name: string
  student_id?: string
}): Promise<{ verified: boolean; similarity: number; student_id?: string }> {
  const res = await fetchWithTimeout(`${API_URL}/payguard/verify`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT_ID }),
  })
  if (!res.ok) throw await parseError(res, `verify failed: ${res.status}`)
  return res.json()
}

export async function vocalVerify(payload: {
  first_name: string
  last_name: string
  vocal_embedding: number[]
}): Promise<{ vocal_score: number; matched: boolean }> {
  const res = await fetchWithTimeout(`${API_URL}/payguard/vocal-verify`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT_ID }),
  })
  if (!res.ok) throw await parseError(res, `vocal-verify failed: ${res.status}`)
  return res.json()
}

export async function authPaymentSignals(
  payload: AuthPaymentPayload,
): Promise<{ decision: Decision; trust_score: number }> {
  const res = await fetchWithTimeout(`${API_URL}/payguard/auth-payment-signals`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw await parseError(res, `auth-payment-signals failed: ${res.status}`)
  return res.json()
}

export async function lookup(payload: {
  first_name: string
  last_name: string
}): Promise<{ found: boolean; student_id?: string; first_name?: string }> {
  const res = await fetchWithTimeout(`${API_URL}/payguard/lookup`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT_ID }),
  })
  if (!res.ok) throw await parseError(res, `lookup failed: ${res.status}`)
  return res.json()
}
