import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {customerEdit,EDIT_MS,editGrantId,editSession} from '../lib/review-edit.js';
import {stageSubmission,decideSubmission,editMinutes,MAX_EDIT_MINUTES,WAIT_MS} from '../lib/review-moderation.js';
import {createEditHandler} from '../api/review-edit.js';
import {createSubmitHandler} from '../api/review-submit.js';
const token='a'.repeat(64),code='H4SX-EDIT1',id='review_'+code;
const review={nama:'Ali',bintang:5,ulasan:'Servis pantas'};
function database(initial={}){const values=new Map(Object.entries(initial)),snap=path=>({exists:values.has(path),data:()=>values.get(path)});const firestore={doc:path=>({path}),runTransaction:async fn=>{const writes=[];const result=await fn({get:async ref=>{assert.equal(writes.length,0);return snap(ref.path)},set:(ref,v)=>writes.push(()=>values.set(ref.path,v)),delete:ref=>writes.push(()=>values.delete(ref.path)),update:(ref,v)=>writes.push(()=>values.set(ref.path,{...values.get(ref.path),...v}))});writes.forEach(f=>f());return result;}};return {firestore,values};}
async function staged(config={}){const d=database({['review_codes/'+code]:{},'config/review_moderation':config});await stageSubmission(d.firestore,{code,review},false,1000,{grantId:editGrantId(token,code)});return d;}
test('new submissions create a private default 10-minute grant; browser and code must both match',async()=>{const d=await staged();const result=await customerEdit(d.firestore,token,{action:'load',code},1001);assert.equal(result.expiresAt,1000+EDIT_MS);await assert.rejects(customerEdit(d.firestore,'b'.repeat(64),{action:'load',code},1001),/browser/);await assert.rejects(customerEdit(d.firestore,token,{action:'load',code:'H4SX-OTHER'},1001),/browser/);await assert.rejects(customerEdit(d.firestore,token,{action:'load',code},1000+EDIT_MS),/tamat/);});
test('repeated saves preserve first submission deadline and enter private moderation',async()=>{const d=await staged();for(const now of [2000,3000,1000+EDIT_MS-1]){const result=await customerEdit(d.firestore,token,{action:'save',code,review:{...review,ulasan:'Ulasan dikemaskini'}},now);assert.equal(result.expiresAt,1000+EDIT_MS);}assert.equal(d.values.get('review_pending/'+id).submittedAt,1000);assert(!d.values.has('ratings/'+id));await assert.rejects(customerEdit(d.firestore,token,{action:'save',code,review},1000+EDIT_MS),/tamat/);});
test('immediately published edits preserve admin decoration privately and reveal no admin fields',async()=>{const d=await staged({enabled:false});Object.assign(d.values.get('ratings/'+id),{badgeText:'VIP',customCheckEnabled:true,pinned:true,autoReplyDisabled:true});const loaded=await customerEdit(d.firestore,token,{action:'load',code},1200);assert(!Object.hasOwn(loaded.review,'badgeText'));assert(!Object.hasOwn(loaded.review,'pinned'));await customerEdit(d.firestore,token,{action:'save',code,review:{...review,bintang:4}},1300);assert(!d.values.has('ratings/'+id));assert.equal(d.values.get('review_pending/'+id).review.badgeText,'VIP');await decideSubmission(d.firestore,id,'approve',1400);assert.equal(d.values.get('ratings/'+id).bintang,4);assert.equal(d.values.get('ratings/'+id).badgeText,'VIP');assert.equal(d.values.get('ratings/'+id).autoReplyDisabled,true);});
test('forged admin fields and moderation-hidden reviews cannot be changed by customers',async()=>{const d=await staged();await assert.rejects(customerEdit(d.firestore,token,{action:'save',code,review:{...review,badgeText:'OWNER',moderationStatus:'published'}},2000),/medan/);await decideSubmission(d.firestore,id,'reject',2100);await assert.rejects(customerEdit(d.firestore,token,{action:'save',code,review},2200),/dikawal admin/);});
test('image removal is explicit and unchanged admin-supplied profile image is preserved',async()=>{const d=await staged();d.values.get('review_pending/'+id).review.profileImg='https://example.com/avatar.gif';await customerEdit(d.firestore,token,{action:'save',code,review},2000);assert.equal(d.values.get('review_pending/'+id).review.profileImg,'https://example.com/avatar.gif');await customerEdit(d.firestore,token,{action:'save',code,review:{...review,profileImg:''}},2100);assert(!Object.hasOwn(d.values.get('review_pending/'+id).review,'profileImg'));});
test('API denies missing browser proof and failed captcha before editing',async()=>{const d=await staged();let used=0;const handler=createEditHandler(async()=>{used++;return {firestore:d.firestore}},async(req,res)=>res.status(403).json({success:false,error:'captcha failed'}));const response=()=>({setHeader(){},status(v){this.code=v;return this},json(v){this.body=v;return this}});const req={method:'POST',headers:{origin:'https://www.h4sxmy.xyz'},body:{action:'save',code,review}};let res=response();await handler(req,res);assert.equal(res.code,403);assert.equal(used,0);res=response();await handler({...req,headers:{...req.headers,cookie:'h4sx_review_edit='+token}},res);assert.equal(res.code,403);assert.equal(used,0);assert.equal(editSession({headers:{cookie:'h4sx_review_edit=invalid'}}),null);});
test('customer editor contains no admin control fields and both websites expose the entry',()=>{const source=readFileSync(new URL('../review-edit-client.js',import.meta.url),'utf8');for(const field of ['badgeText','customCheckEnabled','reportDisabled','moderationStatus','autoReplyDisabled','featured'])assert(!source.includes(field));for(const filename of ['index.htm','review/index.htm'])assert(readFileSync(new URL('../'+filename,import.meta.url),'utf8').includes('data-customer-review-edit'));});
test('submission sets private browser proof only after a successful commit',async()=>{const d=database({['review_codes/'+code]:{}});const headers={};const handler=createSubmitHandler(async()=>({firestore:d.firestore}),async(req,res)=>res.status(200).json({success:true}));const response={setHeader(k,v){headers[k]=v},status(v){this.code=v;return this},json(v){this.data=v;return this}};await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz'},body:{submission:{code,review},token:'test'}},response);assert.equal(response.code,200);assert.match(headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict; Path=\/api; Max-Age=604800/);const browserToken=headers['Set-Cookie'].split(';')[0].split('=')[1];assert(d.values.has('review_edit_grants/'+editGrantId(browserToken,code)));assert(!JSON.stringify(response.data).includes(browserToken));});

test('customer edits cannot set admin role text and preserve it through later moderation',async()=>{
 const d=await staged();d.values.get('review_pending/'+id).review.approvedRoleText='Disemak admin';
 const loaded=await customerEdit(d.firestore,token,{action:'load',code},1200);assert(!Object.hasOwn(loaded.review,'approvedRoleText'));
 await assert.rejects(customerEdit(d.firestore,token,{action:'save',code,review:{...review,approvedRoleText:'OWNER'}},1300),/medan/);
 await customerEdit(d.firestore,token,{action:'save',code,review:{...review,ulasan:'Edit pelanggan'}},1400);
 await decideSubmission(d.firestore,id,'approve',1500);assert.equal(d.values.get('ratings/'+id).approvedRoleText,'Disemak admin');
});

test('customer zoom edits keep the original expiry and preserve admin decoration',async()=>{
  const d=await staged();const entry=d.values.get('review_pending/'+id);entry.review.profileZoom=150;entry.review.badgeText='VIP';
  const loaded=await customerEdit(d.firestore,token,{action:'load',code},1100);assert.equal(loaded.review.profileZoom,150);assert(!Object.hasOwn(loaded.review,'badgeText'));
  const saved=await customerEdit(d.firestore,token,{action:'save',code,review:{...review,profileZoom:75}},2000);
  assert.equal(saved.expiresAt,1000+EDIT_MS);assert.equal(d.values.get('review_pending/'+id).review.profileZoom,75);assert.equal(d.values.get('review_pending/'+id).review.badgeText,'VIP');
  await assert.rejects(customerEdit(d.firestore,token,{action:'save',code,review:{...review,profileZoom:999}},2100),/Zoom/);
});

test('customer can reposition the image without changing its original edit deadline',async()=>{
 const d=await staged();const result=await customerEdit(d.firestore,token,{action:'save',code,review:{...review,profileOffsetY:20}},2000);
 assert.equal(result.expiresAt,1000+EDIT_MS);assert.equal(d.values.get('review_pending/'+id).review.profileOffsetY,20);
 const loaded=await customerEdit(d.firestore,token,{action:'load',code},2100);assert.equal(loaded.review.profileOffsetY,20);
});

test('custom 90-minute expiry is fixed at submission and survives config changes and saves',async()=>{
 const d=await staged({editMinutes:90}),expiry=1000+90*60000;
 d.values.set('config/review_moderation',{editMinutes:1});
 for(const now of [1001,1000+60*60000,expiry-1]){
  assert.equal((await customerEdit(d.firestore,token,{action:'load',code},now)).expiresAt,expiry);
  assert.equal((await customerEdit(d.firestore,token,{action:'save',code,review},now)).expiresAt,expiry);
 }
 await assert.rejects(customerEdit(d.firestore,token,{action:'load',code},expiry),/tamat/);
 await assert.rejects(customerEdit(d.firestore,token,{action:'save',code,review},expiry),/tamat/);
});

test('submission advertises the configured duration and retains browser proof for long grants',async()=>{
 const d=database({['review_codes/'+code]:{},'config/review_moderation':{editMinutes:90}}),headers={};
 const handler=createSubmitHandler(async()=>({firestore:d.firestore}),async(req,res)=>res.status(200).json({success:true}));
 const res={setHeader(k,v){headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};
 await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz',cookie:'h4sx_review_edit='+token},body:{submission:{code,review:{...review,editMinutes:1}},token:'test'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.editMinutes,90);assert.equal(res.body.editExpiresAt,d.values.get('review_edit_grants/'+editGrantId(token,code)).submittedAt+90*60000);
 assert.match(headers['Set-Cookie'],new RegExp('^h4sx_review_edit='+token+';.*Max-Age=604800$'));
});

test('missing or invalid stored durations safely fall back to ten minutes',async()=>{
 for(const value of [undefined,null,0,-1,1.5,'90',NaN,Infinity,MAX_EDIT_MINUTES+1]){
  assert.equal(editMinutes(value),10);
  const d=await staged({editMinutes:value});assert.equal((await customerEdit(d.firestore,token,{action:'load',code},1001)).expiresAt,1000+EDIT_MS);
 }
 for(const value of [1,90,MAX_EDIT_MINUTES])assert.equal(editMinutes(value),value);
});

test('manual approval revokes load and save for every grant even with 90 minutes remaining',async()=>{
 const d=await staged({editMinutes:90}),otherToken='b'.repeat(64);
 d.values.set('review_edit_grants/'+editGrantId(otherToken,code),{reviewId:id,submittedAt:1000,expiresAt:1000+90*60000});
 await decideSubmission(d.firestore,id,'approve',1100);
 assert.equal(d.values.get('review_pending/'+id).customerEditLocked,true);
 assert.equal(d.values.get('review_pending/'+id).customerEditLockedAt,1100);
 for(const browser of [token,otherToken])for(const action of ['load','save'])await assert.rejects(customerEdit(d.firestore,browser,{action,code,review},1200),{status:409,code:'review/edit-locked'});
 await decideSubmission(d.firestore,id,'approve',1300);
 assert.equal(d.values.get('review_pending/'+id).customerEditLockedAt,1100);
 assert.equal(d.values.get('ratings/'+id).ulasan,review.ulasan);
});

test('trash, restore and rejection cannot reopen an admin-approved edit code',async()=>{
 const d=await staged();await decideSubmission(d.firestore,id,'approve',1100);
 for(const action of ['trash','restore','reject','approve']){
  await decideSubmission(d.firestore,id,action,1200);
  await assert.rejects(customerEdit(d.firestore,token,{action:'save',code,review},1300),{code:'review/edit-locked'});
 }
});

test('auto approval respects a longer edit window until an admin explicitly approves',async()=>{
 const d=await staged({editMinutes:90});await decideSubmission(d.firestore,id,'approve',1000+WAIT_MS,true);
 assert.equal((await customerEdit(d.firestore,token,{action:'load',code},1001+WAIT_MS)).expiresAt,1000+90*60000);
 await decideSubmission(d.firestore,id,'approve',1002+WAIT_MS);
 await assert.rejects(customerEdit(d.firestore,token,{action:'save',code,review},1003+WAIT_MS),{code:'review/edit-locked'});
});

test('approval also locks immediately published and legacy grants without a pending record',async()=>{
 const d=await staged({enabled:false,editMinutes:90});assert(!d.values.has('review_pending/'+id));
 Object.assign(d.values.get('ratings/'+id),{moderationStatus:'hidden',autoHiddenByReports:true,reportCount:3,reportGeneration:2,reportAutoHideTestEnabled:true});
 await decideSubmission(d.firestore,id,'approve',1100);
 const rating=d.values.get('ratings/'+id);assert.equal(rating.moderationStatus,'published');assert.equal(rating.reportGeneration,3);assert.equal(rating.reportCount,0);assert.equal(rating.autoHiddenByReports,false);assert.equal(rating.reportAutoHideTestEnabled,false);
 await assert.rejects(customerEdit(d.firestore,token,{action:'load',code},1200),{code:'review/edit-locked'});
});

function transactionalDatabase(initial={}){
 const values=new Map(Object.entries(initial)),versions=new Map();let nextHold=null,conflicts=0;
 const firestore={doc:path=>({path}),runTransaction:async fn=>{
  for(let attempt=0;attempt<5;attempt++){
   const reads=new Map(),writes=[],hold=nextHold;nextHold=null;
   const result=await fn({get:async ref=>{assert.equal(writes.length,0);reads.set(ref.path,versions.get(ref.path)||0);const value=structuredClone(values.get(ref.path));return {exists:value!==undefined,data:()=>value};},set:(ref,value)=>writes.push([ref.path,structuredClone(value)]),delete:ref=>writes.push([ref.path,undefined]),update:(ref,value)=>writes.push([ref.path,{...values.get(ref.path),...structuredClone(value)}])});
   if(hold){hold.ready();await hold.wait;}
   if([...reads].some(([path,version])=>(versions.get(path)||0)!==version)){conflicts++;continue;}
   for(const [path,value] of writes){if(value===undefined)values.delete(path);else values.set(path,value);versions.set(path,(versions.get(path)||0)+1);}
   return result;
  }
  throw Error('Transaction retry limit');
 }};
 return {firestore,values,get conflicts(){return conflicts;},holdNext(){let ready,release;const waiting=new Promise(resolve=>ready=resolve),wait=new Promise(resolve=>release=resolve);nextHold={ready,wait};return {ready:waiting,release};}};
}

test('a concurrent customer save retries after approval and cannot overwrite the lock',async()=>{
 const d=transactionalDatabase({['review_codes/'+code]:{}});await stageSubmission(d.firestore,{code,review},false,1000,{grantId:editGrantId(token,code)});
 const hold=d.holdNext(),editing=customerEdit(d.firestore,token,{action:'save',code,review:{...review,ulasan:'Tidak boleh simpan'}},1200);
 const rejected=assert.rejects(editing,{code:'review/edit-locked'});
 await hold.ready;await decideSubmission(d.firestore,id,'approve',1200);hold.release();await rejected;
 assert.equal(d.conflicts,1);assert.equal(d.values.get('ratings/'+id).ulasan,review.ulasan);assert.equal(d.values.get('review_pending/'+id).customerEditLocked,true);
});

test('approval retries after a concurrent save, publishes the latest text and locks future edits',async()=>{
 const d=transactionalDatabase({['review_codes/'+code]:{}});await stageSubmission(d.firestore,{code,review},false,1000,{grantId:editGrantId(token,code)});
 const hold=d.holdNext(),approval=decideSubmission(d.firestore,id,'approve',1200);
 await hold.ready;await customerEdit(d.firestore,token,{action:'save',code,review:{...review,ulasan:'Edit sebelum lulus'}},1200);hold.release();await approval;
 assert.equal(d.conflicts,1);assert.equal(d.values.get('ratings/'+id).ulasan,'Edit sebelum lulus');
 await assert.rejects(customerEdit(d.firestore,token,{action:'save',code,review},1300),{code:'review/edit-locked'});
});

test('edit API returns a safe lock reason after approval for both load and save',async()=>{
 const d=database({['review_codes/'+code]:{}}),now=Date.now();await stageSubmission(d.firestore,{code,review},false,now,{grantId:editGrantId(token,code)});await decideSubmission(d.firestore,id,'approve',now);
 const handler=createEditHandler(async()=>({firestore:d.firestore}),async(req,res)=>res.status(200).json({success:true}));
 for(const action of ['load','save']){
  const res={setHeader(){},status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};
  await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz',cookie:'h4sx_review_edit='+token},body:{action,code,review}},res);
  assert.equal(res.statusCode,409);assert.equal(res.body.code,'review/edit-locked');assert.match(res.body.error,/dibatalkan/);
 }
});
