import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../server/product-sheets/handler.js';

const quiet = { error() {}, info() {}, warn() {} };
function response() { return { code: 0, headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(v) { this.body = v; return this; } }; }
test('API fails closed: missing token, invalid token, ordinary Firebase user, wrong cron secret', async () => {
  let reads = 0;
  const service = { config: { adminUids: 'admin', cronSecret: 'a'.repeat(32) },
    verifyToken: async token => { if (token === 'invalid') throw Error(); return { uid: token }; },
    store: { read: async () => { reads++; return {}; } }
  };
  const handler = createHandler(() => service, quiet);
  for (const [method, token, expected] of [['POST', '', 401], ['POST', 'invalid', 401], ['POST', 'customer', 403], ['GET', 'wrong', 401]]) {
    const res = response();
    await handler({ method, headers: { authorization: token ? `Bearer ${token}` : '' }, body: { action: 'status' } }, res);
    assert.equal(res.code, expected);
  }
  assert.equal(reads, 0);
  const res = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer admin' }, body: { action: 'status' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.state, 'not-run');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('unknown action/method rejected; full sync throttled globally', async () => {
  const handler = createHandler(() => ({ config: { adminUids: 'admin' }, verifyToken: async () => ({ uid: 'admin' }), store: { update: async () => ({ committed: false }) } }), quiet);
  for (const [method, action, expected] of [['DELETE', 'sync', 405], ['POST', 'delete-all', 400], ['POST', 'full-sync', 429]]) {
    const res = response(); await handler({ method, headers: { authorization: 'Bearer token' }, body: { action } }, res);
    assert.equal(res.code, expected);
  }
});
