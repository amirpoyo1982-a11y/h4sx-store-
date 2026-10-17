import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSubmission,stageSubmission,decideSubmission,approveDue,WAIT_MS,ADMIN_UID,editReviewFeedback,publicPayload} from '../lib/review-moderation.js';

test('approved role is granted by moderation and can be disabled globally',()=>{
 const review={nama:'Pelanggan',bintang:5,ulasan:'Baik'};
 assert.equal(publicPayload(review,{},1000).approvedRoleGranted,true);
 assert.equal(publicPayload(review,{approvedRole:{enabled:false}},1000).approvedRoleGranted,undefined);
});
test('legacy CDG prefix is removed from submitted text without losing suggestion metadata',()=>{
 const result=validateSubmission({...input,review:{...input.review,ulasan:'cdg - Urusan smooth dari mula sampai siap.'}});
 assert.equal(result.review.ulasan,'Urusan smooth dari mula sampai siap.');
 assert.equal(result.review.cadanganDigunakan,true);
 assert.equal(validateSubmission({...input,review:{...input.review,ulasan:'Servis baik',cadanganDigunakan:true}}).review.ulasan,'Servis baik');
});
import {createSubmitHandler} from '../api/review-submit.js';
import {createAutoApproveHandler} from '../api/review-auto-approve.js';
import {createModerationHandler} from '../api/review-moderation.js';
function database(initial={}){
  const values=new Map(Object.entries(initial));const snap=path=>({exists:values.has(path),id:path.split('/').at(-1),data:()=>values.get(path)});const ref=path=>({path,get:async()=>snap(path),set:async value=>values.set(path,value)});
  const firestore={doc:ref,runTransaction:async fn=>{const writes=[];const result=await fn({get:async r=>{assert.equal(writes.length,0,'all reads before writes');return snap(r.path)},set:(r,v)=>writes.push(()=>values.set(r.path,v)),delete:r=>writes.push(()=>values.delete(r.path)),update:(r,v)=>writes.push(()=>values.set(r.path,{...values.get(r.path),...v}))});writes.forEach(fn=>fn());return result;},collection:prefix=>({where:(field,op,value)=>({limit:limit=>({get:async()=>{const docs=[...values.keys()].filter(path=>path.startsWith(prefix+'/')).filter(path=>{const v=values.get(path)?.[field];return op==='=='?v===value:op==='in'?value.includes(v):typeof v==='number'&&v<=value;}).slice(0,limit).map(snap);return {docs,size:docs.length};}})})})};return {firestore,values};
}
const input={code:'H4SX-TEST1',review:{nama:'Ali',bintang:5,ulasan:'Servis baik'}};
const reply=()=>({setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
test('new submissions stay private, consume the code, and use server time',async()=>{
  const d=database({'review_codes/H4SX-TEST1':{}});const result=await stageSubmission(d.firestore,{...input,review:{...input.review,moderationStatus:'published',diciptaPada:0}},false,1000);assert.equal(result.status,'pending');assert.equal(result.autoApproveAt,1000+WAIT_MS);assert(!d.values.has('ratings/review_H4SX-TEST1'));assert(!d.values.has('review_codes/H4SX-TEST1'));assert.equal(d.values.get('review_pending/review_H4SX-TEST1').review.diciptaPada.getTime(),1000);await assert.rejects(stageSubmission(d.firestore,input),/Kod pengesahan/);
});
test('30-minute boundary does not publish early and approval is idempotent',async()=>{
  const d=database({'review_codes/H4SX-TEST1':{}});await stageSubmission(d.firestore,input,false,1000);assert.equal((await approveDue(d.firestore,1000+WAIT_MS-1)).approved,0);assert.equal((await approveDue(d.firestore,1000+WAIT_MS)).approved,1);assert(d.values.has('ratings/review_H4SX-TEST1'));assert.equal((await approveDue(d.firestore,1000+WAIT_MS+1)).approved,0);assert.equal(d.values.get('ratings/review_H4SX-TEST1').diciptaPada.getTime(),1000);
});
test('rejection cancels auto approval, including a stale cron selection',async()=>{
  const d=database({'review_codes/H4SX-TEST1':{}});await stageSubmission(d.firestore,input,false,1000);await decideSubmission(d.firestore,'review_H4SX-TEST1','reject',2000);assert.equal(await decideSubmission(d.firestore,'review_H4SX-TEST1','approve',1000+WAIT_MS,true),'skip');assert(!d.values.has('ratings/review_H4SX-TEST1'));assert(!('autoApproveAt' in d.values.get('review_pending/review_H4SX-TEST1')));assert.equal(await decideSubmission(d.firestore,'review_H4SX-TEST1','approve',3000,false),'published');
});
test('manual rejection after automatic publication hides the published review',async()=>{
  const d=database({'review_codes/H4SX-TEST1':{}});await stageSubmission(d.firestore,input,false,1000);await approveDue(d.firestore,1000+WAIT_MS);await decideSubmission(d.firestore,'review_H4SX-TEST1','reject',1001+WAIT_MS);assert.equal(d.values.get('ratings/review_H4SX-TEST1').moderationStatus,'rejected');
});
test('moderation OFF publishes new submissions immediately; global auto reply OFF is preserved',async()=>{
  const d=database({'review_codes/H4SX-TEST1':{},'config/review_moderation':{enabled:false},'config/review_admin':{autoReply:false}});const result=await stageSubmission(d.firestore,input,false,1000);assert.equal(result.status,'published');assert(!d.values.get('ratings/review_H4SX-TEST1').balasanAdmin);
});
test('approval reads current reply settings, and old public records remain untouched',async()=>{
  const d=database({'review_codes/H4SX-TEST1':{},'ratings/legacy':{nama:'Lama',bintang:4}});await stageSubmission(d.firestore,input,false,1000);d.values.set('config/review_admin',{autoReply:false});await approveDue(d.firestore,1000+WAIT_MS);assert(!d.values.get('ratings/review_H4SX-TEST1').balasanAdmin);assert.deepEqual(d.values.get('ratings/legacy'),{nama:'Lama',bintang:4});
});
test('invalid inputs and forged admin markers cannot become verified reviews',()=>{
  assert.throws(()=>validateSubmission({...input,review:{...input.review,bintang:999}}),/tidak sah/);assert.throws(()=>validateSubmission({...input,review:{...input.review,feedbackImg:'https://evil.example'}}),/Gambar/);const data=validateSubmission({...input,official:true,review:{...input.review,adminAuthorUid:ADMIN_UID,badgeText:'OWNER'}});assert.equal(data.review.adminAuthorUid,undefined);assert.equal(data.review.badgeText,undefined);
});
test('cron requires the configured secret before touching Firebase',async()=>{
  const previous=process.env.REVIEW_CRON_SECRET;const handler=createAutoApproveHandler(()=>assert.fail('must not access database'));try{delete process.env.REVIEW_CRON_SECRET;let res=reply();await handler({method:'GET',headers:{}},res);assert.equal(res.code,503);process.env.REVIEW_CRON_SECRET='x'.repeat(40);res=reply();await handler({method:'GET',headers:{authorization:'Bearer wrong'}},res);assert.equal(res.code,401);}finally{if(previous===undefined)delete process.env.REVIEW_CRON_SECRET;else process.env.REVIEW_CRON_SECRET=previous;}
});
test('admin-only queue cannot be listed by anonymous or other Firebase users',async()=>{
  const handler=createModerationHandler(async()=>({auth:{verifyIdToken:async()=>({uid:'someone-else'})}}));let res=reply();await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz'},body:{action:'list'}},res);assert.equal(res.code,401);res=reply();await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz',authorization:'Bearer TOKEN'},body:{action:'list'}},res);assert.equal(res.code,403);
});

