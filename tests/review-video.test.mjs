import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackVideoUrl,videoPlayback} from '../lib/review-video.js';
import {stageSubmission,decideSubmission,validateSubmission} from '../lib/review-moderation.js';
import {customerEdit,editGrantId} from '../lib/review-edit.js';
import {createVideoHandler} from '../api/review-video.js';
const code='H4SX-VIDEO1',id='review_'+code,url='https://example.com/video.mp4?version=1',token='a'.repeat(64),review={nama:'Ali',bintang:5,ulasan:'Baik',feedbackVideo:url};
function database(initial={}){const values=new Map(Object.entries(initial)),snap=path=>({exists:values.has(path),data:()=>values.get(path)});const firestore={doc:path=>({path,get:async()=>snap(path)}),runTransaction:async fn=>{const writes=[];const result=await fn({get:async ref=>{assert.equal(writes.length,0);return snap(ref.path)},set:(ref,value)=>writes.push(()=>values.set(ref.path,value)),delete:ref=>writes.push(()=>values.delete(ref.path)),update:(ref,value)=>writes.push(()=>values.set(ref.path,{...values.get(ref.path),...value}))});writes.forEach(fn=>fn());return result;}};return {firestore,values};}
test('direct video links allow HTTPS MP4/WebM and reject arbitrary pages, credentials, scripts and old upload IDs',()=>{
 assert.equal(feedbackVideoUrl(url),url);assert.equal(feedbackVideoUrl('https://example.com/CLIP.WEBM'),'https://example.com/CLIP.WEBM');
 for(const bad of ['javascript:alert(1)','http://example.com/a.mp4','data:video/mp4;base64,AAAA','https://user:pass@example.com/a.mp4','https://youtube.com/watch?v=1','a'.repeat(64)]){assert.equal(feedbackVideoUrl(bad),'');assert.throws(()=>validateSubmission({code,review:{...review,feedbackVideo:bad}}),/Video/);}
});
test('video links follow moderation and can coexist with an uploaded feedback image',async()=>{
 const d=database({['review_codes/'+code]:{}});await stageSubmission(d.firestore,{code,review:{...review,feedbackImg:'data:image/png;base64,AAAA'}},false,1000);
 assert.equal(d.values.get('review_pending/'+id).review.feedbackVideo,url);await assert.rejects(videoPlayback(d.firestore,id,false),/tidak tersedia/);assert.equal((await videoPlayback(d.firestore,id,true)).url,url);
 await decideSubmission(d.firestore,id,'approve',1100);assert.equal((await videoPlayback(d.firestore,id,false)).url,url);
 for(const status of ['hidden','rejected','trash']){d.values.get('ratings/'+id).moderationStatus=status;await assert.rejects(videoPlayback(d.firestore,id,false),/tidak tersedia/);}
});
test('customers can replace and remove video links during their existing edit window',async()=>{
 const d=database({['review_codes/'+code]:{}});await stageSubmission(d.firestore,{code,review},false,1000,{grantId:editGrantId(token,code)});
 await customerEdit(d.firestore,token,{action:'save',code,review:{nama:'Ali',bintang:5,ulasan:'Baik',feedbackVideo:'https://example.com/new.webm'}},1100);assert.equal(d.values.get('review_pending/'+id).review.feedbackVideo,'https://example.com/new.webm');
 await customerEdit(d.firestore,token,{action:'save',code,review:{nama:'Ali',bintang:5,ulasan:'Baik',feedbackVideo:''}},1200);assert.equal(d.values.get('review_pending/'+id).review.feedbackVideo,undefined);
});
test('link mode works without Storage configuration and rejects the obsolete upload endpoint',async()=>{
 let calls=0;const handler=createVideoHandler(async()=>{calls++;throw Error('No cloud access expected');}),response=()=>({setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}});
 let res=response();await handler({method:'GET',query:{action:'status'}},res);assert.deepEqual(res.data,{mode:'link',linksEnabled:true,uploadEnabled:false});res=response();await handler({method:'POST'},res);assert.equal(res.code,405);assert.equal(calls,0);
});
