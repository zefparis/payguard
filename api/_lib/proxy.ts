import type { IncomingMessage, ServerResponse } from 'node:http';

// ────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────

// Dev-only fallback — Render is the active backend.
// Fly.io (https://hybrid-vector-api.fly.dev) is deprecated and must NOT be used.
const FALLBACK_UPSTREAM = 'https://hybrid-vector-api-m5xt.onrender.com';
const UPSTREAM_TIMEOUT_MS = 15_000;

const DEFAULT_ALLOWED_ORIGINS = [
  'capacitor://localhost',
  'https://localhost',
  'http://localhost:5173',
  'http://localhost:3001',
];

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export interface ProxyHandlerOptions {
  endpoint: string;
}

/** Minimal typed request interface (Vercel serverless provides body parsing). */
export interface ProxyRequest extends IncomingMessage {
  body?: unknown;
  query?: Record<string, string | string[]>;
}

export interface ProxyResponse extends ServerResponse {
  status: (code: number) => ProxyResponse;
  json: (data: unknown) => void;
  send: (data: string | Buffer) => void;
}

// ────────────────────────────────────────────────────────────────────
// CORS allowlist
// ────────────────────────────────────────────────────────────────────

function getAllowedOrigins(): Set<string> {
  const envOrigins = process.env.PAYGUARD_ALLOWED_ORIGINS;
  const set = new Set<string>(DEFAULT_ALLOWED_ORIGINS);
  if (envOrigins) {
    for (const o of envOrigins.split(',')) {
      const trimmed = o.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return set;
}

function isOriginAllowed(origin: string): boolean {
  return getAllowedOrigins().has(origin);
}

function isCapacitorRequest(req: ProxyRequest): boolean {
  const ua = req.headers['user-agent'] ?? '';
  const origin = req.headers.origin ?? '';
  return (
    ua.toLowerCase().includes('capacitor') ||
    origin.startsWith('capacitor://') ||
    origin === 'https://localhost'
  );
}

// ────────────────────────────────────────────────────────────────────
// Upstream URL
// ────────────────────────────────────────────────────────────────────

function getUpstreamUrl(endpoint: string): string {
  const configured = process.env.PAYGUARD_HV_API_URL;
  if (configured) {
    return `${configured.replace(/\/+$/, '')}/payguard/${endpoint}`;
  }
  if (process.env.VERCEL_ENV === 'production') {
    throw new ProxyConfigError(
      'CONFIG_ERROR',
      'PAYGUARD_HV_API_URL must be set in production',
    );
  }
  console.warn('[proxy] PAYGUARD_HV_API_URL not set — using fallback:', FALLBACK_UPSTREAM);
  return `${FALLBACK_UPSTREAM}/payguard/${endpoint}`;
}

// ────────────────────────────────────────────────────────────────────
// Rate limiting (best-effort, in-memory per instance)
// ────────────────────────────────────────────────────────────────────

const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60_000;

function getRateLimitPerMin(): number {
  const raw = process.env.PAYGUARD_PROXY_RATE_LIMIT_PER_MIN;
  if (!raw) return 0; // 0 = disabled
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function checkRateLimit(ip: string): boolean {
  const limit = getRateLimitPerMin();
  if (limit === 0) return true;

  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }

  bucket.count++;
  return bucket.count <= limit;
}

// ────────────────────────────────────────────────────────────────────
// Error class
// ────────────────────────────────────────────────────────────────────

class ProxyConfigError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// ────────────────────────────────────────────────────────────────────
// Safe logging (no PII)
// ────────────────────────────────────────────────────────────────────

function getClientIp(req: ProxyRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

function safeLog(
  level: 'info' | 'warn' | 'error',
  fields: Record<string, unknown>,
): void {
  const line = JSON.stringify(fields);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// ────────────────────────────────────────────────────────────────────
// Tenant hardening
// ────────────────────────────────────────────────────────────────────

function applyTenantOverride(body: Record<string, unknown>): Record<string, unknown> {
  const serverTenant = process.env.PAYGUARD_TENANT_ID;
  if (serverTenant) {
    return { ...body, tenant_id: serverTenant };
  }
  if (body.tenant_id) {
    console.warn('[proxy] using client-supplied tenant_id (PAYGUARD_TENANT_ID not set)');
  }
  return body;
}

// ────────────────────────────────────────────────────────────────────
// Main proxy handler
// ────────────────────────────────────────────────────────────────────

export function createProxyHandler(opts: ProxyHandlerOptions) {
  const { endpoint } = opts;

  return async function handler(
    req: ProxyRequest,
    res: ProxyResponse,
  ): Promise<void> {
    const startTime = Date.now();
    const ip = getClientIp(req);
    const origin = (req.headers.origin ?? '') as string;
    const requestId = req.headers['x-request-id'] as string | undefined;

    // ── CORS ──
    if (origin) {
      if (isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '86400');
      } else {
        safeLog('warn', {
          msg: 'CORS_ORIGIN_DENIED',
          endpoint,
          origin,
          ip,
          requestId,
        });
        res.status(403).json({
          error: 'CORS_ORIGIN_DENIED',
          message: 'Origin not allowed',
        });
        return;
      }
    } else if (!isCapacitorRequest(req)) {
      // No Origin and not Capacitor — deny
      safeLog('warn', {
        msg: 'CORS_NO_ORIGIN',
        endpoint,
        ip,
        requestId,
      });
      res.status(403).json({
        error: 'CORS_ORIGIN_DENIED',
        message: 'Origin header required',
      });
      return;
    }

    // ── OPTIONS preflight ──
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    // ── Method check ──
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported' });
      return;
    }

    // ── Rate limit ──
    if (!checkRateLimit(ip)) {
      safeLog('warn', {
        msg: 'RATE_LIMITED',
        endpoint,
        ip,
        requestId,
      });
      res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many requests' });
      return;
    }

    // ── API key ──
    const apiKey = process.env.HV_API_KEY;
    if (!apiKey) {
      safeLog('error', { msg: 'CONFIG_ERROR', reason: 'HV_API_KEY not set', endpoint });
      res.status(500).json({ error: 'CONFIG_ERROR', message: 'Server misconfigured' });
      return;
    }

    // ── Upstream URL ──
    let targetUrl: string;
    try {
      targetUrl = getUpstreamUrl(endpoint);
    } catch (err) {
      const code = err instanceof ProxyConfigError ? err.code : 'CONFIG_ERROR';
      const message = err instanceof Error ? err.message : 'Configuration error';
      safeLog('error', { msg: code, endpoint, message });
      res.status(500).json({ error: code, message });
      return;
    }

    // ── Body + tenant override ──
    let body: Record<string, unknown>;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
    } catch {
      res.status(400).json({ error: 'INVALID_JSON', message: 'Request body is not valid JSON' });
      return;
    }
    body = applyTenantOverride(body);

    // ── Fetch upstream with timeout ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const upstreamRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const text = await upstreamRes.text();
      const durationMs = Date.now() - startTime;

      safeLog('info', {
        msg: 'proxy_ok',
        endpoint,
        status: upstreamRes.status,
        durationMs,
        origin: origin || 'capacitor',
        requestId,
      });

      res.setHeader('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json');
      res.status(upstreamRes.status).send(text);
    } catch (err) {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      const isAbort = err instanceof Error && err.name === 'AbortError';

      safeLog('error', {
        msg: isAbort ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
        endpoint,
        durationMs,
        requestId,
      });

      res.status(502).json({
        error: isAbort ? 'UPSTREAM_TIMEOUT' : 'PROXY_ERROR',
        message: isAbort ? 'Upstream did not respond in time' : 'Failed to reach PayGuard API',
      });
    }
  };
}
