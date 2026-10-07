import test from 'node:test';
import assert from 'node:assert/strict';
import { HEADERS, normalizeCatalog, planRows, buildSheetRequests } from '../server/product-sheets/catalog.js';
import { syncCatalog, isAllowedAdmin, safeErrorCode } from '../server/product-sheets/sync.js';

const t1 = '2026-10-07T01:00:00.000Z';
const t2 = '2026-10-07T02:00:00.000Z';
const product = (id, overrides = {}) => ({ id, name: `Produk ${id}`, price: 4.4, stock: 999, game: 'Roblox', img: 'https://example.com/100robux.png', ...overrides });
function harness(initial = []) {
  let source = initial;
  let rows = [];
  let writes = 0;
  let failAfterWrite = false;
  const sheets = {
    read: async () => ({ rows: structuredClone(rows), properties: {} }),
    write: async value => {
      writes++;
      rows = structuredClone(value);
      if (failAfterWrite) { failAfterWrite = false; throw new Error('response lost after successful write'); }
    }
  };
  return {
    set source(value) { source = value; },
    set failAfterWrite(value) { failAfterWrite = value; },
    set rows(value) { rows = value; },
    get rows() { return rows; }, get writes() { return writes; },
    run: (now = t1) => syncCatalog({ readCatalog: async () => ({ inventory: source }), sheets, now: () => now })
  };
}

test('initial/full sync includes existing products and ADD creates exactly one row per product ID', async () => {
  const h = harness([product(1)]);
  await h.run();
  h.source = [product(1), product(2, { name: '100 Robux' })];
  await h.run(t2);
  assert.deepEqual(h.rows[0], HEADERS);
  assert.deepEqual(h.rows[2], ['2', '100 Robux', 4.4, 999, 'Roblox', 'https://example.com/100robux.png', 'active', t2]);
  assert.equal(h.rows.length, 3);
  await h.run(t2);
  assert.equal(h.writes, 2);
});

test('UPDATE price/stock/name/category/image modifies same ID without duplicates', async () => {
  const h = harness([product(12), product(9)]);
  await h.run();
  h.source = [product(12, { name: 'Baru', price: 5, stock: 0, category: 'Gift', img: 'https://example.com/new.png' }), product(9)];
  await h.run(t2);
  assert.deepEqual(h.rows[1], ['12', 'Baru', 5, 0, 'Gift', 'https://example.com/new.png', 'active', t2]);
  assert.equal(h.rows[2][7], t1);
  await h.run(t2);
  assert.equal(h.rows.length, 3);
});

test('DELETE first array item shifts RTDB positions but not product identity', async () => {
  const h = harness([product(1), product(2)]);
  await h.run();
  h.source = [product(2)];
  await h.run(t2);
  assert.equal(h.rows.length, 2);
  assert.equal(h.rows[1][0], '2');
  assert.equal(h.rows[1][7], t1);
  h.source = null;
  await h.run(t2);
  assert.deepEqual(h.rows, [HEADERS]);
});

test('retry after ambiguous Google success is idempotent', async () => {
  const h = harness([product(1)]);
  h.failAfterWrite = true;
  await assert.rejects(h.run());
  await h.run(t2);
  assert.equal(h.writes, 1);
  assert.equal(h.rows.length, 2);
  assert.equal(h.rows[1][7], t1);
});

test('late retry reads latest source, never resurrects deleted products', async () => {
  const h = harness([product(1), product(2)]);
  await h.run();
  h.source = [product(2, { price: 12 })];
  await h.run(t2);
  await h.run(t2); // old event delivered later, carries no old snapshot
  assert.equal(h.rows.length, 2);
  assert.equal(h.rows[1][2], 12);
});

test('sparse/keyed Firebase objects and string IDs retain stable identity', () => {
  assert.deepEqual(normalizeCatalog({ 0: product('001'), 2: product(2) }).map(p => p[0]), ['001', '2']);
  assert.equal(normalizeCatalog({ '-FirebaseKey': { name: 'Keyed', price: 0 } })[0][0], '-FirebaseKey');
  assert.equal(normalizeCatalog([null, product(0)])[0][0], '0');
  assert.throws(() => normalizeCatalog({ 0: { name: 'No ID' } }), /MISSING_PRODUCT_ID/);
});

