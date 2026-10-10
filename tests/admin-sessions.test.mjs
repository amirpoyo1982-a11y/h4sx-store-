import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { createSessionsHandler, describeDevice } from '../api/admin-sessions.js';

const UID = 'LWRN6IDv4OV1PZd7Vldgp6F9pdH3';
const DEVICE = '12345678-1234-1234-1234-123456789abc';
function response() {
  return { headers:{}, setHeader(k,v) { this.headers[k] = v; }, status(code) { this.code=code; return this; }, json(data) { this.data=data; return this; }, end() { return this; } };
}
function fixture(overrides = {}) {
  const calls=[];
  const devices={};
  const auth = {
    async verifyIdToken(token, revoked) { calls.push(['verify',token,revoked]); return { uid:UID, auth_time:100 }; },
    async revokeRefreshTokens(uid) { calls.push(['revoke',uid]); },
    async getUser(uid) { calls.push(['user',uid]); return { tokensValidAfterTime:new Date(200000).toISOString() }; }, ...overrides
  };
  const reference = path => ({
    child(child) { return reference(path + '/' + child); },
    async set(value) { calls.push(['set',path,value]); },
    async transaction(fn) { devices[path.split('/').at(-1)] = fn(null); calls.push(['transaction',path]); },
    orderByChild() { return this; }, limitToLast() { return this; }, async once() { return { val:() => devices }; }
  });
  return { calls, devices, handler:createSessionsHandler(async () => ({ auth, database:{ref:reference}, firestore:{doc:path=>({ async set(value) { calls.push(['firestore',path,value]); } })} })) };
}
async function call(handler, action='register', options={}) {
  const res=response();
  await handler({ method:options.method || 'POST', headers:{origin:'https://review.h4sxmy.xyz',authorization:'Bearer TEST_TOKEN','user-agent':'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0',...options.headers},body:{action,deviceId:DEVICE,...options.body} },res);
  return res;
}
test('reject missing auth and untrusted origins without accessing Firebase', async () => {
  const f=fixture();
  assert.equal((await call(f.handler,'list',{headers:{authorization:''}})).code,401);
  assert.equal((await call(f.handler,'list',{headers:{origin:'https://untrusted.example'}})).code,403);
  assert.equal(f.calls.length,0);
});
test('reject authenticated non-admin and revoked tokens', async () => {
  const nonAdmin=fixture({verifyIdToken:async()=>({uid:'other-user'})});
  assert.equal((await call(nonAdmin.handler,'revoke-all')).code,403);
  assert(!nonAdmin.calls.some(call=>call[0]==='revoke'));
  const revoked=fixture({verifyIdToken:async()=>{throw Object.assign(new Error('revoked'),{code:'auth/id-token-revoked'});}});
  assert.equal((await call(revoked.handler,'register')).code,401);
});
test('register under authenticated UID only, never a client-supplied UID', async () => {
  const f=fixture();const res=await call(f.handler,'register',{body:{uid:'victim'}});
  assert.equal(res.code,200);
  assert(f.calls.some(call=>call[0]==='verify'&&call[2]===true));
  assert(f.calls.some(call=>call[0]==='transaction'&&call[1].startsWith('admin_sessions_private/'+UID+'/devices/')));
  assert(!JSON.stringify(f.devices).includes('TEST_TOKEN'));
  assert.equal(Object.values(f.devices)[0].site,'review');
});
test('listing marks revoked history and current website/browser session', async () => {
  const f=fixture();const registered=await call(f.handler);
  const listed=await call(f.handler,'list');
  assert.equal(listed.code,200);
  assert.equal(listed.data.devices[0].id,registered.data.sessionId);
  assert.equal(listed.data.devices[0].current,true);
  assert.equal(listed.data.devices[0].revoked,true);
});
test('revoke all affects verified admin account and publishes timestamp only', async () => {
  const f=fixture();const res=await call(f.handler,'revoke-all',{body:{uid:'victim'}});
  assert.equal(res.code,200);assert.equal(res.data.realtimeLogout,true);
  assert(f.calls.some(call=>call[0]==='revoke'&&call[1]===UID));
  assert.deepEqual(f.calls.find(call=>call[0]==='firestore').slice(1),['config/admin_session_security',{revokedAt:200000}]);
});
test('missing backend credential gives an explicit setup response', async () => {
  const handler=createSessionsHandler(async()=>{throw Object.assign(new Error('missing'),{code:'sessions/setup-required'});});
  const res=await call(handler);assert.equal(res.code,503);assert.equal(res.data.code,'setup-required');
});
test('device description avoids inventing a model when browser reports Android K', () => {
  assert.equal(describeDevice('Mozilla/5.0 (Linux; Android 10; K) Chrome/140.0').device,'Telefon Android');
  assert.equal(describeDevice('Mozilla/5.0 (iPhone) AppleWebKit Safari/604.1').device,'iPhone');
});

function clientFixture(configured = true) {
  let callback, logoutCount=0, intervalCount=0;
  const context={ window:{}, crypto:webcrypto, localStorage:{getItem(){return DEVICE;},setItem(){}}, document:{hidden:false,addEventListener(){}},
    fetch:async()=>({status:configured?200:503,ok:configured,json:async()=>configured?{success:true}:{code:'setup-required',error:'Setup required'}}),
    AbortSignal, setInterval(){ intervalCount++; return intervalCount; }, clearInterval(){}, alert(){}, confirm(){return false;} };
  vm.runInNewContext(readFileSync(new URL('../admin-sessions.js',import.meta.url),'utf8'),context);
  const user={uid:UID,getIdToken:async()=>'FAKE',getIdTokenResult:async()=>({authTime:new Date(100000).toISOString()})};
  context.window.H4SXAdminSessions.bind({user,signOut:async()=>{logoutCount++;},watchRevocations(cb){callback=cb;return()=>{};}});
  return {context,get callback(){return callback;},get logoutCount(){return logoutCount;},get intervalCount(){return intervalCount;}};
}
test('client detects remote logout and ignores obsolete listeners after logout', async () => {
  const f=clientFixture();await new Promise(resolve=>setImmediate(resolve));
  f.callback(90000);assert.equal(f.logoutCount,0);
  f.callback(200000);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.logoutCount,1);
  f.context.window.H4SXAdminSessions.bind({user:null});
  f.callback(300000);assert.equal(f.logoutCount,1);
});
test('unconfigured backend does not start repeated session polling', async () => {
  const f=clientFixture(false);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.intervalCount,0);
});
