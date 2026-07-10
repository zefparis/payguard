/**
 * TEMPORARY DEBUG — Safe env hash diagnostic
 *
 * GET /api/debug/env-hash
 *
 * Returns SHA-256 hash (first 12 chars) of HV_API_KEY so we can
 * compare Vercel vs Render without exposing the raw secret.
 *
 * Security:
 * - In production, requires X-Debug-Secret header matching DEBUG_SECRET env var
 * - In non-production, always accessible
 * - Never returns raw key
 * - Never returns full hash (only 12 chars)
 *
 * DELETE THIS FILE after diagnosis is complete.
 */

import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface DebugRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
}

export interface DebugResponse extends ServerResponse {
  status: (code: number) => DebugResponse;
  json: (data: unknown) => void;
}

function safeHash12(value: string | undefined): string | null {
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export default async function debugEnvHashHandler(
  req: DebugRequest,
  res: DebugResponse,
): Promise<void> {
  // ── Gate: production requires DEBUG_SECRET header ──
  const nodeEnv = process.env.NODE_ENV || 'production';
  if (nodeEnv === 'production') {
    const debugSecret = process.env.DEBUG_SECRET;
    const providedSecret = req.headers['x-debug-secret'] as string | undefined;
    if (!debugSecret || !providedSecret || debugSecret !== providedSecret) {
      res.status(403).json({ error: 'DEBUG_ACCESS_DENIED' });
      return;
    }
  }

  const hvApiKey = process.env.HV_API_KEY;
  const hybridVectorApiUrl = process.env.HYBRID_VECTOR_API_URL || process.env.PAYGUARD_HV_API_URL || null;

  res.status(200).json({
    hvApiKeyPresent: Boolean(hvApiKey),
    hvApiKeyHash12: safeHash12(hvApiKey),
    hybridVectorApiUrl,
    nodeEnv,
  });
}