test('invalid catalog and duplicate IDs fail before any Sheet mutation', async () => {
  for (const source of [[product(1), product('1')], [product(1, { price: -1 })], [false], 'bad', [product(1, { img: 'javascript:alert(1)' })]]) {
    const h = harness(source);
    await assert.rejects(h.run());
    assert.equal(h.writes, 0);
  }
});

test('null price/stock stay blank, zero stays numeric, hidden flags match storefront', () => {
  const result = normalizeCatalog([product(1, { price: null, stock: null, active: 'false' }), product(2, { stock: '0', hidden: 'true' }), product(3, { price: 0 })]);
  assert.deepEqual(result[0].slice(2, 4), ['', '']);
  assert.equal(result[0][6], 'inactive');
  assert.equal(result[1][3], 0);
  assert.equal(result[1][6], 'inactive');
  assert.equal(result[2][2], 0);
});

test('hidden parent games produce inactive products, including Blox Fruits aliases', () => {
  const rows = normalizeCatalog([product(1, { game: 'Blox Fruit Permanent' })], [{ name: 'Blox Fruits', active: false }]);
  assert.equal(rows[0][6], 'inactive');
});

test('full sync repairs existing Sheet duplicates and preserves valid timestamps', () => {
  const p = normalizeCatalog([product(1)]);
  const row = [...p[0], t1];
  const plan = planRows(p, [HEADERS, row, row], t2);
  assert.equal(plan.changed, true);
  assert.deepEqual(plan.rows, [HEADERS, row]);
  assert.throws(() => planRows(p, [['unrelated data']], t2), /SHEET_HEADER_MISMATCH/);
});

test('one atomic update clears deleted rows and stores untrusted strings as text, never formulas', () => {
  const rows = [HEADERS, ...normalizeCatalog([product('001', { name: '=IMPORTXML("https://example.com")' })]).map(row => [...row, t1])];
  const requests = buildSheetRequests(rows, { sheetId: 42, gridProperties: { rowCount: 100, columnCount: 12 } });
  assert.equal(requests.length, 1);
  const write = requests[0].updateCells;
  assert.equal(write.range.endRowIndex, 100);
  assert.equal(write.range.endColumnIndex, 8);
  assert.equal(write.fields, 'userEnteredValue');
  assert.deepEqual(write.rows[1].values[0].userEnteredValue, { stringValue: '001' });
  assert.equal(write.rows[1].values[1].userEnteredValue.formulaValue, undefined);
  assert.equal(write.rows[1].values[2].userEnteredValue.numberValue, 4.4);
});

test('Sheet grid expands in same batch before larger full sync', () => {
  const requests = buildSheetRequests([HEADERS, ['1']], { sheetId: 0, gridProperties: { rowCount: 1, columnCount: 2 } });
  assert.deepEqual(requests[0].updateSheetProperties.properties.gridProperties, { rowCount: 2, columnCount: 8 });
  assert.ok(requests[1].updateCells);
});

test('unreadable Firebase does not clear Sheet', async () => {
  let writes = 0;
  await assert.rejects(syncCatalog({ readCatalog: async () => { throw new Error('permission denied'); }, sheets: { write: () => writes++ } }));
  assert.equal(writes, 0);
});

test('admin allowlist fails closed and error logs cannot expose credentials', () => {
  assert.equal(isAllowedAdmin('admin-1', 'admin-1, admin-2'), true);
  assert.equal(isAllowedAdmin('user-1', 'admin-1'), false);
  assert.equal(isAllowedAdmin('admin-1', ''), false);
  assert.equal(isAllowedAdmin(undefined, 'admin-1'), false);
  assert.equal(safeErrorCode({ message: 'private token', config: { Authorization: 'secret' }, response: { status: 403 } }), 'UPSTREAM_403');
  assert.equal(safeErrorCode(new Error('private key')), 'SYNC_UPSTREAM_FAILURE');
});
