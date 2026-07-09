import type { FlowState, FlowAction } from '../types/flow'

export const initialFlowState: FlowState = {
  step: 'idle',
  studentId: null,
  firstName: '',
  lastName: '',
  amount: null,
  payPeriod: null,
  employer: null,
  hcsSessionPublicId: null,
  captured: {
    selfieB64: null,
    reactionMs: null,
  },
  decision: null,
  trustScore: null,
  uploadError: null,
  attempts: 0,
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'SET_IDENTITY':
      return { ...state, firstName: action.firstName, lastName: action.lastName, studentId: action.studentId ?? state.studentId, hcsSessionPublicId: action.hcsSessionPublicId ?? state.hcsSessionPublicId }
    case 'SET_PAYMENT':
      return { ...state, amount: action.amount, payPeriod: action.payPeriod, employer: action.employer }
    case 'GO_TO_STEP':
      return { ...state, step: action.step, uploadError: null }
    case 'CAPTURE_SELFIE':
      return { ...state, captured: { ...state.captured, selfieB64: action.selfieB64 } }
    case 'CAPTURE_REFLEX':
      return { ...state, captured: { ...state.captured, reactionMs: action.ms } }
    case 'SET_DECISION':
      return { ...state, decision: action.decision, trustScore: action.trustScore, step: 'decision' }
    case 'UPLOAD_ERROR':
      return { ...state, uploadError: action.message, step: 'upload-error' }
    case 'INCREMENT_ATTEMPTS':
      return { ...state, attempts: state.attempts + 1 }
    case 'RESET':
      return initialFlowState
  }
}