test('admin can save 90-minute edit policy independently of the moderation switch and list it',async()=>{
 const d=database({'config/review_moderation':{enabled:true,editMinutes:10}}),ref=d.firestore.doc;
 d.firestore.doc=path=>({...ref(path),set:async(value,options)=>d.values.set(path,options?.merge?{...d.values.get(path),...value}:value)});
 const handler=createModerationHandler(async()=>({firestore:d.firestore,auth:{verifyIdToken:async()=>({uid:ADMIN_UID})}}));
 const send=async body=>{const res=reply();await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz',authorization:'Bearer TOKEN'},body},res);return res;};
 assert.equal((await send({action:'configure',editMinutes:90})).code,200);
 assert.deepEqual(d.values.get('config/review_moderation'),{enabled:true,editMinutes:90});
 assert.equal((await send({action:'list'})).data.editMinutes,90);
 await send({action:'configure',enabled:false});assert.equal(d.values.get('config/review_moderation').editMinutes,90);
 assert.equal((await send({action:'list'})).data.enabled,false);
});

test('only authenticated admin can reactivate a published review using a per-code duration',async()=>{
 const id='review_H4SX-TEST1',review={nama:'Ali',bintang:5,ulasan:'Lama',moderationStatus:'published'},d=database({
  ['ratings/'+id]:review,
  ['review_pending/'+id]:{status:'published',submittedAt:1000,customerEditLocked:true,review}
 });
 const handler=createModerationHandler(async()=>({firestore:d.firestore,auth:{verifyIdToken:async()=>({uid:ADMIN_UID})}}));
  const before=Date.now(),res=reply();await handler({...request,body:{action:'reactivateEdit',id,minutes:45}},res);
  assert.equal(res.code,200);assert(res.data.expiresAt>=before+45*60000&&res.data.expiresAt<=Date.now()+45*60000);
 assert.equal(res.data.minutes,45);assert.equal(d.values.get('review_pending/'+id).customerEditLocked,false);
 assert.equal(d.values.get('review_pending/'+id).customerEditReactivationMinutes,45);assert.deepEqual(d.values.get('ratings/'+id),review);
});

test('invalid edit policy is rejected atomically; missing config returns the ten-minute default',async()=>{
 let writes=0;const d=database(),ref=d.firestore.doc;d.firestore.doc=path=>({...ref(path),set:async()=>writes++});
 const handler=createModerationHandler(async()=>({firestore:d.firestore,auth:{verifyIdToken:async()=>({uid:ADMIN_UID})}}));
 const send=async body=>{const res=reply();await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz',authorization:'Bearer TOKEN'},body},res);return res;};
 for(const editMinutes of [0,-1,1.5,10081,'90','',null,true,{},[]])assert.equal((await send({action:'configure',enabled:false,editMinutes})).code,400);
 assert.equal((await send({action:'configure',enabled:'true'})).code,400);assert.equal((await send({action:'configure'})).code,400);assert.equal(writes,0);
 assert.equal((await send({action:'list'})).data.editMinutes,10);
});

test('editing policy, approval and edit reactivation remain protected by origin and Firebase admin identity',async()=>{
 for(const action of ['configure','approve','reactivateEdit'])for(const mode of ['anonymous','customer','bad-origin','revoked-token']){
  const handler=createModerationHandler(async()=>({auth:{verifyIdToken:async()=>{if(mode==='revoked-token')throw Error('Revoked');return {uid:mode==='customer'?'not-admin':ADMIN_UID};}},firestore:{doc:()=>assert.fail('must not access documents')}}));
  const res=reply();await handler({method:'POST',headers:{origin:mode==='bad-origin'?'https://evil.example':'https://www.h4sxmy.xyz',...(mode==='anonymous'?{}:{authorization:'Bearer TOKEN'})},body:{action,id:'review_H4SX-TEST1',editMinutes:90}},res);
  assert([400,401,403].includes(res.code));
 }
});
test('public submission fails closed if captcha fails',async()=>{
  const handler=createSubmitHandler(()=>assert.fail('must not touch Firebase'),async(req,res)=>res.status(403).json({success:false,error:'captcha failed'}));const res=reply();await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz'},body:{submission:input,token:'bad'}},res);assert.equal(res.code,403);
});

test('Store loads its captcha SDK before posting the review to the protected backend',async()=>{
  const vm=await import('node:vm');const {readFileSync}=await import('node:fs');let callbacks,requested,loaded=false;const root={document:{getElementById:()=>({before(){},removeAttribute(){}}),createElement:()=>({removeAttribute(){}}),querySelector:()=>null},loadPromoTurnstile:async()=>{loaded=true;root.turnstile={render:(box,options)=>{callbacks=options;queueMicrotask(()=>options.callback('CAPTCHA_TOKEN'));return 0;},reset(){},execute(){callbacks.callback('CAPTCHA_TOKEN');}}}};
  const ctx={window:root,document:root.document,Date,setTimeout,clearTimeout,queueMicrotask,AbortController,fetch:async(url,options)=>{requested={url,options};return {ok:true,json:async()=>({success:true,status:'pending'})};}};vm.runInNewContext(readFileSync(new URL('../review-submit-client.js',import.meta.url),'utf8'),ctx);const result=await root.H4ReviewSubmit.submit(input);assert(loaded);assert.equal(result.status,'pending');assert.equal(requested.url,'/api/review-submit');assert.equal(JSON.parse(requested.options.body).token,'CAPTCHA_TOKEN');
});

test('trash stops scheduled and stale approvals; restoring pending starts a new 30 minutes',async()=>{
 const d=database({'review_codes/H4SX-TEST1':{}});await stageSubmission(d.firestore,input,false,1000);await decideSubmission(d.firestore,'review_H4SX-TEST1','trash',2000);
 assert.equal(await decideSubmission(d.firestore,'review_H4SX-TEST1','approve',WAIT_MS+1000,true),'skip');assert.equal((await approveDue(d.firestore,WAIT_MS+1000)).approved,0);assert(!d.values.has('ratings/review_H4SX-TEST1'));
 await assert.rejects(decideSubmission(d.firestore,'review_H4SX-TEST1','approve',3000),/Pulihkan/);
 await decideSubmission(d.firestore,'review_H4SX-TEST1','restore',WAIT_MS+2000);assert.equal(d.values.get('review_pending/review_H4SX-TEST1').autoApproveAt,2*WAIT_MS+2000);assert.equal((await approveDue(d.firestore,2*WAIT_MS+1999)).approved,0);assert.equal((await approveDue(d.firestore,2*WAIT_MS+2000)).approved,1);
});
test('trash after a cron race hides public record, restores it, and permanent deletion removes both copies',async()=>{
 const d=database({'review_codes/H4SX-TEST1':{}});await stageSubmission(d.firestore,input,false,1000);await approveDue(d.firestore,WAIT_MS+1000);await decideSubmission(d.firestore,'review_H4SX-TEST1','trash',WAIT_MS+2000);assert.equal(d.values.get('ratings/review_H4SX-TEST1').moderationStatus,'trash');await decideSubmission(d.firestore,'review_H4SX-TEST1','restore',WAIT_MS+3000);assert.equal(d.values.get('ratings/review_H4SX-TEST1').moderationStatus,'published');await decideSubmission(d.firestore,'review_H4SX-TEST1','delete');assert(!d.values.has('ratings/review_H4SX-TEST1'));assert(!d.values.has('review_pending/review_H4SX-TEST1'));
});
test('legacy hidden review restores to hidden without losing its content',async()=>{
 const d=database({'ratings/legacy':{nama:'Lama',moderationStatus:'hidden',ulasan:'Original'}});await decideSubmission(d.firestore,'legacy','trash');await decideSubmission(d.firestore,'legacy','trash');await decideSubmission(d.firestore,'legacy','restore');assert.equal(d.values.get('ratings/legacy').moderationStatus,'hidden');assert.equal(d.values.get('ratings/legacy').ulasan,'Original');
});

test('profile zoom survives private moderation and public approval; invalid scales are rejected',async()=>{
  const submission={code:'H4SX-ZOOM1',review:{nama:'Ali',bintang:5,ulasan:'Baik',profileImg:'data:image/png;base64,AAAA',profileZoom:175}};
  const d=database({'review_codes/H4SX-ZOOM1':{}});
  await stageSubmission(d.firestore,submission,false,1000);
  assert.equal(d.values.get('review_pending/review_H4SX-ZOOM1').review.profileZoom,175);
  await decideSubmission(d.firestore,'review_H4SX-ZOOM1','approve',2000);
  assert.equal(d.values.get('ratings/review_H4SX-ZOOM1').profileZoom,175);
  for(const zoom of [49,301,'NaN','scale(99)'])assert.throws(()=>validateSubmission({...submission,review:{...submission.review,profileZoom:zoom}}),/Zoom/);
});

test('vertical profile position is validated and preserved during approval',async()=>{
 const input={code:'H4SX-OFFSET',review:{nama:'Ali',bintang:5,ulasan:'Baik',profileOffsetY:-25,profileZoom:140}};
 const d=database({'review_codes/H4SX-OFFSET':{}});await stageSubmission(d.firestore,input,false,1000);await decideSubmission(d.firestore,'review_H4SX-OFFSET','approve',2000);
 assert.equal(d.values.get('ratings/review_H4SX-OFFSET').profileOffsetY,-25);
 for(const value of [-51,51,'invalid'])assert.throws(()=>validateSubmission({...input,review:{...input.review,profileOffsetY:value}}),/Posisi/);
});


test('admin feedback edits replace/remove media while preserving customer profile, role, rating and original time',async()=>{
 const id='legacy_review_123',original={nama:'Ali',bintang:4,ulasan:'Ok',badgeText:'VIP',warnaProfil:'#123456',diciptaPada:new Date(100),moderationStatus:'published',feedbackImg:'data:image/png;base64,AAAA',feedbackVideo:'https://example.com/old.mp4',autoReplyDisabled:true};
 const d=database({['ratings/'+id]:original});await editReviewFeedback(d.firestore,id,{feedbackImg:'',feedbackVideo:'https://example.com/new.webm'},5000);const updated=d.values.get('ratings/'+id);
 for(const key of ['nama','bintang','ulasan','badgeText','warnaProfil','diciptaPada','moderationStatus'])assert.deepEqual(updated[key],original[key]);assert(!Object.hasOwn(updated,'feedbackImg'));assert.equal(updated.feedbackVideo,'https://example.com/new.webm');assert(!updated.balasanAdmin);
 await editReviewFeedback(d.firestore,id,{feedbackImg:'data:image/jpeg;base64,BBBB',feedbackVideo:null},6000);assert.equal(d.values.get('ratings/'+id).feedbackImg,'data:image/jpeg;base64,BBBB');assert(!Object.hasOwn(d.values.get('ratings/'+id),'feedbackVideo'));
});
test('admin can edit pending feedback before approval without extending or bypassing moderation',async()=>{
 const d=database({['review_codes/'+input.code]:{}});await stageSubmission(d.firestore,input,false,1000);const id='review_'+input.code,deadline=d.values.get('review_pending/'+id).autoApproveAt;
 await editReviewFeedback(d.firestore,id,{ulasan:'',feedbackImg:'data:image/png;base64,AAAA',feedbackVideo:'https://example.com/a.mp4'},2000);
 const queued=d.values.get('review_pending/'+id);assert.equal(queued.status,'pending');assert.equal(queued.autoApproveAt,deadline);assert.equal(queued.submittedAt,1000);assert(!d.values.has('ratings/'+id));assert.equal(queued.review.ulasan,'Tiada ulasan ditinggalkan.');
 await decideSubmission(d.firestore,id,'approve',deadline);assert.equal(d.values.get('ratings/'+id).feedbackVideo,'https://example.com/a.mp4');
});
test('feedback edit follows a concurrent approval and preserves hidden/rejected status',async()=>{
 const d=database({['review_codes/'+input.code]:{}});await stageSubmission(d.firestore,input,false,1000);const id='review_'+input.code;await decideSubmission(d.firestore,id,'approve',2000);
 await editReviewFeedback(d.firestore,id,{feedbackVideo:'https://example.com/a.mp4'},2100);assert.equal(d.values.get('ratings/'+id).feedbackVideo,'https://example.com/a.mp4');assert.equal(d.values.get('review_pending/'+id).review,undefined);
 d.values.get('ratings/'+id).moderationStatus='hidden';await editReviewFeedback(d.firestore,id,{feedbackVideo:''},2200);assert.equal(d.values.get('ratings/'+id).moderationStatus,'hidden');
 d.values.get('ratings/'+id).moderationStatus='trash';await assert.rejects(editReviewFeedback(d.firestore,id,{feedbackVideo:''},2300),/Pulihkan/);
});
test('feedback edit rejects forged role/profile fields and unsafe media without touching the record',async()=>{
 const id='review_SAFE',original={nama:'Ali',bintang:5,ulasan:'Baik',moderationStatus:'published'},d=database({['ratings/'+id]:original});
 for(const patch of [{adminAuthorUid:ADMIN_UID},{bintang:999},{feedbackVideo:'javascript:alert(1)'},{feedbackImg:'data:image/svg+xml;base64,AAAA'},{feedbackImg:false},{ulasan:'a'.repeat(501)}])await assert.rejects(editReviewFeedback(d.firestore,id,patch));assert.deepEqual(d.values.get('ratings/'+id),original);
 await assert.rejects(editReviewFeedback(d.firestore,'../other',{ulasan:'Baik'}),/ID/);
});
test('admin feedback endpoint rejects anonymous/non-admin access and accepts the verified admin only',async()=>{
 const id='review_SAFE',d=database({['ratings/'+id]:{nama:'Ali',bintang:5,ulasan:'Baik',moderationStatus:'published'}});let reads=0;const getServices=uid=>async()=>{reads++;return {firestore:d.firestore,auth:{verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);return {uid};}}};};
 let res=reply();const base={method:'POST',headers:{origin:'https://www.h4sxmy.xyz'},body:{action:'editFeedback',id,patch:{feedbackVideo:'https://example.com/a.mp4'}}};await createModerationHandler(getServices(ADMIN_UID))(base,res);assert.equal(res.code,401);assert.equal(reads,0);
 res=reply();await createModerationHandler(getServices('other'))({...base,headers:{...base.headers,authorization:'Bearer test'}},res);assert.equal(res.code,403);assert.equal(d.values.get('ratings/'+id).feedbackVideo,undefined);
 res=reply();await createModerationHandler(getServices(ADMIN_UID))({...base,headers:{...base.headers,authorization:'Bearer test'}},res);assert.equal(res.code,200);assert.equal(d.values.get('ratings/'+id).feedbackVideo,'https://example.com/a.mp4');
});

