import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function section(first, next) {
  return source.slice(source.indexOf(`function ${first}(`), source.indexOf(`function ${next}(`));
}
function fixture() {
  const nodes = new Map();
  const ctx = vm.createContext({
    Date, Number, String, Math, Boolean, JSON,
    document: { getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { classList: { add() {}, toggle() {}, contains: () => false } });
      return nodes.get(id);
    } },
    setInterval: () => 1, clearInterval: () => {},
    currentGame: 'Test', inventory: [], cartItems: [], modalItemId: null, quickPreviewItemId: null,
    renders: 0, renderProductGrid() { ctx.renders++; }, renderCart() {},
    renderProductModalSelection() {}, openProductQuickPreview() {},
    productPromoConfig: () => null, effectivePromoExpiry: () => 0,
    savedProductPromoCode: () => '',
  });
  vm.runInContext(`let flashDropConfig = {active:false}; let flashDropClockOffset = 0;
    let flashDropPricingSignature = ''; let flashDropTimer = null;
    ${section('flashDropNow', 'normaliseFlashDrop')}
    ${section('normaliseFlashDrop', 'startFlashDropSync')}
    ${section('flashDropProduct', 'openFlashDropProduct')}
    ${section('productVariants', 'formatVariantPrice')}
    ${section('productPromoResult', 'promoPhoneVerificationRequired')}
    function configure(config) { flashDropConfig = normaliseFlashDrop(config); }
    function timerRunning() { return flashDropTimer !== null; }
    function setOffset(value) { flashDropClockOffset = value; }
  `, ctx);
  return ctx;
}
function live(overrides = {}) {
  return { active: true, productId: '1', promoPrice: 5, startsAt: Date.now() - 10000, endsAt: Date.now() + 60000, ...overrides };
}

test('automatic price starts on the boundary and restores the untouched catalog price at expiry', () => {
  const c = fixture(), item = { id:1, name:'Test', price:10 };
  const config = live({ startsAt:1000, endsAt:2000 });
  c.configure(config);
  assert.equal(c.flashDropPrice(item, c.normaliseFlashDrop(config), 999), null);
  assert.equal(c.flashDropPrice(item, c.normaliseFlashDrop(config), 1000), 5);
  assert.equal(c.flashDropPrice(item, c.normaliseFlashDrop(config), 1999), 5);
  assert.equal(c.flashDropPrice(item, c.normaliseFlashDrop(config), 2000), null);
  c.configure(live());
  assert.equal(c.productPromoResult(item, '').final, 5);
  assert.equal(c.productPromoResult(item, 'OTHER_CODE').final, 5);
  c.configure(live({ endsAt:Date.now() - 1 }));
  assert.equal(c.productPromoResult(item, '').final, 10);
  assert.equal(item.price, 10);
});

test('only the selected product and variant get the sale, and the starting price follows it', () => {
  const c = fixture();
  const item = { id:1, price:20, variants:[{ id:'a', price:10 }, { id:'b', price:20 }] };
  c.configure(live({ variantId:'b', promoPrice:3 }));
  assert.equal(c.productPromoResult(c.effectiveProductItem(item, 'a'), '').final, 10);
  assert.equal(c.productPromoResult(c.effectiveProductItem(item, 'b'), '').final, 3);
  assert.equal(c.flashDropStartingItem(item).variantId, 'b');
  assert.equal(c.productPromoResult({ id:2, price:20 }, '').final, 20);
});

test('OFF, legacy notice-only and invalid sale prices cannot change catalog prices', () => {
  const c = fixture(), item = { id:1, price:10 };
  for (const overrides of [{ active:false }, { promoPrice:null }, { promoPrice:'' }, { promoPrice:-1 }, { promoPrice:Infinity }, { promoPrice:10 }, { promoPrice:11 }]) {
    c.configure(live(overrides));
    assert.equal(c.productPromoResult(item, '').final, 10);
  }
});

test('Malaysia datetime roundtrips independently of the device timezone; server offset controls pricing', () => {
  const c = fixture();
  const timestamp = c.flashDropMalaysiaTimestamp('2026-10-11T03:30');
  assert.equal(timestamp, Date.parse('2026-10-10T19:30:00Z'));
  assert.equal(c.flashDropMalaysiaInput(timestamp), '2026-10-11T03:30');
  assert.ok(Number.isNaN(c.flashDropMalaysiaTimestamp('invalid')));
  c.configure(live({ startsAt:Date.now() + 3600000, endsAt:Date.now() + 7200000 }));
  assert.equal(c.flashDropIsLive(), false);
  c.setOffset(3600001);
  assert.equal(c.flashDropIsLive(), true);
});

test('scheduled start keeps its timer; expiry updates open prices and stops the timer', () => {
  const c = fixture();
  c.configure(live({ startsAt:Date.now() + 10000 }));
  c.renderFlashDrop();
  assert.equal(c.timerRunning(), true);
  const initialRenders = c.renders;
  c.renderFlashDrop();
  assert.equal(c.renders, initialRenders);
  c.configure(live());
  c.renderFlashDrop();
  assert.equal(c.renders, initialRenders + 1);
  c.configure(live({ endsAt:Date.now() - 1 }));
  c.renderFlashDrop();
  assert.equal(c.renders, initialRenders + 2);
  assert.equal(c.timerRunning(), false);
});
