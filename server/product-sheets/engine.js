import { createHash, randomUUID } from 'node:crypto';
import { normalizeCatalog, SyncError } from './catalog.js';
import { safeErrorCode, syncCatalog } from './sync.js';

// Exceeds Vercel's 60s execution AND Sheets' 180s server processing limit.
// An ambiguous write keeps this lease, so its late response cannot race a new writer.
export const LEASE_MS = 300000;
const transient = error => !(error instanceof SyncError) && (!error.response || [408, 429, 500, 502, 503, 504].includes(Number(error.response.status)));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function publicStatus(state, now = Date.now()) {
  return {
    state: state.pending && state.errorCode ? 'retry-pending' : state.lock?.expiresAt > now ? 'running' : state.pending ? 'pending' : state.lastSuccessAt ? 'success' : 'not-run',
    pending: !!state.pending, products: state.products ?? null,
    lastSuccessAt: state.lastSuccessAt || null, lastErrorAt: state.lastErrorAt || null,
    code: state.errorCode || null, nextAttemptAt: state.nextAttemptAt || null
  };
}

export async function runSync({ store, readCatalog, sheets, force = false, clock = Date.now, delay = sleep, logger = console, deadline = clock() + 40000 }) {
  const owner = randomUUID();
  // Register intent durably BEFORE acquiring the lease; busy requests are not lost.
  await store.update(state => ({ ...state, pending: true, requestId: owner,
    requestedAt: clock(), forceRequested: !!state.forceRequested || force }));
  const claim = await store.update(state => {
    if (state.lock?.expiresAt > clock() || (!force && state.nextAttemptAt > clock())) return null;
    return { ...state, lock: { owner, expiresAt: clock() + LEASE_MS } };
  });
  if (!claim.committed) return { ...publicStatus(claim.value, clock()), accepted: true, retryAfter: 15 };
  const capturedRequest = claim.value.requestId;
  try {
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (clock() >= deadline) throw new SyncError('SYNC_DEADLINE');
        const source = await readCatalog(deadline);
        const products = normalizeCatalog(source.inventory, source.games);
        const sourceHash = createHash('sha256').update(JSON.stringify(products)).digest('hex');
        if (!claim.value.forceRequested && sourceHash === claim.value.sourceHash) {
          result = { products: products.length, sourceHash, changed: false };
          break;
        }
        const synced = await syncCatalog({
          readCatalog: async () => source, now: () => new Date(clock()).toISOString(),
          sheets: {
            read: () => sheets.read(deadline),
            write: async (rows, properties) => {
              const current = await store.read();
              if (current.lock?.owner !== owner || current.lock.expiresAt - clock() < 15000) throw new SyncError('SYNC_LEASE_LOST');
              if (deadline - clock() < 1000) throw new SyncError('SYNC_DEADLINE');
              try { await sheets.write(rows, properties, deadline); }
              catch (error) {
                const status = Number(error.response?.status);
                if (!(error instanceof SyncError) && (!status || status >= 500 || status === 408)) throw new SyncError('SHEET_WRITE_UNCERTAIN');
                throw error;
              }
            }
          }
        });
        result = { ...synced, sourceHash };
        break;
      } catch (error) {
        if (!transient(error) || attempt === 2 || deadline - clock() < 10000) throw error;
        logger.warn('product_sheet_retry', { attempt: attempt + 1, code: safeErrorCode(error) });
        await delay(1000 * (2 ** attempt));
      }
    }
    const completed = await store.update(state => {
      if (state.lock?.owner !== owner) return null;
      const pending = state.requestId !== capturedRequest;
      return { ...state, lock: null, pending, forceRequested: pending && state.forceRequested,
        ...result, failures: 0, errorCode: null, nextAttemptAt: null, lastSuccessAt: new Date(clock()).toISOString() };
    });
    if (!completed.committed) throw new SyncError('SYNC_LEASE_LOST');
    logger.info('product_sheet_sync_success', { products: result.products, changed: result.changed });
    return { ...publicStatus(completed.value, clock()), accepted: true, changed: result.changed };
  } catch (error) {
    const code = safeErrorCode(error);
    logger.error('product_sheet_sync_failed', { code });
    try {
      await store.update(state => state.lock?.owner !== owner ? null : ({
        ...state, lock: code === 'SHEET_WRITE_UNCERTAIN' ? state.lock : null, pending: true, errorCode: code, lastErrorAt: new Date(clock()).toISOString(),
        failures: (state.failures || 0) + 1,
        nextAttemptAt: code === 'SHEET_WRITE_UNCERTAIN' ? state.lock.expiresAt : clock() + Math.min(900000, 15000 * (2 ** Math.min(state.failures || 0, 6)))
      }));
    } catch { logger.error('product_sheet_state_write_failed'); }
    throw new SyncError(code);
  }
}