test('admin custom role stays private with the pending review and survives manual or automatic approval',async()=>{
 for(const automatic of [false,true]){
  const d=database({['review_codes/'+input.code]:{}});await stageSubmission(d.firestore,input,false,1000);
  const id='review_'+input.code,deadline=1000+WAIT_MS;
  await editReviewFeedback(d.firestore,id,{ulasan:'Servis baik, dikemaskini',approvedRoleText:'  Diluluskan & diedit  '},2000);
  const pending=d.values.get('review_pending/'+id);
  assert.equal(pending.status,'pending');assert.equal(pending.autoApproveAt,deadline);assert.equal(pending.submittedAt,1000);
  assert.equal(pending.review.approvedRoleText,'Diluluskan & diedit');assert(!d.values.has('ratings/'+id));
  await decideSubmission(d.firestore,id,'approve',deadline,automatic);
  const published=d.values.get('ratings/'+id);
  assert.equal(published.approvedRoleText,'Diluluskan & diedit');assert.equal(published.approvedRoleGranted,true);
  assert.equal(published.ulasan,'Servis baik, dikemaskini');assert.equal(published.diciptaPada.getTime(),1000);
 }
});
test('role-only edits preserve hidden status, global settings, timestamps, replies and other review roles',async()=>{
 const id='review_ROLE',original={nama:'Ali',bintang:5,ulasan:'Baik',diciptaPada:new Date(100),moderationStatus:'hidden',approvedRoleGranted:true,approvedRoleRemoved:true,badgeText:'VIP',balasanAdmin:'Terima kasih'};
 const config={approvedRole:{enabled:false,text:'GLOBAL'}},d=database({['ratings/'+id]:original,'config/review_admin':config});
 await editReviewFeedback(d.firestore,id,{approvedRoleText:'Disemak admin'},2000);
 assert.deepEqual(d.values.get('ratings/'+id),{...original,approvedRoleText:'Disemak admin'});
 assert.deepEqual(d.values.get('config/review_admin'),config);
 await editReviewFeedback(d.firestore,id,{approvedRoleText:'  '},3000);assert.equal(d.values.get('ratings/'+id).approvedRoleText,'');
});
test('role edits validate type and length without allowing grants, moderation or identity forgery',async()=>{
 const id='review_ROLE',original={nama:'Ali',ulasan:'Baik',moderationStatus:'published'},d=database({['ratings/'+id]:original});
 for(const patch of [{approvedRoleText:25},{approvedRoleText:null},{approvedRoleText:{}},{approvedRoleText:'x'.repeat(25)},{approvedRoleText:'Ok',approvedRoleGranted:true},{approvedRoleRemoved:false},{moderationStatus:'published'},{adminIdentityConfirmed:true}])await assert.rejects(editReviewFeedback(d.firestore,id,patch));
 assert.deepEqual(d.values.get('ratings/'+id),original);
 await editReviewFeedback(d.firestore,id,{approvedRoleText:'x'.repeat(24)},2000);assert.equal(d.values.get('ratings/'+id).approvedRoleText.length,24);
 const submitted=validateSubmission({...input,review:{...input.review,approvedRoleText:'OWNER',approvedRoleGranted:true}}).review;
 assert.equal(submitted.approvedRoleText,undefined);assert.equal(submitted.approvedRoleGranted,undefined);
});
test('role update endpoint rejects anonymous, customer, revoked tokens and untrusted origins',async()=>{
 const id='review_ROLE';
 for(const scenario of ['anonymous','customer','revoked','origin','admin']){
  const d=database({['review_pending/'+id]:{status:'pending',submittedAt:1000,autoApproveAt:2000,review:{nama:'Ali',ulasan:'Baik'}}});let reads=0;
  const services=async()=>{reads++;return {firestore:d.firestore,auth:{verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);if(scenario==='revoked')throw Object.assign(Error('revoked'),{code:'auth/id-token-revoked'});return {uid:scenario==='customer'?'other':ADMIN_UID};}}};};
  const res=reply(),headers={origin:scenario==='origin'?'https://evil.example':'https://www.h4sxmy.xyz'};if(scenario!=='anonymous')headers.authorization='Bearer test';
  await createModerationHandler(services)({method:'POST',headers,body:{action:'editFeedback',id,patch:{approvedRoleText:'Diluluskan & diedit'}}},res);
  assert.equal(res.code,scenario==='admin'?200:scenario==='anonymous'?401:scenario==='revoked'?400:403);
  assert.equal(d.values.get('review_pending/'+id).review.approvedRoleText,scenario==='admin'?'Diluluskan & diedit':undefined);
  if(['anonymous','origin'].includes(scenario))assert.equal(reads,0);
 }
});
