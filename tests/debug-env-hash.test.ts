/**
 * TEMPORARY DEBUG — Tests for /api/debug/env-hash
 *
 * Verifies:
 * - Debug route returns hash only (never raw key)
 * - No raw HV_API_KEY in response
 * - Missing env returns present:false
 * - Production requires X-Debug-Secret header
 *
 * DELETE THIS FILE after diagnosis is complete.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import debugEnvHashHandler from '../api/debug/env-hash';

function createMockReq(
  overrides: Partial<{ method: string; headers: Record<string, string | string[]> }> = {},
) {
  return {
    method: overrides.method ?? 'GET',
    headers: overrides.headers ?? {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Parameters<typeof debugEnvHashHandler>[0];
}

function createMockRes() {
  const res = {
    _status: 200,
    _json: null as unknown,
    _headers: {} as Record<string, string>,
    status(code: number) { this._status = code; return this; },
    json(data: unknown) { this._json = data; },
    setHeader(key: string, val: string) { this._headers[key] = val; },
    end() {},
  };
  return res as unknown as Parameters<typeof debugEnvHashHandler>[1] & typeof res;
}

describe('PayGuard /api/debug/env-hash', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns hash only, never raw key', async () => {
    process.env.HV_API_KEY = 'super-secret-key-123';
    process.env.NODE_ENV = 'development';

    const req = createMockReq();
    const res = createMockRes();

    await debugEnvHashHandler(req, res);

    expect(res._status).toBe(200);
    const body = res._json as Record<string, unknown>;
    expect(body.hvApiKeyPresent).toBe(true);
    expect(body.hvApiKeyHash12).toBeTypeOf('string');
    expect((body.hvApiKeyHash12 as string).length).toBe(12);
    // Must NOT contain the raw key anywhere
    expect(JSON.stringify(body)).not.toContain('super-secret-key-123');
  });

  it('returns present:false when HV_API_KEY is missing', async () => {
    delete process.env.HV_API_KEY;
    process.env.NODE_ENV = 'development';

    const req = createMockReq();
    const res = createMockRes();

    await debugEnvHashHandler(req, res);

    expect(res._status).toBe(200);
    const body = res._json as Record<string, unknown>;
    expect(body.hvApiKeyPresent).toBe(false);
    expect(body.hvApiKeyHash12).toBeNull();
  });

  it('returns 403 in production without X-Debug-Secret', async () => {
    process.env.HV_API_KEY = 'test-key';
    process.env.NODE_ENV = 'production';
    delete process.env.DEBUG_SECRET;

    const req = createMockReq();
    const res = createMockRes();

    await debugEnvHashHandler(req, res);

    expect(res._status).toBe(403);
    const body = res._json as Record<string, unknown>;
    expect(body.error).toBe('DEBUG_ACCESS_DENIED');
  });

  it('returns 403 in production with wrong X-Debug-Secret', async () => {
    process.env.HV_API_KEY = 'test-key';
    process.env.NODE_ENV = 'production';
    process.env.DEBUG_SECRET = 'correct-secret';

    const req = createMockReq({ headers: { 'x-debug-secret': 'wrong-secret' } });
    const res = createMockRes();

    await debugEnvHashHandler(req, res);

    expect(res._status).toBe(403);
  });

  it('allows access in production with correct X-Debug-Secret', async () => {
    process.env.HV_API_KEY = 'test-key';
    process.env.NODE_ENV = 'production';
    process.env.DEBUG_SECRET = 'correct-secret';

    const req = createMockReq({ headers: { 'x-debug-secret': 'correct-secret' } });
    const res = createMockRes();

    await debugEnvHashHandler(req, res);

    expect(res._status).toBe(200);
    const body = res._json as Record<string, unknown>;
    expect(body.hvApiKeyPresent).toBe(true);
    expect(body.hvApiKeyHash12).toBeTypeOf('string');
  });

  it('includes hybridVectorApiUrl when set', async () => {
    process.env.HV_API_KEY = 'test-key';
    process.env.NODE_ENV = 'development';
    process.env.HYBRID_VECTOR_API_URL = 'https://api.example.com';

    const req = createMockReq();
    const res = createMockRes();

    await debugEnvHashHandler(req, res);

    const body = res._json as Record<string, unknown>;
    expect(body.hybridVectorApiUrl).toBe('https://api.example.com');
  });
});
