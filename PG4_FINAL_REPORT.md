# PG-4: PayGuard Mobile Demo Bridge — Final Report

## Objective

Integrate PayGuard mobile as the primary demo frontend for the Levy demo, securely displaying its results in the private HCS terminal via Hybrid Fusion scoring.

---

## Architecture

```
PayGuard Mobile (Vite/React/Capacitor)
  │
  │  POST /payguard/pay-verify
  │  Body: { selfie_b64, first_name, last_name, student_id,
  │          reaction_ms, hcs_session_public_id? }
  │  ── via Vercel proxy (api/_lib/proxy.ts) ──>
  │
  ▼
Hybrid Vector API (Express)
  │
  │  1. Normal PayGuard scoring (face + vocal + reflex + behavioral)
  │  2. If hcs_session_public_id present:
  │     a. Map PayGuard result → guardResults + facialResult
  │     b. Call triggerHybridFusionFromPayGuard() (internal, no HTTP)
  │     c. Fetch HCS signed result from HCS backend
  │     d. Run hybridTrustFusion() → global decision
  │     e. Publish hybrid events to HCS event bus
  │  3. Return filtered response (no token, no breakdown, no PII)
  │
  ▼
HCS Backend ← hybrid events (via publishHybridEvent)
  │
  ▼
HCS Dashboard Cognitive Terminal (SSE)
  │  Receives hybrid.* events
  │  Displays "Source: PayGuard mobile" when guard source = payguard
```

---

## Files Modified

### 1. PayGuard Mobile (`payguard`)

| File | Change |
|------|--------|
| `src/types/flow.ts` | Added `hcsSessionPublicId` to `FlowState` and `SET_IDENTITY` action |
| `src/state/flowReducer.ts` | Added `hcsSessionPublicId` to `initialFlowState` and `SET_IDENTITY` reducer |
| `src/lib/api.ts` | Added `hcs_session_public_id` to `payVerify` payload type + `hybridFusion` to return type |
| `src/pages/Pay.tsx` | Added `DEMO_LEVY_ENABLED` flag, HCS Session ID input field (feature-gated), pass `hcs_session_public_id` in pay-verify call |
| `tests/pg4-demo-bridge.test.ts` | **NEW** — 11 tests covering flow state, payload, no API key, no sessionToken |

### 2. Hybrid Vector API (`hybrid-vector-api`)

| File | Change |
|------|--------|
| `src/services/hybridFusionTrigger.ts` | **NEW** — Internal fusion trigger service (no HTTP, no router). Calls `fetchHcsResult`, `hybridTrustFusion`, `publishHybridEvent` directly |
| `src/routes/payguard.ts` | Added `hcs_session_public_id` to Zod schema, import fusion trigger, auto-trigger fusion when present, return filtered `hybridFusion` summary |
| `tests/hybrid-fusion-trigger.test.ts` | **NEW** — 10 tests covering event publishing, decision mapping, PII filtering, response sanitization |

### 3. HCS Dashboard (`hcs-u7-dashboard`)

| File | Change |
|------|--------|
| `src/app/[locale]/dashboard/cognitive-terminal/page.tsx` | Display "PayGuard mobile" label when `hybridGuards.source === 'payguard'` |
| `tests/demo-hybrid-fusion.test.ts` | Added 3 PG-4 tests: source mapping, terminal display, raw debug default |

---

## Event Flow

When `hcs_session_public_id` is present in pay-verify:

1. **`hybrid.fusion.started`** — status: `running`, payload: `{ source: 'payguard-mobile' }`
2. **`hybrid.hcs.result.ready`** — status: `verified` or `rejected`
3. **`hybrid.facial.ready`** — status: `passed` or `failed` (if facial data present)
4. **`hybrid.guards.ready`** — status: `passed`/`review`/`failed`, payload: `{ source: 'payguard', riskLevel }`
5. **`hybrid.decision.final`** — status: `final`, payload: `{ globalDecision, globalTrustScore, confidenceLevel }`

---

## Mapping: PayGuard → Fusion

| PayGuard Decision | Guard Status | Risk Level |
|-------------------|-------------|------------|
| APPROVED          | passed      | low        |
| REVIEW            | review      | medium     |
| REJECTED          | failed      | high       |

| Facial Verification | Facial Status | Confidence |
|---------------------|---------------|------------|
| similarity ≥ 80     | passed        | similarity/100 |
| similarity < 80     | failed        | similarity/100 |

