const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ALLOWED_HOSTNAMES = new Set(['www.h4sxmy.xyz', 'h4sxmy.xyz']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  const token = String(req.body?.token || '').trim();
  const action = String(req.body?.action || '').trim();
  if (!secret) return res.status(503).json({ success: false, error: 'Turnstile belum dikonfigurasi.' });
  if (!token || token.length > 2048) return res.status(400).json({ success: false, error: 'Token tidak sah.' });

  try {
    const form = new URLSearchParams({ secret, response: token });
    const remoteIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (remoteIp) form.set('remoteip', remoteIp);
    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(10000)
    });
    const result = await verifyResponse.json();
    const hostnameOk = ALLOWED_HOSTNAMES.has(String(result.hostname || '').toLowerCase());
    const actionOk = !action || String(result.action || '') === action;
    if (!result.success || !hostnameOk || !actionOk) {
      return res.status(403).json({ success: false, error: 'Pengesahan keselamatan gagal.' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return res.status(502).json({ success: false, error: 'Pengesahan keselamatan tidak dapat disambungkan.' });
  }
}
