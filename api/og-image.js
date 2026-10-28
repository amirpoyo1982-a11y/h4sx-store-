import {
  DEFAULT_OG_IMAGE,
  findInventoryItem,
  inventoryItems,
  isVisibleCatalogItem,
  normalizeItemId,
  productImageUrl
} from '../lib/product-share.js';

const INVENTORY_URL = 'https://h4sx-6712c-default-rtdb.asia-southeast1.firebasedatabase.app/store/inventory.json';
const IMAGE_TIMEOUT_MS = 8_000;
let cache = { at: 0, items: [] };

async function loadItems() {
  if (Date.now() - cache.at < 60_000 && cache.items.length) return cache.items;
  const response = await fetch(INVENTORY_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS)
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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method tidak dibenarkan.');
  }

  const id = normalizeItemId(req.query?.id);
  let imageUrl = DEFAULT_OG_IMAGE;
  try {
    const item = findInventoryItem(await loadItems(), id);
    if (item && isVisibleCatalogItem(item)) imageUrl = productImageUrl(item);
  } catch (error) {
    console.warn('OG image inventory lookup failed:', error?.message || error);
  }

  try {
    const image = await fetch(imageUrl, {
      headers: { Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS)
    });
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
