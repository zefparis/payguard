const API = import.meta.env.VITE_API_URL || 'https://hybrid-vector-api.onrender.com'
// Doit venir de l'environnement Vite (pas de fallback silencieux en prod)
const TENANT = import.meta.env.VITE_TENANT_ID
const API_KEY = import.meta.env.VITE_HV_API_KEY

const headers = () => ({
  'Content-Type': 'application/json',
  // Doit envoyer la valeur brute depuis import.meta.env
  'x-api-key': API_KEY,
})

export async function enrollWorker(payload: {
  selfie_b64: string
  first_name: string
  last_name: string
  email: string
  tenant_id?: string
  cognitive_baseline?: object
}): Promise<{ success: boolean; student_id: string; confidence: number }> {
  const res = await fetch(`${API}/edguard/enroll`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT }),
  })
  if (!res.ok) throw new Error(`Enroll failed: ${res.status}`)
  return res.json()
}

export async function verifyWorker(payload: {
  selfie_b64: string
  first_name: string
  last_name: string
}): Promise<{ verified: boolean; similarity: number; student_id: string; first_name: string }> {
  const res = await fetch(`${API}/edguard/verify`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...payload, tenant_id: TENANT }),
  })
  if (!res.ok) throw new Error(`Verify failed: ${res.status}`)
  return res.json()
}
