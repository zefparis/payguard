/**
 * DG-5: DemoGuard Vercel proxy hardening tests
 *
 * Verifies the hardened proxy at /api/demoguard/verify:
 * - POST only, OPTIONS preflight
 * - Origin allowlist enforcement
 * - Rate limiting
 * - Server-side tenant + source enforcement
 * - HV_API_KEY injected server-side, never exposed to client
 * - Upstream response sanitized (no PII, raw biometrics, tokens, embeddings)
 * - Safe error responses (no stack traces)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Mock helpers ──────────────────────────────────────────────────

function createMockReq(
  overrides: {
    method?: string;
    origin?: string;
    body?: unknown;
    headers?: Record<string, string | string[]>;
  } = {},
): Record<string, unknown> {
  const method = overrides.method ?? 'POST';
  const headers: Record<string, string | string[]> = {
    'content-type': 'application/json',
    ...overrides.headers,
  };
  if (overrides.origin !== undefined) {
    headers['origin'] = overrides.origin;
  }
  return {
    method,
    headers,
    body: overrides.body ?? {},
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function createMockRes(): any {
  const res = {
    _status: 200,
    _json: undefined as unknown,
    _sendData: undefined as string | Buffer | undefined,
    _headers: {} as Record<string, string>,
    _ended: false,

    setHeader(name: string, value: string) {
      (this as any)._headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      (this as any)._status = code;
      return this;
    },
    json(data: unknown) {
      (this as any)._json = data;
    },
    send(data: string | Buffer) {
      (this as any)._sendData = data;
    },
    end() {
      (this as any)._ended = true;
    },
    getHeader(name: string) {
      return (this as any)._headers[name.toLowerCase()];
    },
  };
  return res;
}

// ─── File paths ────────────────────────────────────────────────────

const API_DIR = path.resolve(__dirname, '..', 'api');
const VERIFY_FILE = path.join(API_DIR, 'demoguard', 'verify.ts');
const SANITIZE_FILE = path.join(API_DIR, '_lib', 'demoguardSanitize.ts');
const CLIENT_API_FILE = path.resolve(__dirname, '..', 'src', 'demoguard', 'api.ts');
const SRC_DIR = path.resolve(__dirname, '..', 'src');

const VERIFY_SRC = fs.readFileSync(VERIFY_FILE, 'utf-8');
const SANITIZE_SRC = fs.readFileSync(SANITIZE_FILE, 'utf-8');
const CLIENT_API_SRC = fs.readFileSync(CLIENT_API_FILE, 'utf-8');

// ─── Static analysis tests ─────────────────────────────────────────

describe('DG-5: Static analysis — proxy hardening', () => {
  it('verify.ts exists and exports default handler', () => {
    expect(fs.existsSync(VERIFY_FILE)).toBe(true);
    expect(VERIFY_SRC).toContain('export default');
  });

  it('demoguardSanitize.ts exists and exports sanitizeResponse', () => {
    expect(fs.existsSync(SANITIZE_FILE)).toBe(true);
    expect(SANITIZE_SRC).toContain('export function sanitizeResponse');
  });

  it('HV_API_KEY never appears in client-side code', () => {
    // Check all src/ files
    function readAllFiles(dir: string, results: string[] = []): string[] {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'demoguard') {
          results.push(...readAllFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          results.push(fs.readFileSync(fullPath, 'utf-8'));
        }
      }
      return results;
    }
    const srcFiles = readAllFiles(SRC_DIR);
    for (const content of srcFiles) {
      expect(content).not.toContain('HV_API_KEY');
    }
  });

  it('HV_API_KEY is used in verify.ts (server-side)', () => {
    expect(VERIFY_SRC).toContain('process.env.HV_API_KEY');
  });

  it('HV_API_KEY is NOT in client api.ts', () => {
    expect(CLIENT_API_SRC).not.toContain('HV_API_KEY');
  });

  it('proxy uses X-API-Key header for upstream auth', () => {
    expect(VERIFY_SRC).toContain('X-API-Key');
  });

  it('proxy forces source = demoguard_mobile', () => {
    expect(VERIFY_SRC).toContain("body.source = 'demoguard_mobile'");
  });

  it('proxy forces tenant_id server-side', () => {
    expect(VERIFY_SRC).toContain('body.tenant_id');
    expect(VERIFY_SRC).toContain('DEMOGUARD_TENANT_ID');
  });

  it('proxy validates hcs_session_public_id', () => {
    expect(VERIFY_SRC).toContain('hcs_session_public_id');
  });

  it('proxy does not use wildcard CORS', () => {
    expect(VERIFY_SRC).not.toContain("'*'");
    expect(VERIFY_SRC).not.toMatch(/Access-Control-Allow-Origin.*\*/);
  });

  it('proxy forwards to /demoguard/verify upstream', () => {
    expect(VERIFY_SRC).toContain('/demoguard/verify');
  });

  it('proxy uses HYBRID_VECTOR_API_URL env var', () => {
    expect(VERIFY_SRC).toContain('HYBRID_VECTOR_API_URL');
  });

  it('proxy has rate limiting', () => {
    expect(VERIFY_SRC).toContain('checkRateLimit');
    expect(VERIFY_SRC).toContain('DEMOGUARD_PROXY_RATE_LIMIT_PER_MIN');
  });

  it('proxy returns safe error on upstream failure', () => {
    expect(VERIFY_SRC).toContain('DemoGuard verification unavailable');
  });

  it('proxy does not log PII fields', () => {
    expect(VERIFY_SRC).not.toContain('selfie_b64');
    expect(VERIFY_SRC).not.toContain('voice_b64');
    expect(VERIFY_SRC).not.toContain('first_name');
    expect(VERIFY_SRC).not.toContain('last_name');
  });

  it('proxy does not return stack traces', () => {
    expect(VERIFY_SRC).not.toMatch(/\.stack\b/);
    expect(VERIFY_SRC).not.toContain('stackTrace');
    expect(VERIFY_SRC).not.toMatch(/err\.message/);
  });
});

