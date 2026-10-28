import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogItemUrl,
  createProductShareHandler,
  findInventoryItem,
  inventoryItems,
  isShareCrawler,
  normalizeItemId,
  productImageUrl,
  productSharePath,
  sharePageHtml
} from '../lib/product-share.js';
import { formatReviewMessageText } from '../lib/review-links.js';

test('share crawler detection covers WhatsApp and social unfurlers', () => {
  assert.equal(isShareCrawler('WhatsApp/2.24.7.80 A'), true);
  assert.equal(isShareCrawler('facebookexternalhit/1.1'), true);
  assert.equal(isShareCrawler('Mozilla/5.0 Chrome/120.0'), false);
});

test('inventory lookup finds public products and builds WhatsApp image tags', () => {
  const items = inventoryItems([
    { storeConfig: {} },
    { id: 3, name: 'Tiger Fruit', price: 4, img: 'https://i.imgur.com/kGXK1IB.png', desc: 'Permanent fruit' }
  ]);
  const item = findInventoryItem(items, '3');
  assert.equal(item.name, 'Tiger Fruit');
  assert.equal(normalizeItemId('../secret'), '');
  assert.equal(productSharePath(3), '/item/3');
  assert.equal(productImageUrl(item), 'https://i.imgur.com/kGXK1IB.png');
  assert.equal(catalogItemUrl(item), 'https://www.h4sxmy.xyz/?item=3');
  const html = sharePageHtml({ item });
  assert.match(html, /property="og:image" content="https:\/\/i\.imgur\.com\/kGXK1IB\.png"/);
  assert.match(html, /property="og:title" content="Tiger Fruit \| H4SX STORE"/);
  assert.match(html, /location\.replace\("https:\/\/www\.h4sxmy\.xyz\/\?item=3"\)/);
});

test('product share handler serves OG HTML for a catalog item', async () => {
  const handler = createProductShareHandler(async () => [
    { id: '12', name: 'Gas Fruit', price: 3, img: 'https://i.imgur.com/zkDHakz.png', active: true }
  ]);
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    end() { this.ended = true; return this; }
  };
  await handler({ method: 'GET', query: { id: '12' } }, response);
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['Content-Type'], /text\/html/);
  assert.match(response.body, /og:image/);
  assert.match(response.body, /Gas Fruit/);
});

test('review text turns https URLs into clickable message links', () => {
  const html = formatReviewMessageText(
    'Wajib baca TOS. Link : https://tnc-review.vercel.app/ ok.',
    value => String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))
  );
  assert.match(html, /class="message-link"/);
  assert.match(html, /href="https:\/\/tnc-review\.vercel\.app\/"/);
  assert.match(html, />https:\/\/tnc-review\.vercel\.app\/</);
});
