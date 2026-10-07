export const HEADERS = ['product_id', 'name', 'price', 'stock', 'category', 'image', 'status', 'updated_at'];
export const MAX_PRODUCTS = 5000;

export class SyncError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function text(value, max = 4000) {
  if (value == null) return '';
  if (!['string', 'number'].includes(typeof value)) throw new SyncError('INVALID_PRODUCT_FIELD');
  const result = String(value).trim();
  if (result.length > max) throw new SyncError('PRODUCT_FIELD_TOO_LONG');
  return result;
}

function numeric(value) {
  if (value == null || value === '') return '';
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') throw new SyncError('INVALID_PRODUCT_NUMBER');
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new SyncError('INVALID_PRODUCT_NUMBER');
  return result;
}

const visible = item => String(item.active).toLowerCase() !== 'false' && String(item.hidden).toLowerCase() !== 'true';
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function group(item) {
  const custom = item.gameGroup || item.group || item.categoryGroup || item.parentGame;
  if (custom) return String(custom).trim();
  const name = String(item.game || item.name || '').trim();
  return /blox\s*fruit/i.test(name) ? 'Blox Fruits' : name;
}

// Numeric RTDB keys are array positions, NOT stable product identifiers.
// Existing inventory uses product.id; a future keyed object may use its stable key.
export function normalizeCatalog(inventory, games = null) {
  if (inventory == null) return [];
  if (typeof inventory !== 'object') throw new SyncError('INVALID_INVENTORY');
  if (games != null && typeof games !== 'object') throw new SyncError('INVALID_GAMES');
  const configuredGames = Object.values(games || {}).filter(item => item && typeof item === 'object');
  const seen = new Set();
  const products = [];
  for (const [key, item] of Object.entries(inventory)) {
    if (item == null) continue; // RTDB sparse arrays can have null holes.
    if (typeof item !== 'object' || Array.isArray(item)) throw new SyncError('INVALID_PRODUCT');
    const id = text(item.id ?? (!/^\d+$/.test(key) ? key : ''), 256);
    if (!id) throw new SyncError('MISSING_PRODUCT_ID');
    if (seen.has(id)) throw new SyncError('DUPLICATE_PRODUCT_ID');
    seen.add(id);
    const name = text(item.name);
    if (!name) throw new SyncError('MISSING_PRODUCT_NAME');
    const configured = configuredGames.find(game => normalize(group(game)) === normalize(group(item)) || normalize(game.name) === normalize(group(item)));
    const image = text(item.poster || item.image || item.img || item.thumbnail || '');
    // Explicit strings, not Sheets formulas. Image URLs are never fetched by the worker.
    if (image && !/^https?:\/\//i.test(image)) throw new SyncError('INVALID_IMAGE_URL');
    products.push([
      id, name, numeric(item.price), numeric(item.stock),
      text(item.category || item.gameGroup || item.game || item.platform || item.subcategory),
      image, visible(item) && (!configured || visible(configured)) ? 'active' : 'inactive'
    ]);
  }
  if (products.length > MAX_PRODUCTS) throw new SyncError('CATALOG_TOO_LARGE');
  return products.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
}

// Keep the old row order for existing IDs, append new IDs once, compact deletions.
// Rebuilding a managed projection also removes legacy duplicate rows in one write.
export function planRows(products, existingRows, now) {
  if (existingRows.length && !HEADERS.every((header, index) => existingRows[0]?.[index] === header)) {
    throw new SyncError('SHEET_HEADER_MISMATCH');
  }
  const remaining = new Map(products.map(row => [row[0], row]));
  const rows = [HEADERS];
  for (const old of existingRows.slice(1)) {
    const id = String(old[0] ?? '');
    const product = remaining.get(id);
    if (!product) continue;
    remaining.delete(id);
    const unchanged = product.every((value, index) => value === (old[index] ?? ''));
    const timestamp = unchanged && typeof old[7] === 'string' && Number.isFinite(Date.parse(old[7])) ? old[7] : now;
    rows.push([...product, timestamp]);
  }
  for (const product of remaining.values()) rows.push([...product, now]);
  return { rows, changed: JSON.stringify(rows) !== JSON.stringify(existingRows) };
}

export function buildSheetRequests(rows, properties) {
  const { sheetId, gridProperties } = properties;
  if (!Number.isInteger(sheetId) || !gridProperties) throw new SyncError('INVALID_SHEET');
  const rowCount = Math.max(gridProperties.rowCount || 0, rows.length);
  const columnCount = Math.max(gridProperties.columnCount || 0, HEADERS.length);
  const requests = [];
  if (rowCount !== gridProperties.rowCount || columnCount !== gridProperties.columnCount) {
    requests.push({ updateSheetProperties: {
      properties: { sheetId, gridProperties: { rowCount, columnCount } },
      fields: 'gridProperties.rowCount,gridProperties.columnCount'
    } });
  }
  requests.push({ updateCells: {
    range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: HEADERS.length },
    rows: rows.map(row => ({ values: row.map(value => ({ userEnteredValue:
      typeof value === 'number' ? { numberValue: value } : { stringValue: String(value) }
    })) })),
    // Clearing the trailing rows and writing the new rows are ONE atomic batch.
    fields: 'userEnteredValue'
  } });
  return requests;
}
