export type Decision = 'APPROVED' | 'REVIEW' | 'REJECTED' | 'MANUAL_REVIEW'

export type FlowStep =
  | 'idle' | 'identity' | 'selfie' | 'reflex'
  | 'verifying' | 'upload-error' | 'decision'

export type CapturedData = {
  selfieB64: string | null
  reactionMs: number | null
}

export type FlowState = {
  step: FlowStep
  studentId: string | null
  firstName: string
  lastName: string
  amount: number | null
  payPeriod: string | null
  employer: string | null
  captured: CapturedData
  decision: Decision | null
  trustScore: number | null
  uploadError: string | null
  attempts: number
}

export type FlowAction =
  | { type: 'SET_IDENTITY'; firstName: string; lastName: string; studentId?: string }
  | { type: 'SET_PAYMENT'; amount: number; payPeriod: string; employer: string }
  | { type: 'GO_TO_STEP'; step: FlowStep }
  | { type: 'CAPTURE_SELFIE'; selfieB64: string }
  | { type: 'CAPTURE_REFLEX'; ms: number }
  | { type: 'SET_DECISION'; decision: Decision; trustScore: number }
  | { type: 'UPLOAD_ERROR'; message: string }
  | { type: 'INCREMENT_ATTEMPTS' }
  | { type: 'RESET' }

export type EnrollPayload = {
  selfie_b64: string
  first_name: string
  last_name: string
  email?: string
  tenant_id: string
  cognitive_baseline?: {
    reflex_ms: number
  }
}

export type AuthPaymentPayload = {
  student_id: string
  vocal_score: number
  behavioral_score: number
  reaction_ms: number
  tenant_id: string
}
