import { SyncError } from './catalog.js';

export function createStateStore(stateUrl, request) {
  return {
    async read() { return (await request({ url: stateUrl })).data || {}; },
    async update(reducer) {
      // RTDB ETag compare-and-swap, never an in-memory lock on a Vercel instance.
      const deadline = Date.now() + 10000;
      for (let attempt = 0; attempt < 8; attempt++) {
        const response = await request({ url: stateUrl, headers: { 'X-Firebase-ETag': 'true' } }, deadline);
        const current = response.data || {};
        const next = reducer(current);
        if (next == null) return { committed: false, value: current };
        const etag = response.headers.get('etag');
        if (!etag) throw new SyncError('STATE_ETAG_MISSING');
        try {
          await request({ url: stateUrl, method: 'PUT', headers: { 'if-match': etag }, data: next }, deadline);
          return { committed: true, value: next };
        } catch (error) {
          if (Number(error.response?.status) !== 412) throw error;
        }
      }
      throw new SyncError('STATE_CONTENTION');
    }
  };
}
