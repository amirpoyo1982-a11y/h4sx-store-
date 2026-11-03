import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  catalogItemUrl,
  createProductShareHandler,
  findInventoryItem,
  inventoryItems,
  isProxyableProductImage,
  isShareCrawler,
  normalizeItemId,
  productImageUrl,
  productOgImageUrl,
  productImageProxyPath,
  productShareUrl,
  productShareVersion,
  productSharePath,
  requestOrigin,
  sharePageHtml
} from '../lib/product-share.js';
import { formatReviewMessageText } from '../lib/review-links.js';

const storeApp = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('share crawler detection covers WhatsApp and social unfurlers', () => {
  assert.equal(isShareCrawler('WhatsApp/2.24.7.80 A'), true);
  assert.equal(isShareCrawler('facebookexternalhit/1.1'), true);
  assert.equal(isShareCrawler('Mozilla/5.0 Chrome/120.0'), false);
});

test('share metadata uses the active H4SX or Vercel host, not an arbitrary Host header', () => {
  assert.equal(requestOrigin({ headers: { host: 'h4sx-store.vercel.app' } }), 'https://h4sx-store.vercel.app');
  assert.equal(requestOrigin({ headers: { 'x-forwarded-host': 'www.h4sxmy.xyz', 'x-forwarded-proto': 'https' } }), 'https://www.h4sxmy.xyz');
  assert.equal(requestOrigin({ headers: { host: 'attacker.example' } }), 'https://www.h4sxmy.xyz');
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
  assert.equal(productImageProxyPath(3), '/og-image/3.png');
  assert.equal(productImageUrl(item), 'https://i.imgur.com/kGXK1IB.png');
  assert.match(productShareVersion(item), /^r4-[a-z0-9]+$/);
  assert.equal(productShareUrl(item), 'https://www.h4sxmy.xyz/item/3?v=' + productShareVersion(item));
  assert.equal(productOgImageUrl(item), 'https://i.imgur.com/kGXK1IB.png');
  assert.equal(catalogItemUrl(item), 'https://www.h4sxmy.xyz/?item=3');
  const html = sharePageHtml({ item });
  assert.match(html, /property="og:image" content="https:\/\/i\.imgur\.com\/kGXK1IB\.png"/);
  assert(html.includes('property="og:url" content="' + productShareUrl(item) + '"'));
  assert.match(html, /property="og:title" content="Tiger Fruit \| H4SX STORE"/);
  assert.match(html, /location\.replace\("https:\/\/www\.h4sxmy\.xyz\/\?item=3"\)/);
});

test('Itemku images remain direct until their catalog image is replaced', () => {
  const item = { id: 45, img: 'https://imgop.itemku.com/?url=image.webp&w=48&q=75' };
  assert.equal(productOgImageUrl(item), item.img);
});

test('Postimg images use a H4SX PNG endpoint for WhatsApp compatibility', () => {
  const item = { id: 38, img: 'https://i.postimg.cc/rw7q5tzx/image.png' };
  assert.equal(productOgImageUrl(item), 'https://www.h4sxmy.xyz/og-image/38.png?v=' + productShareVersion(item));
});

test('Meta and WhatsApp CDN images use the first-party Open Graph image endpoint', () => {
  const image = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/opaque-media';
  const item = { id: 39, img: image };
  assert.equal(isProxyableProductImage(image), true);
  assert.equal(isProxyableProductImage('https://fbsbx.com.attacker.example/image.jpg'), false);
  assert.equal(
    productOgImageUrl(item),
    'https://www.h4sxmy.xyz/og-image/39.png?v=' + productShareVersion(item)
  );
  assert.notEqual(
    productShareVersion({ id: 39, mediaUrl: 'https://lookaside.fbsbx.com/image-a' }),
    productShareVersion({ id: 39, mediaUrl: 'https://lookaside.fbsbx.com/image-b' })
  );
  assert.match(storeApp, /item\?\.mediaUrl, item\?\.video, item\?\.videoUrl/);
  assert.match(storeApp, /\?v=r4-/);
});

test('image endpoint proxies allowlisted WhatsApp media and rejects unsafe redirect destinations', async () => {
  const handler = (await import('../api/product-share.js')).default;
  const source = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/opaque-media';
  const redirected = 'https://mmg.whatsapp.net/whatsapp_business/attachments/opaque-media';
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/store/inventory.json')) {
      return { ok: true, status: 200, json: async () => [{ storeConfig: {} }, { id: 'media-1', img: source, active: true }] };
    }
    if (String(url) === source) {
      return { status: 302, headers: { get: name => name === 'location' ? redirected : null } };
    }
    if (String(url) === redirected) {
      return { ok: true, status: 200, headers: { get: name => name === 'content-type' ? 'image/jpeg' : null }, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
    }
    throw new Error('Unexpected image request: ' + String(url));
  };
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    redirect(code, url) { this.statusCode = code; this.location = url; return this; },
    end() { this.ended = true; return this; }
  };
  try {
    await handler({ method: 'GET', query: { ogImage: 'media-1' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Content-Type'], 'image/jpeg');
    assert.deepEqual([...response.body], [1, 2, 3]);
    assert.equal(calls[1].options.redirect, 'manual');
    assert(calls.some(call => call.url === redirected));

    const unsafeResponse = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      send(body) { this.body = body; return this; },
      redirect(code, url) { this.statusCode = code; this.location = url; return this; },
      end() { this.ended = true; return this; }
    };
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url) === source) {
        return { status: 302, headers: { get: name => name === 'location' ? 'https://attacker.example/image.jpg' : null } };
      }
      if (String(url) === 'https://attacker.example/image.jpg') throw new Error('Unsafe redirect was fetched');
      throw new Error('Unexpected image request: ' + String(url));
    };
    await handler({ method: 'GET', query: { ogImage: 'media-1' } }, unsafeResponse);
    assert.equal(unsafeResponse.statusCode, 302);
    assert.equal(unsafeResponse.location, 'https://i.imgur.com/cLPulXQ.png');
    assert.equal(calls.some(call => call.url === 'https://attacker.example/image.jpg'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
  await handler({ method: 'GET', query: { id: '12' }, headers: { host: 'h4sx-store.vercel.app' } }, response);
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['Content-Type'], /text\/html/);
  assert.match(response.body, /og:image/);
  assert.match(response.body, /Gas Fruit/);
  assert.match(response.body, /https:\/\/i\.imgur\.com\/zkDHakz\.png/);
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
