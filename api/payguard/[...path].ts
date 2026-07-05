/**
 * Vercel Serverless Function — PayGuard API Proxy
 *
 * Receives requests from the PayGuard app WITHOUT an API key,
 * injects the real X-API-Key server-side, and forwards to Hybrid Vector API.
 *
 * The API key is never exposed to the client bundle.
 */

const HV_API_URL = 'https://hybrid-vector-api-m5xt.onrender.com';

export default async function handler(
  req: { method?: string; url?: string; body?: unknown },
  res: {
    status: (code: number) => { json: (data: unknown) => void; end: () => void; send: (data: string) => void };
    setHeader: (key: string, value: string) => void;
  },
): Promise<void> {
  // CORS — allow any origin (mobile WebView + web)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const apiKey = process.env.HV_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'PROXY_MISCONFIGURED', message: 'HV_API_KEY env var not set' });
    return;
  }

  // Build target URL: /api/payguard/enroll → /payguard/enroll
  const url = new URL(req.url || '', 'http://localhost');
  const targetPath = url.pathname.replace(/^\/api\/payguard/, '/payguard');
  const targetUrl = `${HV_API_URL}${targetPath}${url.search}`;

  try {
    const fetchOptions: RequestInit = {
      method: req.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
    };

    if (req.method !== 'GET' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOptions);
    const text = await upstream.text();

    res.status(upstream.status).send(text);
  } catch {
    res.status(502).json({ error: 'PROXY_ERROR', message: 'Failed to reach PayGuard API' });
  }
}
