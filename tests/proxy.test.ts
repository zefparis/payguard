import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProxyHandler, type ProxyRequest, type ProxyResponse } from '../api/_lib/proxy';

// ────────────────────────────────────────────────────────────────────
// Helpers to build mock req/res
// ────────────────────────────────────────────────────────────────────

function createMockReq(
  overrides: Partial<ProxyRequest> & {
    method?: string;
    origin?: string;
    body?: unknown;
    headers?: Record<string, string | string[]>;
  } = {},
): ProxyRequest {
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
  } as unknown as ProxyRequest;
}

function createMockRes(): ProxyResponse & {
  _status: number;
  _json: unknown;
  _sendData: string | Buffer | undefined;
  _headers: Record<string, string>;
  _ended: boolean;
} {
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

  return res as unknown as ProxyResponse & typeof res;
}

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('Proxy Helper', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PAYGUARD_HV_API_URL;
    delete process.env.PAYGUARD_ALLOWED_ORIGINS;
    delete process.env.PAYGUARD_TENANT_ID;
    delete process.env.PAYGUARD_PROXY_RATE_LIMIT_PER_MIN;
    delete process.env.VERCEL_ENV;
    process.env.HV_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ── 1. Origin allowed → exact Access-Control-Allow-Origin ──
  it('sets exact Access-Control-Allow-Origin for allowed origin', async () => {
    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      method: 'OPTIONS',
      origin: 'http://localhost:5173',
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(204);
    expect(res._headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res._headers['vary']).toBe('Origin');
    expect(res._headers['access-control-allow-methods']).toBe('POST, OPTIONS');
  });

  // ── 2. Origin refused → 403 CORS_ORIGIN_DENIED ──
  it('returns 403 for disallowed origin', async () => {
    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      origin: 'https://evil.example.com',
      body: {},
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(403);
    expect(res._json).toMatchObject({ error: 'CORS_ORIGIN_DENIED' });
  });

  // ── 3. OPTIONS allowed ──
  it('returns 204 for OPTIONS preflight from allowed origin', async () => {
    const handler = createProxyHandler({ endpoint: 'verify' });
    const req = createMockReq({
      method: 'OPTIONS',
      origin: 'capacitor://localhost',
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(204);
    expect(res._headers['access-control-allow-origin']).toBe('capacitor://localhost');
  });

  // ── 4. Upstream URL from PAYGUARD_HV_API_URL ──
  it('uses PAYGUARD_HV_API_URL when set', async () => {
    process.env.PAYGUARD_HV_API_URL = 'https://custom-upstream.example.com';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      origin: 'http://localhost:5173',
      body: { first_name: 'Test' },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toBe('https://custom-upstream.example.com/payguard/enroll');
  });

  // ── 5. Fallback dev URL only outside production ──
  it('falls back to Render active backend in non-production when PAYGUARD_HV_API_URL not set', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const handler = createProxyHandler({ endpoint: 'lookup' });
    const req = createMockReq({
      origin: 'http://localhost:5173',
      body: { first_name: 'Test' },
    });
    const res = createMockRes();

    await handler(req, res);

    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toContain('hybrid-vector-api-m5xt.onrender.com');
    expect(calledUrl).not.toContain('fly.dev');
  });

  it('throws CONFIG_ERROR in production without PAYGUARD_HV_API_URL', async () => {
    process.env.VERCEL_ENV = 'production';
    delete process.env.PAYGUARD_HV_API_URL;

    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      origin: 'http://localhost:5173',
      body: {},
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(500);
    expect(res._json).toMatchObject({ error: 'CONFIG_ERROR' });
  });

  // ── 6. X-API-Key added server-side ──
  it('sends X-API-Key header to upstream', async () => {
    process.env.PAYGUARD_HV_API_URL = 'https://upstream.test';
    process.env.HV_API_KEY = 'secret-key-123';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const handler = createProxyHandler({ endpoint: 'verify' });
    const req = createMockReq({
      origin: 'http://localhost:5173',
      body: { first_name: 'Test' },
    });
    const res = createMockRes();

    await handler(req, res);

    const fetchOpts = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = fetchOpts.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('secret-key-123');
  });

  // ── 7. HV_API_KEY absent → 500 CONFIG_ERROR ──
  it('returns 500 CONFIG_ERROR when HV_API_KEY not set', async () => {
    delete process.env.HV_API_KEY;
    process.env.PAYGUARD_HV_API_URL = 'https://upstream.test';

    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      origin: 'http://localhost:5173',
      body: {},
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(500);
    expect(res._json).toMatchObject({ error: 'CONFIG_ERROR' });
  });

  // ── 8. PAYGUARD_TENANT_ID replaces client tenant_id ──
  it('replaces client tenant_id with PAYGUARD_TENANT_ID', async () => {
    process.env.PAYGUARD_HV_API_URL = 'https://upstream.test';
    process.env.PAYGUARD_TENANT_ID = 'server-tenant';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      origin: 'http://localhost:5173',
      body: { first_name: 'Test', tenant_id: 'client-tenant' },
    });
    const res = createMockRes();

    await handler(req, res);

    const fetchOpts = fetchSpy.mock.calls[0][1] as RequestInit;
    const sentBody = JSON.parse(fetchOpts.body as string);
    expect(sentBody.tenant_id).toBe('server-tenant');
  });

  // ── 9. Sensitive payload not logged ──
  it('does not log selfie_b64, first_name, or other PII', async () => {
    process.env.PAYGUARD_HV_API_URL = 'https://upstream.test';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      origin: 'http://localhost:5173',
      body: {
        selfie_b64: 'BASE64SENSITIVE',
        first_name: 'Alice',
        last_name: 'Smith',
        email: 'alice@example.com',
      },
    });
    const res = createMockRes();

    await handler(req, res);

    const allLogs = logSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(allLogs).not.toContain('BASE64SENSITIVE');
    expect(allLogs).not.toContain('Alice');
    expect(allLogs).not.toContain('Smith');
    expect(allLogs).not.toContain('alice@example.com');
  });

  // ── 10. Rate limit ──
  it('returns 429 when rate limit exceeded', async () => {
    process.env.PAYGUARD_HV_API_URL = 'https://upstream.test';
    process.env.PAYGUARD_PROXY_RATE_LIMIT_PER_MIN = '2';

    const handler = createProxyHandler({ endpoint: 'enroll' });

    // First two requests should pass CORS + rate limit (fetch will be called)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    for (let i = 0; i < 2; i++) {
      const req = createMockReq({ origin: 'http://localhost:5173', body: {} });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).not.toBe(429);
    }

    // Third request should be rate limited
    const req3 = createMockReq({ origin: 'http://localhost:5173', body: {} });
    const res3 = createMockRes();
    await handler(req3, res3);

    expect(res3._status).toBe(429);
    expect(res3._json).toMatchObject({ error: 'RATE_LIMITED' });
  });

  // ── 11. Capacitor request without Origin header allowed ──
  it('allows Capacitor requests without Origin header', async () => {
    process.env.PAYGUARD_HV_API_URL = 'https://upstream.test';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      headers: { 'user-agent': 'Capacitor/1.0 (Android)' },
      body: { first_name: 'Test' },
    });
    // Remove origin header explicitly
    delete req.headers['origin'];
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).not.toBe(403);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  // ── 12. Non-Capacitor request without Origin denied ──
  it('denies non-Capacitor requests without Origin header', async () => {
    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      headers: { 'user-agent': 'Mozilla/5.0' },
      body: {},
    });
    delete req.headers['origin'];
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(403);
    expect(res._json).toMatchObject({ error: 'CORS_ORIGIN_DENIED' });
  });

  // ── 13. PAYGUARD_ALLOWED_ORIGINS adds to allowlist ──
  it('respects PAYGUARD_ALLOWED_ORIGINS env var', async () => {
    process.env.PAYGUARD_ALLOWED_ORIGINS = 'https://custom-app.example.com';
    process.env.PAYGUARD_HV_API_URL = 'https://upstream.test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      method: 'OPTIONS',
      origin: 'https://custom-app.example.com',
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(204);
    expect(res._headers['access-control-allow-origin']).toBe('https://custom-app.example.com');
  });

  // ── 14. Method not allowed ──
  it('returns 405 for GET requests', async () => {
    const handler = createProxyHandler({ endpoint: 'enroll' });
    const req = createMockReq({
      method: 'GET',
      origin: 'http://localhost:5173',
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._json).toMatchObject({ error: 'METHOD_NOT_ALLOWED' });
  });
});
