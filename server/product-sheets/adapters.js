import { GoogleAuth } from 'google-auth-library';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'node:crypto';
import { buildSheetRequests, SyncError } from './catalog.js';
import { readConfig } from './config.js';
import { createStateStore } from './state-store.js';

let cached;
export function services() {
  if (cached) return cached;
  const config = readConfig();
  const auth = new GoogleAuth({ credentials: config.credentials, scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/firebase.database',
    'https://www.googleapis.com/auth/userinfo.email'
  ] });
  const app = getApps().find(item => item.name === 'product-sheets') || initializeApp({
    credential: cert({ projectId: config.credentials.project_id, clientEmail: config.credentials.client_email, privateKey: config.credentials.private_key }),
    projectId: config.credentials.project_id
  }, 'product-sheets');
  const stateKey = createHash('sha256').update(config.spreadsheetId + '\n' + config.tabName).digest('hex').slice(0, 24);
  const stateUrl = `${config.databaseUrl}/_productSheetSync/${stateKey}.json`;

  async function request(options, deadline = Date.now() + 10000) {
    const remaining = deadline - Date.now();
    if (remaining < 250) throw new SyncError('SYNC_DEADLINE');
    const client = await auth.getClient();
    return client.request({ timeout: Math.min(8000, remaining), retry: false, ...options });
  }
  const store = createStateStore(stateUrl, request);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}`;
  const range = encodeURIComponent(`'${config.tabName.replace(/'/g, "''")}'!A:H`);
  cached = {
    config, store,
    verifyToken: token => getAuth(app).verifyIdToken(token, true),
    readCatalog: async deadline => {
      const responses = await Promise.all(['inventory', 'games'].map(path => request({ url: `${config.databaseUrl}/store/${path}.json` }, deadline)));
      return { inventory: responses[0].data, games: responses[1].data };
    },
    sheets: {
      async read(deadline) {
        const metadata = (await request({ url: `${base}?fields=sheets.properties` }, deadline)).data;
        const properties = metadata.sheets?.find(sheet => sheet.properties?.title === config.tabName)?.properties;
        if (!properties || properties.sheetType !== 'GRID') throw new SyncError('SHEET_TAB_NOT_FOUND');
        const values = (await request({ url: `${base}/values/${range}?valueRenderOption=UNFORMATTED_VALUE` }, deadline)).data;
        return { properties, rows: values.values || [] };
      },
      async write(rows, properties, deadline) {
        const data = { requests: buildSheetRequests(rows, properties), includeSpreadsheetInResponse: false };
        if (Buffer.byteLength(JSON.stringify(data)) > 1800000) throw new SyncError('SHEET_PAYLOAD_TOO_LARGE');
        await request({ url: `${base}:batchUpdate`, method: 'POST', data }, deadline);
      }
    }
  };
  return cached;
}
