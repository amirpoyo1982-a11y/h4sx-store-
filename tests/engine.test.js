import test from 'node:test';
import assert from 'node:assert/strict';
import { runSync, LEASE_MS, publicStatus } from '../server/product-sheets/engine.js';
import { HEADERS } from '../server/product-sheets/catalog.js';

const quiet = { info() {}, warn() {}, error() {} };
function setup() {
  let state = {}, time = 1000000, rows = [], source = [{ id: 1, name: '100 Robux', price: 4.4, stock: 999 }], reads = 0, writes = 0;
  let onRead, onWrite;
  const store = {
    read: async () => structuredClone(state),
    update: async reducer => {
      const next = reducer(structuredClone(state));
      if (next == null) return { committed: false, value: structuredClone(state) };
      state = structuredClone(next);
      return { committed: true, value: structuredClone(state) };
    }
  };
  const deps = { store, clock: () => time, logger: quiet, delay: async () => {},
    readCatalog: async () => ({ inventory: structuredClone(source) }),
    sheets: {
      read: async () => { reads++; if (onRead) await onRead(); return { rows: structuredClone(rows), properties: {} }; },
      write: async value => { writes++; rows = structuredClone(value); if (onWrite) await onWrite(); }
    }
  };
  return { deps, store, run: options => runSync({ ...deps, ...options }),
    get state() { return state; }, get rows() { return rows; }, get reads() { return reads; }, get writes() { return writes; },
    set source(value) { source = value; }, set onRead(value) { onRead = value; }, set onWrite(value) { onWrite = value; },
    advance: ms => { time += ms; }, set rows(value) { rows = value; }
  };
}

test('Vercel engine ADD/UPDATE/DELETE, no-op skips API reads, full sync repairs duplicates', async () => {
  const h = setup();
  await h.run();
  assert.equal(h.rows.length, 2);
  await h.run();
  assert.equal(h.reads, 1);
  h.source = [{ id: 1, name: 'Updated', price: 7, stock: 0 }, { id: 2, name: 'Second' }];
  await h.run();
  assert.equal(h.rows[1][2], 7);
  assert.equal(h.rows.length, 3);
  h.rows = [...h.rows, h.rows[1]];
  await h.run({ force: true });
  assert.equal(h.rows.length, 3);
  h.source = [{ id: 2, name: 'Second' }];
  await h.run();
  assert.equal(h.rows[1][0], '2');
  h.source = null;
  await h.run();
  assert.deepEqual(h.rows, [HEADERS]);
});

test('concurrent calls never write together; later request remains pending for retry', async () => {
  const h = setup();
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  h.onRead = async () => { entered(); await gate; };
  const first = h.run();
  await ready;
  h.source = [{ id: 2, name: 'Newest' }];
  const second = await h.run();
  assert.equal(second.pending, true);
  assert.equal(h.writes, 0);
  unblock();
  await first;
  assert.equal(h.state.pending, true);
  h.onRead = undefined;
  await h.run();
  assert.equal(h.state.pending, false);
  assert.equal(h.rows[1][0], '2');
});

test('transient read 429 is retried inline without exposing raw errors', async () => {
  const h = setup();
  let failures = 2;
  h.onRead = async () => { if (failures-- > 0) throw { response: { status: 429 }, message: 'sensitive upstream body' }; };
  await h.run();
  assert.equal(h.reads, 3);
  assert.equal(h.state.pending, false);
});

test('failed sync retains durable intent, backs off, then recovers after permission restored', async () => {
  const h = setup();
  h.onRead = async () => { throw { response: { status: 403 } }; };
  await assert.rejects(h.run(), /UPSTREAM_403/);
  assert.equal(h.state.pending, true);
  assert.equal(h.state.lock, null);
  assert.equal((await h.run()).state, 'retry-pending');
  assert.equal(h.reads, 1);
  h.advance(16000); h.onRead = undefined;
  await h.run();
  assert.equal(h.state.pending, false);
});

test('ambiguous successful write holds lease; retry after lease expiry cannot duplicate', async () => {
  const h = setup();
  h.onWrite = async () => { throw new Error('connection lost after server commit'); };
  await assert.rejects(h.run(), /SHEET_WRITE_UNCERTAIN/);
  assert.ok(h.state.lock);
  assert.equal((await h.run({ force: true })).pending, true);
  assert.equal(h.writes, 1);
  h.advance(LEASE_MS + 1); h.onWrite = undefined;
  await h.run();
  assert.equal(h.rows.length, 2);
  assert.equal(h.writes, 1);
  assert.equal(h.state.pending, false);
});

test('expired/crashed lease recovers and lock owner loss stops the old writer', async () => {
  const h = setup();
  await h.store.update(() => ({ lock: { owner: 'crashed', expiresAt: 999999 }, pending: true }));
  h.onRead = () => h.store.update(state => ({ ...state, lock: { owner: 'different-worker', expiresAt: 9000000 } }));
  await assert.rejects(h.run(), /SYNC_LEASE_LOST/);
  assert.equal(h.writes, 0);
  assert.equal(h.state.lock.owner, 'different-worker');
});

test('public status hides ownership, request IDs and source hash', () => {
  assert.deepEqual(Object.keys(publicStatus({ lock: { owner: 'private', expiresAt: 9 }, requestId: 'private', sourceHash: 'hash' })).sort(),
    ['code', 'lastErrorAt', 'lastSuccessAt', 'nextAttemptAt', 'pending', 'products', 'state']);
});
