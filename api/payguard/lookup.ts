export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const apiKey = process.env.HV_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'PROXY_MISCONFIGURED', message: 'HV_API_KEY env var not set' });
    return;
  }

  const HV_API_URL = 'https://hybrid-vector-api-m5xt.onrender.com';
  const targetUrl = `${HV_API_URL}/payguard/lookup`;

  fetch(targetUrl, {
    method: req.method || 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: req.method !== 'GET' && req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined,
  })
    .then((upstream) => upstream.text().then((text) => res.status(upstream.status).send(text)))
    .catch(() => res.status(502).json({ error: 'PROXY_ERROR', message: 'Failed to reach PayGuard API' }));
}
