import {
  DEFAULT_OG_IMAGE,
  INVENTORY_URL,
  createProductShareHandler,
  findInventoryItem,
  isProxyableProductImage,
  inventoryItems,
  isVisibleCatalogItem,
  normalizeItemId,
  productImageUrl
} from '../lib/product-share.js';

let cache = { at: 0, items: [] };
const IMAGE_TIMEOUT_MS = 8_000;

async function loadItems() {
  if (Date.now() - cache.at < 60000 && cache.items.length) return cache.items;
  const response = await fetch(INVENTORY_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Inventory ' + response.status);
  const items = inventoryItems(await response.json()).filter(item => item && item.id != null && item.id !== '');
  cache = { at: Date.now(), items };
  return items;
}

function safeImageType(value) {
  const type = String(value || '').split(';', 1)[0].trim().toLowerCase();
  return /^image\/(avif|gif|jpe?g|png|webp)$/.test(type) ? type : '';
}

async function serveOgImage(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method tidak dibenarkan.');
  }

  let imageUrl = DEFAULT_OG_IMAGE;
  try {
    const item = findInventoryItem(await loadItems(), normalizeItemId(String(req.query?.ogImage || '').replace(/\.png$/i, '')));
    if (item && isVisibleCatalogItem(item)) {
      const candidate = productImageUrl(item);
      if (isProxyableProductImage(candidate)) imageUrl = candidate;
    }
  } catch (error) {
    console.warn('OG image inventory lookup failed:', error?.message || error);
  }

  if (!isProxyableProductImage(imageUrl)) return res.redirect(302, DEFAULT_OG_IMAGE);

  try {
    let imageUrlToFetch = imageUrl;
    let image;
    for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
      if (!isProxyableProductImage(imageUrlToFetch)) throw new Error('Unsupported image host');
      image = await fetch(imageUrlToFetch, {
        headers: { Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
        redirect: 'manual',
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS)
      });
      if (image.status < 300 || image.status >= 400) break;
      const location = image.headers.get('location');
      if (!location || redirectCount === 4) throw new Error('Image redirect limit exceeded');
      imageUrlToFetch = new URL(location, imageUrlToFetch).href;
    }
    const type = safeImageType(image.headers.get('content-type'));
    if (!image.ok || !type) throw new Error('Image ' + image.status + ' ' + (type || 'invalid content type'));

    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(Buffer.from(await image.arrayBuffer()));
  } catch (error) {
    console.warn('OG image proxy failed:', error?.message || error);
    return res.redirect(302, DEFAULT_OG_IMAGE);
  }
}

const productShareHandler = createProductShareHandler(loadItems);

export default function handler(req, res) {
  if (req.query?.ogImage != null) return serveOgImage(req, res);
  return productShareHandler(req, res);
}
