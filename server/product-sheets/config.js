import { SyncError } from './catalog.js';

export function readConfig(env = process.env) {
  let credentials;
  try { credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON || ''); }
  catch { throw new SyncError('SYNC_NOT_CONFIGURED'); }
  if (!credentials.project_id || !credentials.client_email || !credentials.private_key) throw new SyncError('SYNC_NOT_CONFIGURED');
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  const spreadsheetId = env.PRODUCT_SHEET_ID || '';
  if (!/^[A-Za-z0-9_-]{20,}$/.test(spreadsheetId)) throw new SyncError('SYNC_NOT_CONFIGURED');
  const databaseUrl = env.FIREBASE_DATABASE_URL || 'https://h4sx-6712c-default-rtdb.asia-southeast1.firebasedatabase.app';
  const url = new URL(databaseUrl);
  if (url.protocol !== 'https:' || !/(\.firebaseio\.com|\.firebasedatabase\.app)$/.test(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new SyncError('INVALID_DATABASE_URL');
  return { credentials, spreadsheetId, tabName: env.PRODUCT_SHEET_TAB || 'H4SX STORE PRODUCTS',
    databaseUrl: url.origin, adminUids: env.PRODUCT_SYNC_ADMIN_UIDS || '', cronSecret: env.CRON_SECRET || '' };
}
