import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  catalogItemUrl,
  createProductShareHandler,
  findProductVariant,
  findInventoryItem,
  inventoryItems,
  isProxyableProductImage,
  isShareCrawler,
  normalizeItemId,
  productImageUrl,
  productOgImageUrl,
  productImageProxyPath,
  productShareItem,
  productShareUrl,
  productShareVersion,
  productSharePath,
  requestOrigin,
  sharePageHtml
} from '../lib/product-share.js';
import { formatReviewMessageText } from '../lib/review-links.js';

const storeApp = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

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

test('storefront product links include the selected variant cache version and preserve navigation query', () => {
  const versionStart = storeApp.indexOf('function productShareVersion(');
  const versionEnd = storeApp.indexOf('\nfunction productLink', versionStart);
  const start = storeApp.indexOf('function productLink(');
  const end = storeApp.indexOf('\nfunction updateProductUrl', start);
  assert.ok(versionStart >= 0 && versionEnd > versionStart, 'storefront cache version helper is present');
  assert.ok(start >= 0 && end > start, 'productLink function is present');
  const item = {
    id: '23',
    name: 'Gamepass Brookhaven',
    img: 'https://i.imgur.com/base.png',
    variants: [{ id: 'vehicle-pack', name: 'Vehicle Pack', img: 'https://i.imgur.com/vehicle-pack.png' }]
  };
  const result = vm.runInNewContext(
    storeApp.slice(versionStart, versionEnd) + '\n'
      + storeApp.slice(start, end) + '\nproductLink(item, "vehicle-pack")',
    {
      URL,
      window: { location: { href: 'https://www.h4sxmy.xyz/?preview=on&game=brookhaven&part=roblox&item=23&variant=vehicle-pack' } },
      item,
      currentGame: 'Brookhaven',
      gameGroupName: () => 'Brookhaven',
      gameSlug: value => String(value).toLowerCase(),
      normalizeKey: value => String(value).toLowerCase(),
      inferPlatform: () => 'Roblox',
      getProductVariant: (product, id) => product.variants.find(variant => variant.id === id)
    }
  );
  const link = new URL(result);
  assert.equal(link.searchParams.get('preview'), 'on');
  assert.equal(link.searchParams.get('item'), '23');
  assert.equal(link.searchParams.get('variant'), 'vehicle-pack');
  assert.equal(link.searchParams.get('v'), productShareVersion(item, 'vehicle-pack'));
  assert.match(link.searchParams.get('v'), /^r5-/);
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
  assert.match(productShareVersion(item), /^r5-[a-z0-9]+$/);
  assert.equal(productShareUrl(item), 'https://www.h4sxmy.xyz/item/3?v=' + productShareVersion(item));
  assert.equal(
    productOgImageUrl(item),
    'https://www.h4sxmy.xyz/og-image/3.png?v=' + productShareVersion(item)
  );
  assert.equal(catalogItemUrl(item), 'https://www.h4sxmy.xyz/?item=3');
  const html = sharePageHtml({ item });
  assert.match(html, /property="og:image" content="https:\/\/www\.h4sxmy\.xyz\/og-image\/3\.png\?v=r5-[a-z0-9]+"/);
  assert(html.includes('property="og:url" content="' + productShareUrl(item) + '"'));
  assert.match(html, /property="og:title" content="Tiger Fruit \| H4SX STORE"/);
  assert.match(html, /location\.replace\("https:\/\/www\.h4sxmy\.xyz\/\?item=3"\)/);
});

