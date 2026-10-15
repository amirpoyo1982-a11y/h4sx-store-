import test from 'node:test';
import assert from 'node:assert/strict';
import {officialReviewIdentity,reviewNameIssue,OFFICIAL_REVIEW_ADMIN_UID} from '../review/review-identity.js';
import {validateSubmission,stageSubmission} from '../lib/review-moderation.js';
import {createSubmitHandler} from '../api/review-submit.js';
const code='H4SX-OWN1';
function database(initial={}){const values=new Map(Object.entries(initial)),snap=path=>({exists:values.has(path),data:()=>values.get(path)});const firestore={doc:path=>({path}),runTransaction:async fn=>{const writes=[];const result=await fn({get:async ref=>{assert.equal(writes.length,0);return snap(ref.path)},set:(ref,value)=>writes.push(()=>values.set(ref.path,value)),delete:ref=>writes.push(()=>values.delete(ref.path))});writes.forEach(fn=>fn());return result;}};return {firestore,values};}
const review={nama:'Ali',bintang:5,ulasan:'Baik'};
test('H4SX names, codes and client-provided flags alone never establish official admin identity',()=>{
 for(const data of [{nama:'H4SX STORE'},{nama:'H4SX-CODE1'},{nama:'H4SX STORE',adminAuthorUid:OFFICIAL_REVIEW_ADMIN_UID},{adminAuthorUid:'other',adminIdentityConfirmed:true}])assert.equal(officialReviewIdentity(data),false);
 assert.equal(officialReviewIdentity({adminAuthorUid:OFFICIAL_REVIEW_ADMIN_UID,adminIdentityConfirmed:true}),true);
 const forged=validateSubmission({code,official:true,review:{...review,adminAuthorUid:OFFICIAL_REVIEW_ADMIN_UID,adminIdentityConfirmed:true}},false).review;assert.equal(officialReviewIdentity(forged),false);
 assert(reviewNameIssue('H4SX STORE',code,false));assert.equal(reviewNameIssue('H4SX STORE',code,true),'');assert(reviewNameIssue(code.toLowerCase(),code,true));
});
test('current, other unused and previously used purchase codes cannot be customer names',async()=>{
 assert.throws(()=>validateSubmission({code,review:{...review,nama:code}}),/kod review/);
 for(const collection of ['review_codes','ratings','review_pending']){
  const other='CUSTOM-123456',path=collection+'/'+(collection==='review_codes'?other:'review_'+other),d=database({['review_codes/'+code]:{},[path]:{}});
  await assert.rejects(stageSubmission(d.firestore,{code,review:{...review,nama:other}},false,1000),/kod review/);assert(d.values.has('review_codes/'+code));assert(!d.values.has('review_pending/review_'+code));
 }
});
test('only a verified Firebase admin token permits official H4SX submission',async()=>{
 for(const uid of ['other-user',OFFICIAL_REVIEW_ADMIN_UID]){
  const d=database({['review_codes/'+code]:{}}),handler=createSubmitHandler(async()=>({firestore:d.firestore,auth:{verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);return {uid};}}}),async(req,res)=>res.status(200).json({success:true}));
  const response={setHeader(){},status(v){this.code=v;return this},json(v){this.data=v;return this}};
  await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz',authorization:'Bearer verified'},body:{token:'captcha',submission:{code,official:true,review:{...review,nama:'H4SX STORE'}}}},response);
  if(uid===OFFICIAL_REVIEW_ADMIN_UID){assert.equal(response.code,200);assert(officialReviewIdentity(d.values.get('review_pending/review_'+code).review));}else{assert.equal(response.code,400);assert(d.values.has('review_codes/'+code));}
 }
});
