import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('actual admin save notifies only after Firebase commit; unavailable notifier cannot fail save', async () => {
  const code = await readFile(new URL('../catalog-control.js', import.meta.url), 'utf8');
  const notifier = code.slice(code.indexOf('function requestProductSheetSync('), code.indexOf('function readStoredList('));
  const saves = code.slice(code.indexOf('async function saveStorePath('), code.indexOf('function startListeners('));
  let commit;
  const saveComplete = new Promise(resolve => { commit = resolve; });
  const events = [];
  const context = vm.createContext({
    auth: { currentUser: { uid: 'admin' } }, ROOT: 'store',
    database: { ref: () => ({ once: async () => ({ val: () => [] }), update: () => saveComplete }) },
    withTimeout: promise => promise, storeMetaUpdates: () => ({}),
    window: { dispatchEvent: event => { events.push(event.type); throw Error('optional notifier failed'); } },
    CustomEvent: class { constructor(type) { this.type = type; } }, console: { warn() {} },
    rememberUndo() {}, notify() {}
  });
  vm.runInContext(notifier + saves, context);
  const pending = vm.runInContext("saveStorePath('inventory', [], 'saved')", context);
  await Promise.resolve();
  assert.equal(events.length, 0);
  commit();
  await pending;
  assert.deepEqual(events, ['h4sx:catalog-saved']);
  await vm.runInContext("saveStorePath('config', {}, 'saved')", context);
  assert.equal(events.length, 1);
});

test('browser auto sync uses same-origin authenticated API and contains failures', async () => {
  const code = await readFile(new URL('../product-sheet-sync.js', import.meta.url), 'utf8');
  const elements = new Map(['product-sheet-full-sync', 'product-sheet-status', 'product-sheet-result'].map(id => [id, { addEventListener() {}, disabled: false, textContent: '' }]));
  const listeners = {}, timers = new Map(); let timerId = 0, sent;
  const auth = { currentUser: { getIdToken: async () => 'test-user-token' }, onAuthStateChanged() {} };
  const firebase = { auth: () => auth };
  vm.runInNewContext(code, { document: { getElementById: id => elements.get(id) }, firebase,
    window: { firebase, addEventListener: (event, callback) => { listeners[event] = callback; } },
    navigator: { onLine: true }, AbortController, console: { warn() {} },
    setInterval() {}, setTimeout: (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; }, clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => { sent = { url, options }; return { ok: false, status: 503, json: async () => ({ error: 'SYNC_NOT_CONFIGURED' }) }; }
  });
  listeners['h4sx:catalog-saved']();
  const scheduled = [...timers.values()].find(timer => timer.ms === 800);
  await scheduled.callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.url, '/api/product-sheet-sync');
  assert.equal(sent.options.headers.Authorization, 'Bearer test-user-token');
  assert.equal(sent.options.body, '{"action":"sync"}');
  assert.ok(elements.get('product-sheet-result').textContent.includes('belum dikonfigurasi'));
  assert.equal(elements.get('product-sheet-full-sync').disabled, false);
});
