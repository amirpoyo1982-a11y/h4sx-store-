import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSubmission,stageSubmission,decideSubmission,approveDue,WAIT_MS,ADMIN_UID} from '../lib/review-moderation.js';
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
test('public submission fails closed if captcha fails',async()=>{
  const handler=createSubmitHandler(()=>assert.fail('must not touch Firebase'),async(req,res)=>res.status(403).json({success:false,error:'captcha failed'}));const res=reply();await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz'},body:{submission:input,token:'bad'}},res);assert.equal(res.code,403);
});

test('Store loads its captcha SDK before posting the review to the protected backend',async()=>{
  const vm=await import('node:vm');const {readFileSync}=await import('node:fs');let callbacks,requested,loaded=false;const root={document:{getElementById:()=>({before(){}}),createElement:()=>({}),querySelector:()=>null},loadPromoTurnstile:async()=>{loaded=true;root.turnstile={render:(box,options)=>{callbacks=options;return 0;},reset(){},execute(){callbacks.callback('CAPTCHA_TOKEN');}}}};
  const ctx={window:root,document:root.document,Date,setTimeout,clearTimeout,fetch:async(url,options)=>{requested={url,options};return {ok:true,json:async()=>({success:true,status:'pending'})};}};vm.runInNewContext(readFileSync(new URL('../review-submit-client.js',import.meta.url),'utf8'),ctx);const result=await root.H4ReviewSubmit.submit(input);assert(loaded);assert.equal(result.status,'pending');assert.equal(requested.url,'/api/review-submit');assert.equal(JSON.parse(requested.options.body).token,'CAPTCHA_TOKEN');
});
