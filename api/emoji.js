const MEDIA_URL = 'https://cdn3.emoji.gg/emojis/';
const USER_AGENT = 'Mozilla/5.0 (compatible; H4SX-Store-Media/1.0)';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  const name = String(req.query?.name || '').trim();
  if (!/^[A-Za-z0-9-]{1,160}$/.test(name)) return res.status(400).json({ error: 'Emoji tidak sah.' });
  try {
    let media = null;
    let lastError;
    for (const extension of ['gif', 'webp', 'png']) {
      try {
        const candidate = await fetch(MEDIA_URL + encodeURIComponent(name) + '.' + extension, {
          headers: { Accept: 'image/gif,image/webp,image/png,*/*;q=0.8', Referer: 'https://emoji.gg/', 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(8000)
        });
        const type = String(candidate.headers.get('content-type') || '').toLowerCase().split(';')[0];
        if (candidate.ok && ['image/gif', 'image/webp', 'image/png'].includes(type)) {
          media = candidate;
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (!media) throw lastError || Error('Fail emoji tidak tersedia.');
    const type = String(media.headers.get('content-type') || '').toLowerCase().split(';')[0];
    const bytes = Buffer.from(await media.arrayBuffer());
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw Error('Fail emoji terlalu besar.');
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(bytes);
  } catch (error) {
    console.warn('Emoji proxy failed:', error.message);
    return res.status(502).json({ error: 'Emoji tidak dapat dimuatkan sekarang.' });
  }
}
