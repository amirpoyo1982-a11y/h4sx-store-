import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const adminSource = fs.readFileSync(new URL('../catalog-control.js', import.meta.url), 'utf8');

function functionSource(source, name, nextFunction) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const end = source.indexOf(`function ${nextFunction}(`, start);
  assert.notEqual(end, -1, `Missing following function after ${name}`);
  return source.slice(start, end);
}

function appPromoterHelpers() {
  const context = {
    DEFAULT_WA_NUMBER: '6285178259060',
    encodeURIComponent
  };
  vm.createContext(context);
  vm.runInContext(
    functionSource(appSource, 'normalizeWhatsAppTarget', 'configuredPrimaryWhatsAppTarget') +
    functionSource(appSource, 'isPromotedEnabled', 'paymentCatalogUrl') +
    'this.promoterWhatsAppTarget = promoterWhatsAppTarget; this.promoterWhatsAppUrl = promoterWhatsAppUrl; this.isPromotedProduct = isPromotedProduct;',
    context
  );
  return context;
}

function adminPayload(promoter) {
  const values = {
    'extra-json': { value: '{}' },
    'p-id': { value: '42' },
    'p-name': { value: 'Akaun game' },
    'p-game': { value: 'Roblox' },
    'p-platform': { value: '' },
    'p-subcategory': { value: '' },
    'p-badge': { value: '' },
    'p-name-emoji': { value: '' },
    'p-subcategory-emoji': { value: '' },
    'p-price': { value: '10' },
    'p-original-price': { value: '' },
    'p-stock': { value: '1' },
    'p-sold': { value: '' },
    'p-img': { value: '' },
    'p-desc': { value: '' },
    'p-active': { checked: true },
    'p-pinned': { checked: false },
    'p-display-position': { value: 'middle' },
    'p-roblox-lookup': { checked: false },
    'p-consultation': { checked: false },
    'p-promoted': { checked: promoter.enabled },
    'p-promoted-by': { value: promoter.name },
    'p-promoter-phone': { value: promoter.phone },
    'p-whatsapp': { value: '' },
    'p-consultation-button': { value: '' },
    'p-consultation-message': { value: '' }
  };
  const context = {
    byId: id => values[id],
    editorMode: 'product',
    editingKey: null,
    products: [],
    ADMIN_PRODUCT_BADGE_EMOJIS: [],
    numberOrBlank: value => value === '' ? null : Number(value),
    compact: object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== '' && value !== null && value !== undefined)),
    adminGameEmojiImages: () => []
  };
  vm.createContext(context);
  vm.runInContext(
    functionSource(adminSource, 'normalizePromoterPhone', 'syncProductPromoter') +
    functionSource(adminSource, 'collectEditorPayload', 'uniqueTextOptions'),
    context
  );
  return vm.runInContext('collectEditorPayload()', context);
}

test('promoter contact normalizes Malaysian numbers and safely builds a wa.me URL', () => {
  const helpers = appPromoterHelpers();
  const promoted = { promotedBy: 'Promoter', promoterPhone: '012-345 6789' };

  assert.equal(helpers.promoterWhatsAppTarget(promoted.promoterPhone), '60123456789');
  assert.equal(helpers.promoterWhatsAppUrl(promoted), 'https://wa.me/60123456789');
  assert.equal(helpers.isPromotedProduct(promoted), true);
});

test('missing or invalid promoter details use the normal product contact path', () => {
  const helpers = appPromoterHelpers();
  assert.equal(helpers.normalizeWhatsAppTarget(null), '6285178259060');
  assert.equal(helpers.normalizeWhatsAppTarget('not a phone'), '6285178259060');
  for (const item of [
    { promotedBy: 'Promoter', promoterPhone: null },
    { promotedBy: 'Promoter' },
    { promotedBy: 'Promoter', promoterPhone: 'not a phone' },
    { promotedBy: 'Promoter', promoterPhone: 'call 0123456789' },
    { promotedBy: '', promoterPhone: '0123456789' },
    { promoted: false, promotedBy: 'Promoter', promoterPhone: '0123456789' }
  ]) {
    assert.equal(helpers.isPromotedProduct(item), false);
    assert.equal(helpers.promoterWhatsAppUrl(item), '');
  }
});

test('admin product payload serializes promoter fields using the existing product keys', () => {
  const payload = adminPayload({ enabled: true, name: '  Promoter Baru  ', phone: '0123456789' });
  const serialized = JSON.parse(JSON.stringify(payload.item));
  assert.equal(serialized.promoted, true);
  assert.equal(serialized.promotedBy, 'Promoter Baru');
  assert.equal(serialized.promoterPhone, '0123456789');
});

test('admin product payload disables promoter while preserving entered values', () => {
  const payload = adminPayload({ enabled: false, name: 'Promoter Baru', phone: '0123456789' });
  assert.equal(payload.item.promoted, false);
  assert.equal(payload.item.promotedBy, 'Promoter Baru');
  assert.equal(payload.item.promoterPhone, '0123456789');
});

test('admin rejects enabled promoter with missing or invalid contact data', () => {
  assert.throws(
    () => adminPayload({ enabled: true, name: 'Promoter', phone: '' }),
    /Nombor WhatsApp promoter tidak sah/
  );
  assert.throws(
    () => adminPayload({ enabled: true, name: '', phone: '0123456789' }),
    /Nama promoter diperlukan/
  );
});

test('product editor exposes the promoter switch and fields', () => {
  assert.match(adminSource, /id="p-promoted"/);
  assert.match(adminSource, /id="p-promoted-by"/);
  assert.match(adminSource, /id="p-promoter-phone"/);
  assert.match(adminSource, /id="p-promoter-fields"/);
});
