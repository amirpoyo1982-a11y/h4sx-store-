const USERNAME_LOOKUP_URL = 'https://users.roblox.com/v1/usernames/users';
const USER_SEARCH_URL = 'https://users.roblox.com/v1/users/search';
const THUMBNAIL_URL = 'https://thumbnails.roblox.com/v1/users/avatar-headshot';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const username = String(req.query?.username || '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ success: false, error: 'Username Roblox tidak sah.' });
  }

  try {
    const userResponse = await fetch(USERNAME_LOOKUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
      signal: AbortSignal.timeout(8000)
    });
    if (!userResponse.ok) throw new Error('Roblox users API: ' + userResponse.status);
    const userPayload = await userResponse.json();
    const exactUser = Array.isArray(userPayload?.data) ? userPayload.data[0] : null;
    let users = exactUser ? [exactUser] : [];
    if (!users.length) {
      const searchParams = new URLSearchParams({ keyword: username, limit: '10' });
      const searchResponse = await fetch(USER_SEARCH_URL + '?' + searchParams, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      if (!searchResponse.ok) throw new Error('Roblox search API: ' + searchResponse.status);
      const searchPayload = await searchResponse.json();
      users = (Array.isArray(searchPayload?.data) ? searchPayload.data : []).slice(0, 6);
    }
    if (!users.length) return res.status(404).json({ success: false, error: 'Profil Roblox tidak dijumpai.' });

    const avatars = new Map();
    try {
      const params = new URLSearchParams({ userIds: users.map(user => user.id).join(','), size: '150x150', format: 'Png', isCircular: 'false' });
      const thumbnailResponse = await fetch(THUMBNAIL_URL + '?' + params, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      if (thumbnailResponse.ok) {
        const thumbnailPayload = await thumbnailResponse.json();
        (thumbnailPayload?.data || []).forEach(thumbnail => avatars.set(String(thumbnail.targetId), thumbnail.imageUrl || ''));
      }
    } catch (thumbnailError) {
      console.warn('Roblox thumbnail lookup failed:', thumbnailError);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    const result = users.map(user => ({
        id: String(user.id),
        username: String(user.name || username),
        displayName: String(user.displayName || user.name || username),
        hasVerifiedBadge: user.hasVerifiedBadge === true,
        avatarUrl: avatars.get(String(user.id)) || '',
        profileUrl: 'https://www.roblox.com/users/' + user.id + '/profile'
      }));
    return res.status(200).json({ success: true, exact: Boolean(exactUser), user: exactUser ? result[0] : null, users: result });
  } catch (error) {
    console.error('Roblox username lookup error:', error);
    return res.status(502).json({ success: false, error: 'Roblox tidak dapat disambungkan sekarang.' });
  }
}
