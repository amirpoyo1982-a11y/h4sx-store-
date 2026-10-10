const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ALLOWED_HOSTNAMES = new Set(['www.h4sxmy.xyz', 'h4sxmy.xyz']);
const ALLOWED_ACTIONS = new Set(['review_submit', 'report_review']);
import crypto from 'node:crypto';

// Best-effort server throttling. Warm serverless instances retain this map,
// while the raw visitor IP is never stored.
const rateBuckets = new Map();
const MAX_RATE_BUCKETS = 5000;

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '')
    .split(',')[0].trim().slice(0, 80);
}

function clientFingerprint(req) {
  const agent = String(req.headers['user-agent'] || '').slice(0, 160);
  return crypto.createHash('sha256').update(clientIp(req) + '|' + agent).digest('hex').slice(0, 32);
}

function pruneRateBuckets(now) {
  if (rateBuckets.size < MAX_RATE_BUCKETS) return;
  for (const [key, entry] of rateBuckets) {
    if (now - entry.updatedAt > 24 * 60 * 60 * 1000) rateBuckets.delete(key);
  }
}

function consumeRateLimit(key, limit, windowMs) {
  const now = Date.now();
  pruneRateBuckets(now);
  const previous = rateBuckets.get(key);
  const entry = !previous || now - previous.startedAt >= windowMs
    ? { count: 0, startedAt: now, updatedAt: now }
    : previous;
  entry.count += 1;
  entry.updatedAt = now;
  rateBuckets.set(key, entry);
  return { allowed: entry.count <= limit, retryAfter: Math.max(1, Math.ceil((entry.startedAt + windowMs - now) / 1000)) };
}

function requestOriginAllowed(req) {
  const raw = String(req.headers.origin || req.headers.referer || '').trim();
  if (!raw) return false;
  try { return ALLOWED_HOSTNAMES.has(new URL(raw).hostname.toLowerCase()); }
  catch (_) { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  const token = String(req.body?.token || '').trim();
  const action = String(req.body?.action || '').trim();
  const reviewId = String(req.body?.reviewId || '').trim();
  if (!secret) return res.status(503).json({ success: false, error: 'Turnstile belum dikonfigurasi.' });
  if (!requestOriginAllowed(req)) return res.status(403).json({ success: false, error: 'Origin tidak dibenarkan.' });
  if (!ALLOWED_ACTIONS.has(action)) return res.status(400).json({ success: false, error: 'Action tidak sah.' });
  if (!token || token.length > 2048) return res.status(400).json({ success: false, error: 'Token tidak sah.' });
  if (action === 'report_review' && (!reviewId || reviewId.length > 160 || /[\/\\]/.test(reviewId))) {
    return res.status(400).json({ success: false, error: 'ID ulasan tidak sah.' });
  }
  if (Number(req.headers['content-length'] || 0) > 4096) {
    return res.status(413).json({ success: false, error: 'Payload terlalu besar.' });
  }

  try {
    const form = new URLSearchParams({ secret, response: token });
    const remoteIp = clientIp(req);
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
    const fingerprint = clientFingerprint(req);
    const generalLimit = action === 'report_review'
      ? consumeRateLimit('report:' + fingerprint, 3, 60 * 60 * 1000)
      : consumeRateLimit('review:' + fingerprint, 5, 30 * 60 * 1000);
    if (!generalLimit.allowed) {
      res.setHeader('Retry-After', String(generalLimit.retryAfter));
      return res.status(429).json({ success: false, error: 'Terlalu banyak cubaan.', retryAfter: generalLimit.retryAfter });
    }
    if (action === 'report_review') {
      const sameReview = consumeRateLimit('report-review:' + fingerprint + ':' + reviewId, 1, 10 * 60 * 1000);
      if (!sameReview.allowed) {
        res.setHeader('Retry-After', String(sameReview.retryAfter));
        return res.status(429).json({ success: false, error: 'Ulasan ini baru sahaja dilaporkan.', retryAfter: sameReview.retryAfter });
      }
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return res.status(502).json({ success: false, error: 'Pengesahan keselamatan tidak dapat disambungkan.' });
  }
};
