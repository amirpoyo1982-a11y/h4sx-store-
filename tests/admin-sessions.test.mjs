import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { createSessionsHandler, describeDevice } from '../api/admin-sessions.js';

const UID = 'LWRN6IDv4OV1PZd7Vldgp6F9pdH3';
const DEVICE = '12345678-1234-1234-1234-123456789abc';
function response() {
  return { headers:{}, setHeader(k,v) { this.headers[k] = v; }, status(code) { this.code=code; return this; }, json(data) { this.data=data; return this; }, end() { return this; } };
}
function fixture(overrides = {}) {
  const calls=[];
  const devices={};
  const store={admin_sessions_private:{[UID]:{devices,blockedSessions:{}}}};
  let cutoff=0;
  const get=path=>path.split('/').reduce((value,key)=>value?.[key],store);
  const put=(path,value)=>{const keys=path.split('/'),key=keys.pop();const parent=keys.reduce((value,key)=>value[key]??=( {} ),store);if(value===null)delete parent[key];else parent[key]=value;};
  const auth = {
    async verifyIdToken(token, revoked) { calls.push(['verify',token,revoked]); return { uid:UID, auth_time:100 }; },
    async revokeRefreshTokens(uid) { calls.push(['revoke',uid]); cutoff=200000; },
    async getUser(uid) { calls.push(['user',uid]); return { tokensValidAfterTime:new Date(cutoff).toISOString() }; }, ...overrides
  };
  const reference = path => ({
    child(child) { return reference(path + '/' + child); },
    async set(value) { put(path,value);calls.push(['set',path,value]); },
    async update(values) { for(const [key,value] of Object.entries(values))put(path+'/'+key,value);calls.push(['update',path]); },
    async remove() { put(path,null);calls.push(['remove',path]); },
    async transaction(fn) { const next=fn(get(path)||null);if(next===undefined)return{committed:false};put(path,next);calls.push(['transaction',path]);return{committed:true}; },
    orderByChild() { return this; }, limitToLast() { return this; }, async once() { return { val:() => get(path) || null }; }
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
  const f=fixture({getUser:async()=>({tokensValidAfterTime:new Date(200000).toISOString()})});const registered=await call(f.handler);
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
    fetch:async()=>({status:configured?200:503,ok:configured,json:async()=>configured?{success:true,sessionId:'current-session'}:{code:'setup-required',error:'Setup required'}}),
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

test('single logout blocks only the selected session and never revokes the whole Firebase account', async () => {
  const f=fixture();const current=await call(f.handler);
  const otherId='87654321-4321-4321-4321-cba987654321';
  const other=await call(f.handler,'register',{body:{deviceId:otherId}});
  const revoked=await call(f.handler,'revoke-one',{body:{sessionId:other.data.sessionId}});
  assert.equal(revoked.code,200);assert.equal(revoked.data.current,false);
  assert(!f.calls.some(call=>call[0]==='revoke'));
  assert.equal((await call(f.handler,'check')).code,200);
  assert.equal((await call(f.handler,'check',{body:{deviceId:otherId}})).code,401);
  const list=await call(f.handler,'list');assert.equal(list.data.devices.find(item=>item.id===other.data.sessionId).revoked,true);
  assert.equal(list.data.devices.find(item=>item.id===current.data.sessionId).revoked,false);
});
test('delete only terminated history, preserving block markers and other sessions', async () => {
  const f=fixture();const current=await call(f.handler);
  assert.equal((await call(f.handler,'delete-record',{body:{sessionId:current.data.sessionId}})).code,409);
  const otherId='87654321-4321-4321-4321-cba987654321';const other=await call(f.handler,'register',{body:{deviceId:otherId}});
  await call(f.handler,'revoke-one',{body:{sessionId:other.data.sessionId}});
  assert.equal((await call(f.handler,'delete-record',{body:{sessionId:other.data.sessionId}})).code,200);
  assert.equal(Object.keys(f.devices).length,1);
  assert.equal((await call(f.handler,'register',{body:{deviceId:otherId}})).code,401);
  assert.equal((await call(f.handler,'check')).code,200);
});
test('reject path injection and unknown target sessions', async () => {
  const f=fixture();assert.equal((await call(f.handler,'revoke-one',{body:{sessionId:'../other-user'}})).code,400);
  assert.equal((await call(f.handler,'delete-record',{body:{sessionId:'a'.repeat(64)}})).code,404);
});
test('client only logs out when its own session is targeted', async () => {
  const f=clientFixture();await new Promise(resolve=>setImmediate(resolve));
  f.callback({blockedSessions:{'other-session':123456}});assert.equal(f.logoutCount,0);
  f.callback({blockedSessions:{'current-session':123456}});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.logoutCount,1);
});
test('combined website preserves existing store session identity', async () => {
  const f=fixture();const result=await call(f.handler,'register',{headers:{origin:'https://www.h4sxmy.xyz'}});
  assert.equal(result.data.sessionId,createHash('sha256').update('store:'+DEVICE+':100').digest('hex'));
  assert.equal(Object.values(f.devices)[0].site,'combined');
});