// ─── Sanitizer tests ───────────────────────────────────────────────

describe('DG-5: Sanitizer removes forbidden fields', () => {
  let sanitizeResponse: (v: unknown) => unknown;
  let isKeyForbidden: (k: string) => boolean;

  beforeEach(async () => {
    const mod = await import('../api/_lib/demoguardSanitize');
    sanitizeResponse = mod.sanitizeResponse;
    isKeyForbidden = mod.isKeyForbidden;
  });

  it('removes selfie_b64', () => {
    const result = sanitizeResponse({ selfie_b64: 'abc123', ok: true });
    expect(result).not.toHaveProperty('selfie_b64');
    expect(result).toHaveProperty('ok', true);
  });

  it('removes voice_b64', () => {
    const result = sanitizeResponse({ voice_b64: 'abc123', ok: true });
    expect(result).not.toHaveProperty('voice_b64');
  });

  it('removes raw_motion_trace', () => {
    const result = sanitizeResponse({ raw_motion_trace: [1, 2, 3], ok: true });
    expect(result).not.toHaveProperty('raw_motion_trace');
  });

  it('removes raw_touch_trace', () => {
    const result = sanitizeResponse({ raw_touch_trace: [1, 2, 3], ok: true });
    expect(result).not.toHaveProperty('raw_touch_trace');
  });

  it('removes face_embedding', () => {
    const result = sanitizeResponse({ face_embedding: [0.1, 0.2], ok: true });
    expect(result).not.toHaveProperty('face_embedding');
  });

  it('removes vocal_embedding', () => {
    const result = sanitizeResponse({ vocal_embedding: [0.1, 0.2], ok: true });
    expect(result).not.toHaveProperty('vocal_embedding');
  });

  it('removes mfcc and mfcc_raw', () => {
    const result = sanitizeResponse({ mfcc: [1, 2], mfcc_raw: [3, 4], ok: true });
    expect(result).not.toHaveProperty('mfcc');
    expect(result).not.toHaveProperty('mfcc_raw');
  });

  it('removes voiceprint', () => {
    const result = sanitizeResponse({ voiceprint: 'abc', ok: true });
    expect(result).not.toHaveProperty('voiceprint');
  });

  it('removes first_name, last_name, student_id', () => {
    const result = sanitizeResponse({ first_name: 'John', last_name: 'Doe', student_id: '123', ok: true });
    expect(result).not.toHaveProperty('first_name');
    expect(result).not.toHaveProperty('last_name');
    expect(result).not.toHaveProperty('student_id');
  });

  it('removes email and phone', () => {
    const result = sanitizeResponse({ email: 'a@b.com', phone: '123', ok: true });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('phone');
  });

  it('removes token, jwt, sessionToken, hcsResultToken, hcsCode', () => {
    const result = sanitizeResponse({ token: 'x', jwt: 'y', sessionToken: 'z', hcsResultToken: 'w', hcsCode: 'c', ok: true });
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('jwt');
    expect(result).not.toHaveProperty('sessionToken');
    expect(result).not.toHaveProperty('hcsResultToken');
    expect(result).not.toHaveProperty('hcsCode');
  });

  it('removes components, breakdown, detail, debug, internal', () => {
    const result = sanitizeResponse({ components: {}, breakdown: {}, detail: 'x', debug: true, internal: 'y', ok: true });
    expect(result).not.toHaveProperty('components');
    expect(result).not.toHaveProperty('breakdown');
    expect(result).not.toHaveProperty('detail');
    expect(result).not.toHaveProperty('debug');
    expect(result).not.toHaveProperty('internal');
  });

  it('preserves safe fields', () => {
    const result = sanitizeResponse({
      ok: true,
      source: 'demoguard_mobile',
      status: 'submitted',
      received: true,
      quality_score: 0.85,
      ready: true,
      message: 'OK',
    });
    expect(result).toHaveProperty('ok', true);
    expect(result).toHaveProperty('source', 'demoguard_mobile');
    expect(result).toHaveProperty('quality_score', 0.85);
  });

  it('sanitizes recursively in nested objects', () => {
    const result = sanitizeResponse({
      ok: true,
      hybridFusion: {
        triggered: true,
        globalDecision: 'accept',
        face_embedding: [0.1],
        internal: 'secret',
      },
    });
    expect(result).toHaveProperty('ok', true);
    const fusion = (result as Record<string, unknown>).hybridFusion as Record<string, unknown>;
    expect(fusion).toHaveProperty('triggered', true);
    expect(fusion).not.toHaveProperty('face_embedding');
    expect(fusion).not.toHaveProperty('internal');
  });

  it('sanitizes arrays of objects', () => {
    const result = sanitizeResponse([
      { ok: true, selfie_b64: 'abc' },
      { ok: false, voice_b64: 'def' },
    ]);
    const arr = result as Record<string, unknown>[];
    expect(arr[0]).not.toHaveProperty('selfie_b64');
    expect(arr[1]).not.toHaveProperty('voice_b64');
  });

  it('isKeyForbidden returns true for forbidden keys', () => {
    expect(isKeyForbidden('selfie_b64')).toBe(true);
    expect(isKeyForbidden('voice_b64')).toBe(true);
    expect(isKeyForbidden('token')).toBe(true);
    expect(isKeyForbidden('ok')).toBe(false);
    expect(isKeyForbidden('quality_score')).toBe(false);
  });
});

