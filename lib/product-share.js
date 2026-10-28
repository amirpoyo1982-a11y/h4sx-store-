export const SITE_ORIGIN = 'https://www.h4sxmy.xyz';
export const DEFAULT_OG_IMAGE = 'https://i.imgur.com/cLPulXQ.png';
export const INVENTORY_URL = 'https://h4sx-6712c-default-rtdb.asia-southeast1.firebasedatabase.app/store/inventory.json';
export const ITEM_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;
const CRAWLER_UA = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|pinterest|skypeuripreview|embedly|redditbot|applebot|iframely|vkshare|quora|whatsapp/i;

export function requestOrigin(req = {}, fallback = SITE_ORIGIN) {
  const headers = req.headers || {};
  const rawHost = String(headers['x-forwarded-host'] || headers.host || '').split(',', 1)[0].trim().toLowerCase();
  const host = rawHost.replace(/:\d+$/, '');
  const supported = host === 'h4sxmy.xyz' || host.endsWith('.h4sxmy.xyz') || host.endsWith('.vercel.app');
  if (!supported) return fallback;
  const forwardedProto = String(headers['x-forwarded-proto'] || '').split(',', 1)[0].trim().toLowerCase();
  const protocol = forwardedProto === 'http' ? 'http' : 'https';
  return protocol + '://' + rawHost;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

export function isShareCrawler(userAgent = '') {
  return CRAWLER_UA.test(String(userAgent || ''));
}

export function normalizeItemId(value) {
  const id = String(value ?? '').trim();
  return ITEM_ID_PATTERN.test(id) ? id : '';
}

export function inventoryItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) {
    if (data[0]?.storeConfig) return data.slice(1);
    return data;
  }
  if (Array.isArray(data.inventory)) return data.inventory;
  if (typeof data === 'object') return Object.values(data);
  return [];
}

export function isVisibleCatalogItem(item = {}) {
  return item && item.active !== false && String(item.active).toLowerCase() !== 'false'
    && item.hidden !== true && String(item.hidden).toLowerCase() !== 'true';
}

export function findInventoryItem(items, id) {
  const target = normalizeItemId(id).toLowerCase();
  if (!target) return null;
  return (items || []).find(item => item && String(item.id ?? '').toLowerCase() === target) || null;
}

export function absoluteAssetUrl(url, origin = SITE_ORIGIN) {
  const raw = String(url || '').trim();
  if (!raw || /^javascript:/i.test(raw)) return '';
  if (raw.startsWith('//')) return 'https:' + raw;
  try {
    const parsed = new URL(raw, origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return '';
  }
}

export function productImageUrl(item = {}, origin = SITE_ORIGIN) {
  const candidates = [
    item.poster, item.posterImg, item.thumbnail, item.thumb, item.image, item.img, item.mediaUrl
  ];
  for (const candidate of candidates) {
    const url = absoluteAssetUrl(candidate, origin);
    if (!url || /\.(mp4|webm|mov|m4v|gifv)(\?|$)/i.test(url)) continue;
    return url;
  }
  const video = absoluteAssetUrl(item.video || item.videoUrl || item.img, origin);
  const imgur = String(video || '').match(/imgur\.com\/([A-Za-z0-9]+)/i);
  if (imgur) return `https://i.imgur.com/${imgur[1]}.jpg`;
  return DEFAULT_OG_IMAGE;
}

export function productSharePath(id) {
  return '/item/' + encodeURIComponent(normalizeItemId(id));
}

export function productImageProxyPath(id) {
  return '/og-image/' + encodeURIComponent(normalizeItemId(id));
}

export function productShareVersion(item = {}) {
  const source = [item.id, item.updatedAt, item.img, item.image, item.poster, item.thumbnail]
    .filter(value => value != null && value !== '')
    .join('|');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 'r2-' + (hash >>> 0).toString(36);
}

export function productShareUrl(item, origin = SITE_ORIGIN) {
  const url = new URL(productSharePath(item?.id), origin);
  url.searchParams.set('v', productShareVersion(item));
  return url.href;
}

export function productOgImageUrl(item, origin = SITE_ORIGIN) {
  return productImageUrl(item, origin);
}

export function catalogItemUrl(item, origin = SITE_ORIGIN) {
  const url = new URL('/', origin);
  if (item?.id != null && item.id !== '') url.searchParams.set('item', String(item.id));
  return url.href;
}

export function productShareTitle(item) {
  const name = String(item?.name || '').trim();
  return name ? `${name} | H4SX STORE` : 'H4SX STORE | Malaysia Item Roblox';
}

export function productShareDescription(item) {
  const name = String(item?.name || '').trim();
  const desc = String(item?.desc || item?.description || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  const consultation = item?.consultation === true || item?.konsultasi === true;
  const price = consultation || item?.price == null || item?.price === ''
    ? ''
    : 'RM' + Number(item.price).toFixed(2);
  return [price, desc || (name ? `Lihat ${name} di katalog rasmi H4SX STORE Malaysia.` : 'Semak katalog produk digital, harga dan stok terkini di H4SX STORE Malaysia.')]
    .filter(Boolean).join(' · ');
}

export function sharePageHtml({ item, origin = SITE_ORIGIN, destination }) {
  const title = productShareTitle(item);
  const description = productShareDescription(item);
  const image = item ? productOgImageUrl(item, origin) : DEFAULT_OG_IMAGE;
  const url = item ? productShareUrl(item, origin) : origin + '/';
  const dest = destination || (item ? catalogItemUrl(item, origin) : origin + '/');
  const name = String(item?.name || 'H4SX STORE');
  return `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(dest)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ms_MY">
  <meta property="og:site_name" content="H4SX STORE">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="${escapeHtml(name)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="image_src" href="${escapeHtml(image)}">
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eef4fb;font-family:Arial,sans-serif;color:#0f2a45}
    a{display:grid;gap:12px;max-width:420px;margin:24px;padding:18px;border-radius:18px;background:#fff;box-shadow:0 12px 32px rgba(15,42,69,.12);text-decoration:none;color:inherit;text-align:center}
    img{width:100%;max-height:280px;object-fit:contain;border-radius:12px;background:#f5f9ff}
    strong{font-size:20px}
    span{color:#1a8fc7;font-weight:800}
  </style>
</head>
<body>
  <a href="${escapeHtml(dest)}">
    <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}">
    <strong>${escapeHtml(name)}</strong>
    <p>${escapeHtml(description)}</p>
    <span>Buka di H4SX STORE</span>
  </a>
  <script>location.replace(${JSON.stringify(dest)});</script>
</body>
</html>`;
}

export function createProductShareHandler(loadItems) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).send('Method tidak dibenarkan.');
    }
    const origin = requestOrigin(req);
    const id = normalizeItemId(req.query?.id || req.query?.item);
    let item = null;
    if (id) {
      try {
        const items = await loadItems();
        const found = findInventoryItem(items, id);
        if (found && isVisibleCatalogItem(found)) item = found;
      } catch (error) {
        console.warn('Product share inventory lookup failed:', error?.message || error);
      }
    }
    const html = sharePageHtml({
      item,
      origin,
      destination: item ? catalogItemUrl(item, origin) : origin + '/'
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=86400');
    res.status(200);
    return req.method === 'HEAD' ? res.end() : res.send(html);
  };
}
