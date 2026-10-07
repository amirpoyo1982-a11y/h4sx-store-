import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateStore } from '../server/product-sheets/state-store.js';

test('ETag collision rereads current state before retrying, preserving concurrent intent', async () => {
  let reads = 0, writes = 0;
  const store = createStateStore('https://example.test/state.json', async request => {
    if (!request.method) {
      reads++;
      assert.equal(request.headers['X-Firebase-ETag'], 'true');
      return { data: reads === 1 ? { requestId: 'old' } : { requestId: 'new' }, headers: new Headers({ etag: `version-${reads}` }) };
    }
    writes++;
    assert.equal(request.method, 'PUT');
    assert.equal(request.headers['if-match'], `version-${writes}`);
    if (writes === 1) throw { response: { status: 412 } };
    assert.equal(request.data.requestId, 'new');
    return { data: request.data };
  });
  const result = await store.update(state => ({ ...state, pending: true }));
  assert.equal(result.committed, true);
  assert.equal(result.value.requestId, 'new');
  assert.equal(writes, 2);
});

test('missing ETag cannot fall back to unsafe unconditional lock write', async () => {
  const store = createStateStore('https://example.test/state.json', async () => ({ data: {}, headers: new Headers() }));
  await assert.rejects(store.update(state => ({ ...state, pending: true })), /STATE_ETAG_MISSING/);
});
