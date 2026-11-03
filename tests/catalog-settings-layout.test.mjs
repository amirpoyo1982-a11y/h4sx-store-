import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('../catalog-control.htm', import.meta.url), 'utf8');
const app = readFileSync(new URL('../catalog-control.js', import.meta.url), 'utf8');

function section(className) {
  const match = page.match(new RegExp(`<section class="${className}"[\\s\\S]*?<\\/section>`));
  assert(match, `Expected ${className} section`);
  return match[0];
}

function quickToggleIds(markup) {
  return [...markup.matchAll(/id="(quick-[^"]+)"/g)].map(([, id]) => id);
}

test('store operations and unrelated website feature toggles have separate settings cards', () => {
  const operations = section('store-operation-settings');
  const features = section('website-feature-settings');

  assert.deepEqual(quickToggleIds(operations), ['quick-open', 'quick-maintenance']);
  assert.deepEqual(quickToggleIds(features), [
    'quick-review-maintenance',
    'quick-reviews-area',
    'quick-banner',
    'quick-spotlight'
  ]);
  assert.match(operations, /Status &amp; penutupan kedai/);
  assert.match(operations, /Waktu operasi, hari tutup, tajuk serta mesej penutupan/);
  assert.match(features, /Paparan ciri lain/);
});

test('full legacy configuration remains available in a separate advanced section', () => {
  const advanced = section('advanced-config-settings');

  assert.match(advanced, /id="config-editor"/);
  assert.match(advanced, /waktu operasi, mesej penutupan, flash sale, QR pembayaran/);
  assert.match(page, /id="save-config"/);
});

test('existing quick toggles retain their configuration keys and event wiring', () => {
  assert.match(app, /'quick-open','quick-maintenance','quick-review-maintenance','quick-reviews-area','quick-banner','quick-spotlight'/);
  assert.match(app, /current\.bukakedai = byId\('quick-open'\)\.checked/);
  assert.match(app, /current\.maintenance = byId\('quick-maintenance'\)\.checked/);
  assert.match(app, /current\.review_maintenance = byId\('quick-review-maintenance'\)\.checked/);
  assert.match(app, /current\.reviews_section_visible = byId\('quick-reviews-area'\)\.checked/);
  assert.match(app, /current\.promo_banner_active = byId\('quick-banner'\)\.checked/);
  assert.match(app, /current\.product_spotlight_enabled = byId\('quick-spotlight'\)\.checked/);
});
