import { INVENTORY_URL, createProductShareHandler, inventoryItems } from '../lib/product-share.js';

let cache = { at: 0, items: [] };

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

export default createProductShareHandler(loadItems);
