import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.htm', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../catalog-control.js', import.meta.url), 'utf8');
const adminHtml = readFileSync(new URL('../catalog-control.htm', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const adminStyles = readFileSync(new URL('../catalog-control.css', import.meta.url), 'utf8');

function extractFunction(name) {
  const declaration = app.match(new RegExp(`(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`, 'm'));
  assert.ok(declaration, `Expected ${name} to be declared in app.js`);
  return declaration[0];
}

test('manual history requires either a valid phone or a username', () => {
  const context = {};
  vm.runInNewContext([
    extractFunction('normaliseOrderPhone'),
    extractFunction('validateManualOrderIdentity')
  ].join('\n'), context);

  assert.deepEqual(JSON.parse(JSON.stringify(context.validateManualOrderIdentity('', '  Haziq123  '))), {phone:'', username:'Haziq123'});
  assert.deepEqual(JSON.parse(JSON.stringify(context.validateManualOrderIdentity('0123456789', ''))), {phone:'0123456789', username:''});
  assert.throws(() => context.validateManualOrderIdentity(' ', ' '), /username atau nombor WhatsApp/);
  assert.throws(() => context.validateManualOrderIdentity('1234', 'Haziq123'), /9 hingga 15 digit/);
  assert.throws(() => context.validateManualOrderIdentity('', 'x'.repeat(51)), /50 aksara/);
  assert.match(app, /validateManualOrderIdentity\(document\.getElementById\('manual-order-phone'\)\.value, document\.getElementById\('manual-order-username'\)\.value\)/);
});

test('username lookups are case-insensitive, hashed, and wired into history lookup', async () => {
  const context = {crypto:webcrypto, TextEncoder};
  vm.runInNewContext([
    extractFunction('normaliseOrderUsername'),
    extractFunction('usernameLookupId')
  ].join('\n'), context);

  assert.equal(await context.usernameLookupId('  Haziq123  '), await context.usernameLookupId('@haziq123'));
  assert.equal(await context.usernameLookupId('  '), '');
  assert.match(app, /updateUsernameLookup\(identity\.username, code, editingOriginalUsername\)/);
  assert.match(app, /usernameSearch \? await usernameLookupId\(search\) : await phoneLookupId\(search\)/);
  assert.match(app, /username:identity\.username/);
  assert.match(index, /id="manual-order-username"/);
  assert.match(index, /No\. WhatsApp \(salah satu wajib\)/);
  assert.doesNotMatch(index.match(/id="manual-order-phone"[^>]*>/)?.[0] || '', /\brequired\b/);
});

test('verification progress is available in manual and customer-order status flows', () => {
  assert.match(index, /<option value="Pesanan anda sedang disahkan">Pesanan anda sedang disahkan<\/option>/);
  assert.match(app, /const CUSTOMER_ORDER_STATUSES = \[[^\]]*'Pesanan anda sedang disahkan'/);
  assert.match(app, /const labels = \[[^\]]*'Pesanan anda sedang disahkan'/);
  assert.match(admin, /const CUSTOMER_ORDER_STATUS_LIST = \[[^\]]*'Pesanan anda sedang disahkan'/);
  assert.match(adminHtml, /<option>Pesanan anda sedang disahkan<\/option>/);
  assert.match(admin, /'Menunggu Pengesahan','Pesanan anda sedang disahkan'\]\.includes/);
  assert.match(styles, /status-pesanan-anda-sedang-disahkan/);
  assert.match(adminStyles, /status-pesanan-anda-sedang-disahkan/);
});