test('variant links preserve selection and use the selected image in WhatsApp metadata', () => {
  const item = {
    id: 'variant-item',
    name: 'Dragon Fruit',
    price: 5,
    poster: 'https://i.imgur.com/base-poster.png',
    img: 'https://i.imgur.com/base.png',
    variants: [
      { id: 'gold', name: 'Golden', price: 8, img: 'https://lookaside.fbsbx.com/whatsapp_business/gold.png' },
      { id: 'blue', name: 'Blue', price: 7, img: 'https://i.imgur.com/blue.png' }
    ]
  };
  const selected = findProductVariant(item, 'gold');
  assert.equal(selected.name, 'Golden');
  assert.equal(productImageUrl(productShareItem(item, 'gold')), 'https://lookaside.fbsbx.com/whatsapp_business/gold.png');
  assert.equal(
    productOgImageUrl(item, undefined, 'gold'),
    'https://www.h4sxmy.xyz/og-image/variant-item.png?v=' + productShareVersion(item, 'gold') + '&variant=gold'
  );
  assert.equal(productShareUrl(item, undefined, 'gold'), 'https://www.h4sxmy.xyz/item/variant-item?v=' + productShareVersion(item, 'gold') + '&variant=gold');
  assert.equal(catalogItemUrl(item, undefined, 'gold'), 'https://www.h4sxmy.xyz/?item=variant-item&variant=gold');
  assert.notEqual(productShareVersion(item, 'gold'), productShareVersion(item, 'blue'));
  const html = sharePageHtml({ item, variantId: 'gold' });
  assert.match(html, /property="og:title" content="Dragon Fruit - Golden \| H4SX STORE"/);
  assert.match(html, /property="og:image" content="https:\/\/www\.h4sxmy\.xyz\/og-image\/variant-item\.png\?v=r5-[a-z0-9]+&amp;variant=gold"/);
  assert.match(html, /rel="canonical" href="https:\/\/www\.h4sxmy\.xyz\/\?item=variant-item&amp;variant=gold"/);
  assert.match(html, /location\.replace\("https:\/\/www\.h4sxmy\.xyz\/\?item=variant-item&variant=gold"\)/);
});

