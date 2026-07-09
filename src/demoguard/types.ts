/**
 * DemoGuard — Type definitions
 *
 * DemoGuard is an isolated mobile collector module for HCS-U7 / Hybrid Vector demos.
 * It does NOT depend on PayGuard identity fields.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

// ─── Device context ────────────────────────────────────────────────

export interface DemoGuardDeviceContext {
  platform: string;
  osVersion: string;
  model: string | null;
  manufacturer: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  pixelRatio: number | null;
  language: string | null;
  timezone: string | null;
  online: boolean;
}

// ─── Permissions ───────────────────────────────────────────────────

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';

export interface DemoGuardPermissions {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  notifications: PermissionStatus;
  location: PermissionStatus;
  motion: PermissionStatus;
  orientation: PermissionStatus;
}

// ─── Signal quality grade ──────────────────────────────────────────

export type SignalQuality = 'ok' | 'low' | 'missing' | 'unsupported';

// ─── Safe signal metadata (for UI and safe payload) ────────────────

export interface DemoGuardSelfieSignal {
  captured: boolean;
  quality: SignalQuality;
  width?: number;
  height?: number;
}

export interface DemoGuardReactionSignal {
  reaction_ms?: number;
  too_fast: boolean;
  too_slow: boolean;
  quality: SignalQuality;
}

export interface DemoGuardVoiceSignal {
  recorded: boolean;
  duration_ms?: number;
  challenge_id?: string;
  quality: SignalQuality;
  mfcc_available?: boolean;
}

// ─── Device signal metadata ───────────────────────────────────────

export interface DemoGuardMotionSignal {
  supported: boolean;
  permission: PermissionStatus;
  sample_count: number;
  variance?: number;
  quality: SignalQuality;
}

export interface DemoGuardOrientationSignal {
  supported: boolean;
  permission: PermissionStatus;
  sample_count: number;
  changes: number;
  quality: SignalQuality;
}

export interface DemoGuardTouchSignal {
  touch_count: number;
  pointer_type?: string;
  pressure_supported: boolean;
  pressure_avg?: number;
  touch_duration_ms?: number;
  move_distance?: number;
  multi_touch_detected: boolean;
  quality: SignalQuality;
}

export interface DemoGuardVisibilitySignal {
  blur_count: number;
  focus_count: number;
  visibility_hidden_count: number;
  hidden_duration_ms: number;
  page_focus_lost: boolean;
  quality: SignalQuality;
}

export interface DemoGuardNetworkSignal {
  online: boolean;
  effective_type?: string;
  rtt?: number;
  downlink?: number;
  api_latency_ms?: number;
  quality: SignalQuality;
}

// ─── Signals aggregate ─────────────────────────────────────────────

export interface DemoGuardSignals {
  selfie: DemoGuardSelfieSignal | null;
  reaction: DemoGuardReactionSignal | null;
  voice: DemoGuardVoiceSignal | null;
  motion: DemoGuardMotionSignal | null;
  orientation: DemoGuardOrientationSignal | null;
  touch: DemoGuardTouchSignal | null;
  visibility: DemoGuardVisibilitySignal | null;
  network: DemoGuardNetworkSignal | null;
}

// ─── Quality ───────────────────────────────────────────────────────

export interface DemoGuardQuality {
  signal_completeness: number;
  device_ready: boolean;
  permissions_ready: boolean;
  overall_ready: boolean;
  critical_missing: string[];
  missing_optional: string[];
}

// ─── Sensitive payload (only sent to proxy, never in UI/logs) ──────

export interface DemoGuardSensitive {
  selfie_b64?: string;
  voice_b64?: string;
  mfcc_summary?: number[];
}

// ─── Payload ───────────────────────────────────────────────────────

export interface DemoGuardPayload {
  hcs_session_public_id: string;
  source: 'demoguard_mobile';
  demo_guard: {
    version: string;
    started_at: string;
    completed_at: string;
    device: DemoGuardDeviceContext;
    permissions: DemoGuardPermissions;
    signals: DemoGuardSignals;
    quality: DemoGuardQuality;
  };
  sensitive?: DemoGuardSensitive;
}

// ─── Safe response (filtered, no PII) ──────────────────────────────

export interface DemoGuardHybridFusion {
  triggered: boolean;
  globalDecision?: string;
  trustLevel?: string;
}

export interface DemoGuardSafeResponse {
  ok: boolean;
  source: 'demoguard_mobile';
  status: 'submitted' | 'review' | 'failed';
  received?: boolean;
  quality_score?: number;
  ready?: boolean;
  message?: string;
  hybridFusion?: DemoGuardHybridFusion;
}