// ─── Handler behavior tests (with mocked fetch) ────────────────────

describe('DG-5: Handler behavior', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.HV_API_KEY = 'test-secret-key';
    process.env.DEMOGUARD_TENANT_ID = 'demoguard-demo';
    process.env.HYBRID_VECTOR_API_URL = 'https://hybrid-vector-api-m5xt.onrender.com';
    process.env.PAYGUARD_ALLOWED_ORIGINS = 'https://hcs-u7.online,https://payguard-one.vercel.app,capacitor://localhost';
    delete process.env.DEMOGUARD_PROXY_RATE_LIMIT_PER_MIN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  async function importHandler() {
    vi.resetModules();
    return (await import('../api/demoguard/verify')).default;
  }

  // ── POST only ──
  it('rejects GET with 405', async () => {
    const handler = await importHandler();
    const req = createMockReq({ method: 'GET', origin: 'capacitor://localhost' });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(405);
    expect((res._json as Record<string, unknown>).ok).toBe(false);
  });

  it('rejects PUT with 405', async () => {
    const handler = await importHandler();
    const req = createMockReq({ method: 'PUT', origin: 'capacitor://localhost' });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(405);
  });

  // ── OPTIONS preflight ──
  it('returns 204 for OPTIONS from allowed origin', async () => {
    const handler = await importHandler();
    const req = createMockReq({ method: 'OPTIONS', origin: 'https://hcs-u7.online' });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(204);
    expect(res._headers['access-control-allow-origin']).toBe('https://hcs-u7.online');
  });

  // ── Invalid origin ──
  it('rejects disallowed origin with 403', async () => {
    const handler = await importHandler();
    const req = createMockReq({ origin: 'https://evil.example.com', body: {} });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(403);
    expect((res._json as Record<string, unknown>).ok).toBe(false);
  });

  // ── Allowed origin ──
  it('accepts allowed origin and sets CORS header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true, quality_score: 0.9, ready: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'https://payguard-one.vercel.app',
      body: { hcs_session_public_id: 'sess_test123' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._headers['access-control-allow-origin']).toBe('https://payguard-one.vercel.app');
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  // ── Capacitor without Origin ──
  it('allows Capacitor requests without Origin header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      headers: { 'user-agent': 'Capacitor/iOS' },
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  // ── No CORS wildcard ──
  it('never sets wildcard Access-Control-Allow-Origin', async () => {
    const handler = await importHandler();
    const req = createMockReq({ method: 'OPTIONS', origin: 'https://hcs-u7.online' });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._headers['access-control-allow-origin']).not.toBe('*');
  });

  // ── hcs_session_public_id required ──
  it('rejects request without hcs_session_public_id', async () => {
    const handler = await importHandler();
    const req = createMockReq({ origin: 'capacitor://localhost', body: {} });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(400);
    expect((res._json as Record<string, unknown>).ok).toBe(false);
  });

  // ── Tenant override ignored ──
  it('ignores client-supplied tenant_id and forces server value', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test', tenant_id: 'evil-tenant' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const callArgs = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(callArgs[1].body);
    expect(sentBody.tenant_id).toBe('demoguard-demo');
    expect(sentBody.tenant_id).not.toBe('evil-tenant');
    vi.unstubAllGlobals();
  });

  // ── Source override ignored ──
  it('ignores client-supplied source and forces demoguard_mobile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test', source: 'evil-source' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const callArgs = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(callArgs[1].body);
    expect(sentBody.source).toBe('demoguard_mobile');
    expect(sentBody.source).not.toBe('evil-source');
    vi.unstubAllGlobals();
  });

  // ── HV_API_KEY injected server-side ──
  it('injects X-API-Key header from env', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers['X-API-Key']).toBe('test-secret-key');
    vi.unstubAllGlobals();
  });

  // ── Upstream response sanitized ──
  it('removes selfie_b64 from upstream response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        received: true,
        quality_score: 0.9,
        selfie_b64: 'base64data',
        ok: true,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const json = res._json as Record<string, unknown>;
    expect(json).not.toHaveProperty('selfie_b64');
    expect(json).toHaveProperty('quality_score', 0.9);
    vi.unstubAllGlobals();
  });

  it('removes voice_b64 from upstream response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        received: true,
        voice_b64: 'base64voice',
        ok: true,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const json = res._json as Record<string, unknown>;
    expect(json).not.toHaveProperty('voice_b64');
    vi.unstubAllGlobals();
  });

  it('removes raw_motion_trace and raw_touch_trace from response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        received: true,
        raw_motion_trace: [1, 2, 3],
        raw_touch_trace: [4, 5, 6],
        ok: true,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const json = res._json as Record<string, unknown>;
    expect(json).not.toHaveProperty('raw_motion_trace');
    expect(json).not.toHaveProperty('raw_touch_trace');
    vi.unstubAllGlobals();
  });

  it('removes token/sessionToken/hcsResultToken from response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        received: true,
        token: 'jwt-token',
        sessionToken: 'sess-token',
        hcsResultToken: 'result-token',
        jwt: 'jwt-val',
        hcsCode: 'code123',
        ok: true,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const json = res._json as Record<string, unknown>;
    expect(json).not.toHaveProperty('token');
    expect(json).not.toHaveProperty('sessionToken');
    expect(json).not.toHaveProperty('hcsResultToken');
    expect(json).not.toHaveProperty('jwt');
    expect(json).not.toHaveProperty('hcsCode');
    vi.unstubAllGlobals();
  });

  it('removes breakdown/components/detail/debug/internal from response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        received: true,
        breakdown: { face: 0.9 },
        components: { x: 1 },
        detail: 'internal info',
        debug: true,
        internal: 'secret',
        ok: true,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const json = res._json as Record<string, unknown>;
    expect(json).not.toHaveProperty('breakdown');
    expect(json).not.toHaveProperty('components');
    expect(json).not.toHaveProperty('detail');
    expect(json).not.toHaveProperty('debug');
    expect(json).not.toHaveProperty('internal');
    vi.unstubAllGlobals();
  });

  it('removes PII (first_name, last_name, email, phone) from response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        received: true,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '123456',
        ok: true,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const json = res._json as Record<string, unknown>;
    expect(json).not.toHaveProperty('first_name');
    expect(json).not.toHaveProperty('last_name');
    expect(json).not.toHaveProperty('email');
    expect(json).not.toHaveProperty('phone');
    vi.unstubAllGlobals();
  });

  it('removes embeddings (face_embedding, vocal_embedding, voiceprint) from response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        received: true,
        face_embedding: [0.1, 0.2],
        vocal_embedding: [0.3, 0.4],
        voiceprint: 'vp123',
        mfcc: [1, 2],
        mfcc_raw: [3, 4],
        ok: true,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const json = res._json as Record<string, unknown>;
    expect(json).not.toHaveProperty('face_embedding');
    expect(json).not.toHaveProperty('vocal_embedding');
    expect(json).not.toHaveProperty('voiceprint');
    expect(json).not.toHaveProperty('mfcc');
    expect(json).not.toHaveProperty('mfcc_raw');
    vi.unstubAllGlobals();
  });

  it('preserves hybridFusion in response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        received: true,
        quality_score: 0.85,
        ready: true,
        hybridFusion: {
          triggered: true,
          globalDecision: 'accept',
          trustLevel: 'high',
        },
        ok: true,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const json = res._json as Record<string, unknown>;
    expect(json).toHaveProperty('hybridFusion');
    const fusion = json.hybridFusion as Record<string, unknown>;
    expect(fusion).toHaveProperty('triggered', true);
    expect(fusion).toHaveProperty('globalDecision', 'accept');
    vi.unstubAllGlobals();
  });

  it('forces source = demoguard_mobile in response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true, source: 'evil' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    const json = res._json as Record<string, unknown>;
    expect(json.source).toBe('demoguard_mobile');
    vi.unstubAllGlobals();
  });

  // ── Upstream error returns safe message ──
  it('returns safe error when upstream fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(502);
    const json = res._json as Record<string, unknown>;
    expect(json.ok).toBe(false);
    expect(json.message).toBe('DemoGuard verification unavailable');
    expect(JSON.stringify(json)).not.toContain('Connection refused');
    vi.unstubAllGlobals();
  });

  it('returns safe error when upstream times out', async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      Object.assign(new Error('Aborted'), { name: 'AbortError' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(502);
    const json = res._json as Record<string, unknown>;
    expect(json.ok).toBe(false);
    expect(json.message).toBe('DemoGuard verification unavailable');
    vi.unstubAllGlobals();
  });

  it('returns safe error when HV_API_KEY is not set', async () => {
    delete process.env.HV_API_KEY;
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(500);
    const json = res._json as Record<string, unknown>;
    expect(json.ok).toBe(false);
    expect(json.message).toBe('Server misconfigured');
  });

  // ── Rate limiting ──
  it('returns 429 when rate limit exceeded', async () => {
    process.env.DEMOGUARD_PROXY_RATE_LIMIT_PER_MIN = '2';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: { hcs_session_public_id: 'sess_test' },
    });
    // First two requests pass
    await handler(req as any, createMockRes() as any);
    await handler(req as any, createMockRes() as any);
    // Third request should be rate limited
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(429);
    const json = res._json as Record<string, unknown>;
    expect(json.ok).toBe(false);
    vi.unstubAllGlobals();
  });

  // ── Invalid JSON ──
  it('rejects invalid JSON body', async () => {
    const handler = await importHandler();
    const req = createMockReq({
      origin: 'capacitor://localhost',
      body: 'not-json{',
    });
    const res = createMockRes();
    await handler(req as any, res as any);
    expect(res._status).toBe(400);
    const json = res._json as Record<string, unknown>;
    expect(json.ok).toBe(false);
  });
});

// ─── No HV_API_KEY in client code (deep scan) ──────────────────────

describe('DG-5: No API key exposure in client code', () => {
  function readAllSrcFiles(dir: string, results: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        readAllSrcFiles(fullPath, results);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        results.push(fs.readFileSync(fullPath, 'utf-8'));
      }
    }
    return results;
  }

  it('no src/ file contains HV_API_KEY', () => {
    const files = readAllSrcFiles(SRC_DIR);
    for (const content of files) {
      expect(content).not.toContain('HV_API_KEY');
    }
  });

  it('no src/ file contains X-API-Key', () => {
    const files = readAllSrcFiles(SRC_DIR);
    for (const content of files) {
      expect(content).not.toContain('X-API-Key');
    }
  });

  it('client api.ts calls /api/demoguard/verify (proxy only)', () => {
    expect(CLIENT_API_SRC).toContain('/api/demoguard/verify');
  });

  it('client api.ts does NOT call hybrid-vector-api directly', () => {
    expect(CLIENT_API_SRC).not.toContain('hybrid-vector-api');
    expect(CLIENT_API_SRC).not.toContain('onrender.com');
  });
});
