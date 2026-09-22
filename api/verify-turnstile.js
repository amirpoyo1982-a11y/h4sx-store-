const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ALLOWED_HOSTNAMES = new Set(['www.h4sxmy.xyz', 'h4sxmy.xyz']);
const ROBLOX_USERNAME_URL = 'https://users.roblox.com/v1/usernames/users';
const ROBLOX_SEARCH_URL = 'https://users.roblox.com/v1/users/search';
const ROBLOX_THUMBNAIL_URL = 'https://thumbnails.roblox.com/v1/users/avatar-headshot';

async function handleRobloxLookup(req, res) {
  const username = String(req.query?.username || '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ success:false, error:'Username Roblox tidak sah.' });
  try {
    const exactResponse = await fetch(ROBLOX_USERNAME_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Accept:'application/json' },
      body:JSON.stringify({ usernames:[username], excludeBannedUsers:true }),
      signal:AbortSignal.timeout(8000)
    });
    if (!exactResponse.ok) throw new Error('Roblox users API: ' + exactResponse.status);
    const exactPayload = await exactResponse.json();
    const exactUser = Array.isArray(exactPayload?.data) ? exactPayload.data[0] : null;
    let users = exactUser ? [exactUser] : [];
    if (!users.length) {
      const search = new URLSearchParams({ keyword:username, limit:'10' });
      const searchResponse = await fetch(ROBLOX_SEARCH_URL + '?' + search, { headers:{ Accept:'application/json' }, signal:AbortSignal.timeout(8000) });
      if (!searchResponse.ok) throw new Error('Roblox search API: ' + searchResponse.status);
      const searchPayload = await searchResponse.json();
      users = (Array.isArray(searchPayload?.data) ? searchPayload.data : []).slice(0, 6);
    }
    if (!users.length) return res.status(404).json({ success:false, error:'Profil Roblox tidak dijumpai.' });
    const avatars = new Map();
    try {
      const params = new URLSearchParams({ userIds:users.map(user => user.id).join(','), size:'150x150', format:'Png', isCircular:'false' });
      const thumbnailResponse = await fetch(ROBLOX_THUMBNAIL_URL + '?' + params, { headers:{ Accept:'application/json' }, signal:AbortSignal.timeout(8000) });
      if (thumbnailResponse.ok) {
        const thumbnailPayload = await thumbnailResponse.json();
        (thumbnailPayload?.data || []).forEach(thumbnail => avatars.set(String(thumbnail.targetId), thumbnail.imageUrl || ''));
      }
    } catch (thumbnailError) { console.warn('Roblox thumbnail fallback failed:', thumbnailError); }
    const result = users.map(user => ({ id:String(user.id), username:String(user.name || username), displayName:String(user.displayName || user.name || username), hasVerifiedBadge:user.hasVerifiedBadge === true, avatarUrl:avatars.get(String(user.id)) || '', profileUrl:'https://www.roblox.com/users/' + user.id + '/profile' }));
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ success:true, exact:Boolean(exactUser), user:exactUser ? result[0] : null, users:result });
  } catch (error) {
    console.error('Roblox fallback lookup error:', error);
    return res.status(502).json({ success:false, error:'Roblox tidak dapat disambungkan sekarang.' });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET' && String(req.query?.action || '') === 'roblox-user') return handleRobloxLookup(req, res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
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
