import { timingSafeEqual } from 'node:crypto';
import { isAllowedAdmin, safeErrorCode } from './sync.js';
import { publicStatus, runSync } from './engine.js';

function matchesSecret(value, secret) {
  if (!secret || secret.length < 32 || !value) return false;
  const left = Buffer.from(value), right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createHandler(getServices, logger = console) {
  return async (req, res) => {
    const started = Date.now();
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    const bearer = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
    if (!bearer) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    try {
      const service = getServices();
      let action;
      if (req.method === 'GET') {
        if (!matchesSecret(bearer, service.config.cronSecret)) return res.status(401).json({ error: 'UNAUTHENTICATED' });
        action = 'cron';
      } else {
        let user;
        try { user = await service.verifyToken(bearer); }
        catch { return res.status(401).json({ error: 'UNAUTHENTICATED' }); }
        if (!isAllowedAdmin(user.uid, service.config.adminUids)) return res.status(403).json({ error: 'PERMISSION_DENIED' });
        action = req.body?.action;
        if (!['sync', 'full-sync', 'status'].includes(action)) return res.status(400).json({ error: 'INVALID_ACTION' });
      }
      if (action === 'status') return res.status(200).json(publicStatus(await service.store.read()));
      if (action === 'full-sync') {
        const gate = await service.store.update(state => Date.now() - (state.lastManualRequest || 0) < 60000 ? null : ({ ...state, lastManualRequest: Date.now() }));
        if (!gate.committed) { res.setHeader('Retry-After', '60'); return res.status(429).json({ error: 'RATE_LIMITED' }); }
      }
      const result = await runSync({ ...service, force: action === 'full-sync' || action === 'cron', logger, deadline: started + 40000 });
      if (result.pending) res.setHeader('Retry-After', String(result.retryAfter || 15));
      return res.status(result.pending ? 202 : 200).json(result);
    } catch (error) {
      const code = safeErrorCode(error);
      logger.error('product_sheet_request_failed', { code });
      return res.status(503).json({ error: code, pending: true });
    }
  };
}