test('variant image proxy fetches the selected variant image', async () => {
  const handler = (await import('../api/product-share.js')).default;
  const variantImage = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/gold-media';
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/store/inventory.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'variant-proxy',
            poster: 'https://i.imgur.com/base-poster.png',
            img: 'https://i.imgur.com/base.png',
            variants: [{ id: 'gold', name: 'Golden', img: variantImage }]
          },
          { id: 'media-1', img: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/opaque-media' }
        ]
      };
    }
    if (String(url) === variantImage) {
      return {
        ok: true,
        status: 200,
        headers: { get: name => name === 'content-type' ? 'image/png' : null },
        arrayBuffer: async () => Uint8Array.from([4, 5, 6]).buffer
      };
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
    await handler({ method: 'GET', query: { ogImage: 'variant-proxy.png', variant: 'gold' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Content-Type'], 'image/png');
    assert.deepEqual([...response.body], [4, 5, 6]);
    assert(calls.some(call => call.url === variantImage));
  } finally {
    globalThis.fetch = originalFetch;
  }
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
  assert.match(storeApp, /searchParams\.set\('v', productShareVersion\(item, variant\?\.id \|\| ''\)\)/);
});

test('root product links serve selected variant metadata to WhatsApp without changing browser navigation', async () => {
  const rootRoute = vercelConfig.routes.find(route => route.src === '^/$'
    && route.has?.some(condition => condition.type === 'query' && condition.key === 'item'));
  assert.ok(rootRoute, 'root product route runs before the static index file');
  assert.equal(rootRoute.dest, '/api/product-share');
  assert.equal(vercelConfig.rewrites.some(rewrite => rewrite.source === '/'), false);

  const sharedUrl = new URL(
    'https://www.h4sxmy.xyz/?preview=on&game=brookhaven&part=roblox&item=23&variant=vehicle-pack&v=r5-livecheck'
  );
  const userAgent = rootRoute.has.find(condition => condition.type === 'header' && condition.key === 'user-agent');
  assert.ok(userAgent, 'root product route is crawler-only');
  const routeMatches = (route, url, agent) => route.src === '^/$'
    && url.pathname === '/'
    && route.has.every(condition => {
      const value = condition.type === 'query'
        ? url.searchParams.get(condition.key)
        : condition.type === 'header' && condition.key === 'user-agent' ? agent : null;
      return value != null && (condition.value == null || new RegExp(condition.value).test(value));
    });
  assert.equal(routeMatches(rootRoute, sharedUrl, 'WhatsApp/2.24.7.80 A'), true);
  assert.equal(routeMatches(rootRoute, sharedUrl, 'Mozilla/5.0 Chrome/120.0'), false);
  assert(readFileSync(new URL('../index.htm', import.meta.url), 'utf8').includes('<html'));

  const variantImage = 'https://i.imgur.com/vehicle-pack.png';
  const item = {
    id: '23',
    name: 'Gamepass Brookhaven',
    variants: [{
      id: 'vehicle-pack',
      name: 'Vehicle Pack',
      price: 12.5,
      description: 'Pakej kenderaan eksklusif',
      img: variantImage
    }]
  };
  const originalFetch = globalThis.fetch;
  const imageCalls = [];
  globalThis.fetch = async url => {
    imageCalls.push(String(url));
    if (String(url).includes('/store/inventory.json')) {
      return { ok: true, status: 200, json: async () => [item] };
    }
    if (String(url) === variantImage) {
      return {
        ok: true,
        status: 200,
        headers: { get: name => name === 'content-type' ? 'image/png' : null },
        arrayBuffer: async () => Uint8Array.from([7, 8, 9]).buffer
      };
    }
    throw new Error('Unexpected image request: ' + String(url));
  };
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    end() { this.ended = true; return this; }
  };
  const imageResponse = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    redirect(code, url) { this.statusCode = code; this.location = url; return this; },
    end() { this.ended = true; return this; }
  };
  try {
    const handler = (await import('../api/product-share.js?root-variant-regression')).default;
    await handler({
      method: 'GET',
      query: Object.fromEntries(sharedUrl.searchParams),
      headers: { 'user-agent': 'WhatsApp/2.24.7.80 A' }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /property="og:title" content="Gamepass Brookhaven - Vehicle Pack \| H4SX STORE"/);
    assert.match(response.body, /property="og:description" content="RM12\.50 · Pakej kenderaan eksklusif"/);
    assert.match(response.body, /property="og:image" content="https:\/\/www\.h4sxmy\.xyz\/og-image\/23\.png\?v=r5-[a-z0-9]+&amp;variant=vehicle-pack"/);

    const proxyHandler = (await import('../api/product-share.js?root-variant-image-regression')).default;
    await proxyHandler({
      method: 'GET',
      query: { ogImage: '23.png', variant: 'vehicle-pack', v: 'r5-livecheck' }
    }, imageResponse);
    assert.equal(imageResponse.statusCode, 200);
    assert.equal(imageResponse.headers['Content-Type'], 'image/png');
    assert.deepEqual([...imageResponse.body], [7, 8, 9]);
    assert(imageCalls.includes(variantImage), 'proxy fetches the selected variant image');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('shared variant links are passed through URL routing into the product modal selection', () => {
  assert.match(storeApp, /function getVariantFromUrl\(\)[\s\S]*?searchParams\.get\('variant'\)/);
  assert.match(storeApp, /openGame\(gameGroupName\(item\), \{ fromUrl: true, itemId: item\.id, variantId \}\)/);
  assert.match(storeApp, /openProductImage\(options\.itemId, \{[\s\S]*?variantId: options\.variantId/);
  assert.match(storeApp, /const requestedVariant = variants\.find\(variant => variant\.id === String\(options\.variantId \|\| ''\)\)/);
  assert.match(storeApp, /updateProductUrl\(item, modalVariantId\)/);
  assert.match(storeApp, /shareModalProductVariant/);
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

test('product share handler returns the selected variant destination and image preview', async () => {
  const handler = createProductShareHandler(async () => [{
    id: '18',
    name: 'Dragon Fruit',
    img: 'https://i.imgur.com/base.png',
    variants: [{ id: 'gold', name: 'Golden', img: 'https://lookaside.fbsbx.com/whatsapp_business/gold.png' }]
  }]);
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    end() { this.ended = true; return this; }
  };
  await handler({ method: 'GET', query: { id: '18', variant: 'gold' } }, response);
  assert.match(response.body, /property="og:image" content="https:\/\/www\.h4sxmy\.xyz\/og-image\/18\.png\?v=r5-[a-z0-9]+&amp;variant=gold"/);
  assert.match(response.body, /property="og:title" content="Dragon Fruit - Golden \| H4SX STORE"/);
  assert.match(response.body, /location\.replace\("https:\/\/www\.h4sxmy\.xyz\/\?item=18&variant=gold"\)/);
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
