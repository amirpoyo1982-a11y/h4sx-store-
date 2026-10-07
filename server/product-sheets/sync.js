import { normalizeCatalog, planRows, SyncError } from './catalog.js';

// Dependencies injected so retries/failure recovery can be tested without live data.
export async function syncCatalog({ readCatalog, sheets, now = () => new Date().toISOString() }) {
  const { inventory, games } = await readCatalog();
  const products = normalizeCatalog(inventory, games); // Validate all before any write.
  const existing = await sheets.read();
  const plan = planRows(products, existing.rows, now());
  if (plan.changed) await sheets.write(plan.rows, existing.properties);
  return { products: products.length, changed: plan.changed };
}

export function safeErrorCode(error) {
  if (error instanceof SyncError) return error.code;
  const status = Number(error?.response?.status || error?.status);
  if ([400, 401, 403, 404, 408, 429, 500, 502, 503, 504].includes(status)) return `UPSTREAM_${status}`;
  // Never log the Google client error object: it can contain Authorization headers.
  return 'SYNC_UPSTREAM_FAILURE';
}

export function isAllowedAdmin(uid, configuredUids) {
  return typeof uid === 'string' && !!uid && String(configuredUids || '').split(',').map(value => value.trim()).filter(Boolean).includes(uid);
}
