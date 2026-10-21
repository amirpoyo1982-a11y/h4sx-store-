import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseReviewPublishedAt } from '../review/review-publish-time.js';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

function previewBypassEnabled(search) {
  const window = { location: { search } };
  vm.runInNewContext(read('preview-bypass.js'), { window, URLSearchParams });
  return window.H4SXPreviewBypass.isEnabled();
}

test('preview bypass is on by default and turns off for explicit disabled values', () => {
  for (const search of ['', '?other=value', '?preview=on', '?preview=1', '?preview=']) {
    assert.equal(previewBypassEnabled(search), true, search || 'no query');
  }
  for (const value of ['off', 'OFF', 'false', '0', 'no']) {
    assert.equal(previewBypassEnabled('?preview=' + value), false, value);
  }
});

test('storefront and review both load the shared preview bypass before their app code', () => {
  const storefront = read('index.htm');
  const review = read('review/index.htm');
  const serviceWorker = read('sw.js');
  assert.match(storefront, /<script defer src="\/preview-bypass\.js\?v=[^"]+"><\/script>\s*<script defer src="app\.js/);
  assert.match(review, /<script src="\/preview-bypass\.js\?v=[^"]+"><\/script>\s*<script type="module" src="\/review\/review-app\.js/);
  assert.match(serviceWorker, /'\.\/preview-bypass\.js\?v=default-on-20261021'/);
  assert.match(serviceWorker, /'\.\/app\.js\?v=preview-bypass-20261021'/);
  assert.match(read('app.js'), /return window\.H4SXPreviewBypass\.isEnabled\(\);/);
  assert.match(read('review/review-app.js'), /return window\.H4SXPreviewBypass\.isEnabled\(\);/);
});

test('review publish time parser rejects missing, invalid, and future timestamps', () => {
  const now = Date.parse('2026-10-21T10:00:00Z');
  assert.equal(parseReviewPublishedAt(null, now), null);
  assert.equal(parseReviewPublishedAt('', now), null);
  assert.equal(parseReviewPublishedAt('not a date', now), null);
  assert.equal(parseReviewPublishedAt('Wed, 21 Oct 2026 10:06:00 GMT', now), null);
  assert.equal(parseReviewPublishedAt('Wed, 21 Oct 2026 10:04:00 GMT', now)?.toISOString(), '2026-10-21T10:04:00.000Z');
});

test('review publish label is refreshed with a cache-busted GET and hidden-tab polling', () => {
  const app = read('review/review-app.js');
  assert.match(app, /url\.searchParams\.set\('publish_probe', Date\.now\(\)\.toString\(\)\)/);
  assert.match(app, /fetch\(url\.toString\(\), \{ cache:'no-store' \}\)/);
  assert.doesNotMatch(app, /fetch\(url\.toString\(\), \{ method:'HEAD'/);
  assert.match(app, /setInterval\(\(\) => \{\s*if \(document\.visibilityState !== 'hidden'\) loadReviewPublishedAt\(\);\s*\}, 60000\)/);
  assert.match(app, /document\.addEventListener\('visibilitychange'/);
  assert.match(app, /parseReviewPublishedAt\(document\.lastModified\)/);
  assert.match(app, /if \(!fallback \|\| published > fallback\) renderReviewPublishedAt\(published\)/);
  assert.doesNotMatch(app, /catch \(error\) \{\s*stamp\.hidden = true/);
});
