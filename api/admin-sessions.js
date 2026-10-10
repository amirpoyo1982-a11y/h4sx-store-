import { createHash } from 'node:crypto';

const ADMIN_UID = 'LWRN6IDv4OV1PZd7Vldgp6F9pdH3';
const PROJECT_ID = 'h4sx-6712c';
const ORIGINS = new Set(['https://www.h4sxmy.xyz', 'https://h4sxmy.xyz', 'https://review.h4sxmy.xyz']);
let services;

async function firebaseServices() {
  if (services) return services;
  let account;
  try {
    account = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      : { project_id:PROJECT_ID, client_email:process.env.FIREBASE_CLIENT_EMAIL, private_key:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') };
  } catch { throw Object.assign(new Error('Setup required'), { code:'sessions/setup-required' }); }
  if (account.project_id !== PROJECT_ID || !account.client_email || !account.private_key) {
    throw Object.assign(new Error('Setup required'), { code:'sessions/setup-required' });
  }
  const [{ initializeApp, getApps, cert }, { getAuth }, { getDatabase }, { getFirestore }] = await Promise.all([
    import('firebase-admin/app'), import('firebase-admin/auth'), import('firebase-admin/database'), import('firebase-admin/firestore')
  ]);
  const app = getApps().find(item => item.name === 'h4sx-admin-sessions') || initializeApp({
    credential:cert(account), projectId:PROJECT_ID,
    databaseURL:'https://h4sx-6712c-default-rtdb.asia-southeast1.firebasedatabase.app'
  }, 'h4sx-admin-sessions');
  services = { auth:getAuth(app), database:getDatabase(app), firestore:getFirestore(app) };
  return services;
}

export function describeDevice(userAgent = '') {
  const ua = String(userAgent).slice(0, 500);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Browser';
  let device = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Telefon Android' : /Windows/.test(ua) ? 'PC Windows' : /Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'PC Linux' : 'Perangkat';
  const model = ua.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]+)?\)/)?.[1]?.trim();
  if (model && model !== 'K' && model.length < 70) device += ' (' + model + ')';
  return { device, browser };
}

export function createSessionsHandler(getServices = firebaseServices) {
  return async function handler(req, res) {
    const origin = String(req.headers?.origin || '');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    if (!ORIGINS.has(origin)) return res.status(403).json({ error:'Origin tidak dibenarkan.' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error:'Method tidak dibenarkan.' });
    const bearer = String(req.headers?.authorization || '').match(/^Bearer (\S+)$/)?.[1];
    if (!bearer || bearer.length > 10000) return res.status(401).json({ error:'Login admin diperlukan.' });
    const action = req.body?.action;
    if (!['register', 'check', 'list', 'revoke-all'].includes(action)) return res.status(400).json({ error:'Tindakan tidak sah.' });
    let stage = 'credential';
    try {
      const { auth, database, firestore } = await getServices();
      stage = 'auth';
      const token = await auth.verifyIdToken(bearer, true);
      if (token.uid !== ADMIN_UID) return res.status(403).json({ error:'Akaun ini bukan admin H4SX.' });
      if (action === 'check') return res.status(200).json({ success:true });
      const root = database.ref('admin_sessions_private/' + token.uid);
      if (action === 'revoke-all') {
        stage = 'revoke';
        await auth.revokeRefreshTokens(token.uid);
        const record = await auth.getUser(token.uid);
        const revokedAt = Date.parse(record.tokensValidAfterTime);
        // Public timestamp only; device records remain in a private RTDB branch.
        let realtimeLogout = true;
        await Promise.all([
          root.child('revokedAt').set(revokedAt),
          firestore.doc('config/admin_session_security').set({ revokedAt })
        ]).catch(() => { realtimeLogout = false; });
        return res.status(200).json({ success:true, revokedAt, realtimeLogout });
      }
      const site = origin.includes('review.h4sxmy.xyz') ? 'review' : 'store';
      const deviceId = String(req.body?.deviceId || '');
      if (!/^[a-f0-9-]{16,64}$/i.test(deviceId)) return res.status(400).json({ error:'ID perangkat tidak sah.' });
      const sessionId = createHash('sha256').update(site + ':' + deviceId + ':' + token.auth_time).digest('hex');
      if (action === 'register') {
        stage = 'database-register';
        const now = Date.now();
        const detail = describeDevice(req.headers['user-agent']);
        await root.child('devices/' + sessionId).transaction(previous => ({
          ...detail, site, authTime:Number(token.auth_time) * 1000,
          firstSeen:previous?.firstSeen || now, lastSeen:now
        }));
        return res.status(200).json({ success:true, sessionId });
      }
      stage = 'database-list';
      const [snapshot, record] = await Promise.all([
        root.child('devices').orderByChild('lastSeen').limitToLast(100).once('value'), auth.getUser(token.uid)
      ]);
      const revokedAt = Date.parse(record.tokensValidAfterTime) || 0;
      const devices = Object.entries(snapshot.val() || {}).map(([id, value]) => ({
        id, device:String(value.device || 'Perangkat'), browser:String(value.browser || 'Browser'),
        site:value.site === 'review' ? 'review' : 'store', firstSeen:Number(value.firstSeen) || 0,
        lastSeen:Number(value.lastSeen) || 0, authTime:Number(value.authTime) || 0,
        revoked:Number(value.authTime) < revokedAt, current:id === sessionId
      })).sort((a,b) => b.lastSeen - a.lastSeen);
      return res.status(200).json({ success:true, devices });
    } catch (error) {
      if (error.code === 'sessions/setup-required') return res.status(503).json({ code:'setup-required', error:'Backend sesi belum dikonfigurasi. Tambah credential Firebase Admin dalam Vercel.' });
      if (['auth/id-token-revoked','auth/id-token-expired','auth/user-disabled','auth/argument-error','auth/invalid-id-token','auth/user-not-found'].includes(error.code) || (stage === 'auth' && error.code === 'auth/invalid-argument')) {
        return res.status(401).json({ error:'Sesi telah tamat. Login semula.' });
      }
      const code = /^[a-z0-9_/-]{1,100}$/i.test(String(error.code || '')) ? String(error.code) : 'unknown';
      console.error('Admin sessions error:', stage, code);
      const hint = ['app/invalid-credential','auth/invalid-credential'].includes(code)
        ? 'Credential Firebase Admin tidak sah. Semak JSON asal dan status key service account.'
        : code === 'auth/insufficient-permission' || code === 'PERMISSION_DENIED'
          ? 'Service account tidak mempunyai akses yang diperlukan pada Firebase.'
          : 'Pengurusan sesi gagal.';
      return res.status(500).json({ code, stage, error:hint + ' (' + stage + ': ' + code + ')' });
    }
  };
}

export default createSessionsHandler();