---

## Mobile Response (Filtered)

```json
{
  "decision": "APPROVED",
  "trust_score": 0.85,
  "verified": true,
  "similarity": 95.3,
  "hybridFusion": {
    "triggered": true,
    "globalDecision": "allow",
    "confidenceLevel": "very_high"
  }
}
```

**Never exposed to mobile:**
- `token` (Hybrid JWT)
- `detail` / `breakdown` (scoring components)
- `components` (fusion internals)
- `hcsResultToken` (HCS signed token)
- `selfie_b64`, `vocal_embedding`, `first_name`, `last_name`, `student_id` (PII)

---

## Security

- **No client-side API keys**: PayGuard mobile uses Vercel proxy (`api/_lib/proxy.ts`) which injects `X-API-Key` server-side
- **No sessionToken sent**: PayGuard mobile never requests or sends a cognitive session token
- **No connection to hybrid-vector-frontend**: Dashboard proxy route has no reference to public frontend
- **No PII in events**: All published hybrid event payloads contain only status/decision/riskLevel — no PII fields
- **No PII in logs**: `sanitizePayGuardLogContext()` strips selfie_b64, vocal_embedding, first_name, last_name, email, student_id, token, jwt
- **Feature flag gated**: HCS Session ID input only visible when `VITE_PAYGUARD_DEMO_LEVY_ENABLED=true`
- **Raw debug toggle**: Hidden by default (`NEXT_PUBLIC_HCS_DEMO_SHOW_RAW_EVENTS=false`)

---

## Configuration

### PayGuard Mobile (`.env`)
```
VITE_PAYGUARD_DEMO_LEVY_ENABLED=true   # Show HCS Session ID field
VITE_API_URL=https://payguard.vercel.app  # Via Vercel proxy
VITE_TENANT_ID=unipay-congo
```

### Hybrid Vector API (`.env`)
```
HCS_API_URL=https://hcs-u7-backend.onrender.com
HCS_API_KEY=<server-side only>
HCS_WORKER_SHARED_SECRET=<server-side only>
HV_API_KEY=<server-side only>
JWT_SECRET=<32+ chars>
```

### Dashboard (`.env`)
```
HCS_DEMO_LEVY_ENABLED=true
NEXT_PUBLIC_HCS_DEMO_LEVY_ENABLED=true
NEXT_PUBLIC_HCS_DEMO_SHOW_RAW_EVENTS=false
HYBRID_VECTOR_API_URL=<server-side>
HYBRID_VECTOR_API_KEY=<server-side>
```

---

## Test Results

| Repo | Tests | Result |
|------|-------|--------|
| PayGuard | 26 (11 new + 15 existing) | ✅ All pass |
| Hybrid Vector API | 47 (10 new + 37 existing) | ✅ All pass |
| Dashboard | 22 (3 new + 19 existing) | ✅ All pass |

### Build Results

| Repo | Command | Result |
|------|---------|--------|
| PayGuard | `npm run build` | ✅ 193.21 KB (gzip: 63.04 KB) |
| PayGuard | `npx tsc --noEmit` | ✅ No errors |
| Hybrid Vector API | `npx tsc --noEmit` | ✅ No errors |
| Dashboard | `npx tsc --noEmit` | ✅ No errors |

---

## Test Commands

```bash
# PayGuard
cd payguard
npx vitest run
npm run build

# Hybrid Vector API
cd hybrid-vector-api
npx vitest run tests/hybrid-fusion-trigger.test.ts
npx vitest run tests/hybrid-fusion-payguard.test.ts tests/payguard-internal-guard.test.ts
npx tsc --noEmit

# Dashboard
cd hcs-u7-dashboard
npx vitest run tests/demo-hybrid-fusion.test.ts
npx tsc --noEmit
```

---

## Rollback

To disable the PayGuard demo bridge:

1. **PayGuard**: Set `VITE_PAYGUARD_DEMO_LEVY_ENABLED=false` (hides HCS Session ID field)
2. **Hybrid Vector API**: The `hcs_session_public_id` field is optional — pay-verify works normally without it
3. **Dashboard**: Set `HCS_DEMO_LEVY_ENABLED=false` (disables demo hybrid fusion endpoint)

No database migrations required. No breaking changes to existing API contracts.

---

## Copyright

(c) 2026 Benjamin BARRERE / IA SOLUTION
Patents Pending FR2514274 | FR2514546
