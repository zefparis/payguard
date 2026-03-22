export interface WorkerProfile {
  workerId: string
  firstName: string
  lastName: string
  employeeId: string
  jobRole: string
  employerSite: string
  tenantId: string
  rekognitionFaceId?: string
  cognitiveBaseline?: CognitiveBaseline
  enrolledAt?: string
}

export interface CognitiveBaseline {
  stroopScore: number
  reflexVelocityMs: number
  vocalAccuracy: number
  reactionTimeMs: number
}

export interface CheckInResult {
  verified: boolean
  similarity: number
  workerId: string
  firstName: string
  checkedInAt: string
}

export interface EnrollResult {
  success: boolean
  workerId: string
  confidence: number
}

export type AppStep =
  | 'home'
  | 'enroll-identity'
  | 'enroll-selfie'
  | 'enroll-cognitive'
  | 'enroll-success'
  | 'checkin-identity'
  | 'checkin-selfie'
  | 'checkin-result'
