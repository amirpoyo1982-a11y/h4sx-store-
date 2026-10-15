import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveVideo,finishVideo,readVideoAttachment,videoPlayback,cleanupReviewVideos,validVideoSignature,MAX_VIDEO_BYTES,videoGrant} from '../lib/review-video.js';
import {stageSubmission,decideSubmission} from '../lib/review-moderation.js';
import {createVideoHandler} from '../api/review-video.js';
const code='H4SX-VIDEO1',grant=videoGrant('a'.repeat(64),code),reviewId='review_'+code;
function database(initial={}){const values=new Map(Object.entries(initial)),snap=path=>({exists:values.has(path),id:path.split('/').at(-1),data:()=>values.get(path)}),ref=path=>({path,get:async()=>snap(path),set:async value=>values.set(path,value),delete:async()=>values.delete(path)});const firestore={doc:ref,runTransaction:async fn=>{const writes=[];const value=await fn({get:async r=>{assert.equal(writes.length,0);return snap(r.path)},set:(r,v)=>writes.push(()=>values.set(r.path,v)),delete:r=>writes.push(()=>values.delete(r.path)),update:(r,v)=>writes.push(()=>values.set(r.path,{...values.get(r.path),...v}))});writes.forEach(f=>f());return value;},collection:prefix=>({where:(key,op,v)=>({limit:limit=>({get:async()=>({docs:[...values.keys()].filter(path=>path.startsWith(prefix+'/')&&values.get(path)[key]<=v).slice(0,limit).map(snap)})})})})};return {firestore,values};}
function storage(){const entries=new Map(),signed=[],policies=[];const bucket={file:(path,options)=>({async generateSignedPostPolicyV4(policy){policies.push({path,policy});return [{url:'https://storage.googleapis.com/private-test',fields:{key:path,...policy.fields}}];},async getMetadata(){const f=entries.get(path);if(!f)throw Error('not found');return [{size:f.bytes.length,contentType:f.type,generation:'1'}];},async download(){return [entries.get(path).bytes];},async copy(destination,config){assert.equal(config.preconditionOpts.ifGenerationMatch,0);entries.set(destination.path,{...entries.get(path)});},async delete(){entries.delete(path);},async getSignedUrl(){signed.push(path);return ['https://storage.googleapis.com/signed-video'];},path})};return {bucket,entries,signed,policies};}
const bytes=Buffer.from([0,0,0,24,102,116,121,112,109,112,52,50,0,0,0,0]);
async function upload(){const d=database({['review_codes/'+code]:{}}),s=storage();const init=await reserveVideo(d.firestore,s.bucket,code,grant,{type:'video/mp4',size:bytes.length},1000);const entry=d.values.get('review_video_uploads/'+init.id);s.entries.set(entry.path,{bytes,type:'video/mp4'});return {...d,...s,init,entry};}
test('valid code receives short-lived signed POST restricted by path, size and MIME; quota lasts across retries',async()=>{
 const d=await upload();const policy=d.policies[0].policy;assert(policy.expires<=121000);assert.deepEqual(policy.conditions,[['content-length-range',1,bytes.length]]);assert.equal(policy.fields['Content-Type'],'video/mp4');assert.equal(policy.fields.acl,undefined);
 for(let n=0;n<2;n++)await reserveVideo(d.firestore,d.bucket,code,grant,{type:'video/mp4',size:16},1100);
 await assert.rejects(reserveVideo(d.firestore,d.bucket,code,grant,{type:'video/mp4',size:16},1200),/Had 3/);
 await assert.rejects(reserveVideo(d.firestore,d.bucket,'H4SX-NOCODE',grant,{type:'video/mp4',size:16},1000),/Kod/);
 await assert.rejects(reserveVideo(d.firestore,d.bucket,code,grant,{type:'video/mp4',size:MAX_VIDEO_BYTES+1},1000),/20MB/);
});
test('finalize verifies owner and container signature then copies out of the signed upload path',async()=>{
 const d=await upload();await assert.rejects(finishVideo(d.firestore,d.bucket,d.init.id,'other',1100),/milik/);
 await finishVideo(d.firestore,d.bucket,d.init.id,grant,1100);const record=d.values.get('review_video_uploads/'+d.init.id);assert(record.ready);assert(d.entries.has(record.finalPath));assert(!d.entries.has(record.path));assert(validVideoSignature(bytes,'video/mp4'));assert(!validVideoSignature(Buffer.from('not a movie'),'video/mp4'));assert(validVideoSignature(Buffer.from([26,69,223,163]),'video/webm'));
});
test('spoofed video MIME or contents cannot be finalized',async()=>{
 const d=await upload();d.entries.set(d.entry.path,{bytes:Buffer.alloc(bytes.length),type:'video/mp4'});await assert.rejects(finishVideo(d.firestore,d.bucket,d.init.id,grant,1100),/bukan video/);assert.equal(d.values.get('review_video_uploads/'+d.init.id).ready,false);
});
test('video stays private until review approval; hidden and rejected reviews cannot create public playback URLs',async()=>{
 const d=await upload();await finishVideo(d.firestore,d.bucket,d.init.id,grant,1100);
 const submission={code,review:{nama:'Ali',bintang:5,ulasan:'Baik',feedbackVideo:d.init.id}};
 await assert.rejects(stageSubmission(d.firestore,submission,false,1200,{grantId:'other'}),/Video/);
 await stageSubmission(d.firestore,submission,false,1200,{grantId:grant});assert.equal(d.values.get('review_video_uploads/'+d.init.id).reviewId,reviewId);
 await assert.rejects(videoPlayback(d.firestore,d.bucket,reviewId,false,1300),/tidak tersedia/);assert.equal(d.signed.length,0);
 assert((await videoPlayback(d.firestore,d.bucket,reviewId,true,1300)).url);
 await decideSubmission(d.firestore,reviewId,'approve',1400);assert((await videoPlayback(d.firestore,d.bucket,reviewId,false,1500)).url);
 d.values.get('ratings/'+reviewId).moderationStatus='hidden';await assert.rejects(videoPlayback(d.firestore,d.bucket,reviewId,false,1600),/tidak tersedia/);
});
test('unverified upload identifiers cannot attach and cleanup removes abandoned objects only',async()=>{
 const d=await upload();await assert.rejects(d.firestore.runTransaction(tx=>readVideoAttachment(tx,d.firestore,d.init.id,code,grant,reviewId,1100)),/Video/);
 const count=await cleanupReviewVideos(d.firestore,d.bucket,1000+24*60*60*1000);assert.equal(count,1);assert.equal(d.entries.size,0);
});
test('cleanup preserves videos referenced by pending or published reviews, and reclaims replaced media',async()=>{
 const d=await upload();await finishVideo(d.firestore,d.bucket,d.init.id,grant,1100);await stageSubmission(d.firestore,{code,review:{nama:'Ali',bintang:5,ulasan:'Baik',feedbackVideo:d.init.id}},false,1200,{grantId:grant});
 assert.equal(await cleanupReviewVideos(d.firestore,d.bucket,1000+24*60*60*1000),0);assert(d.entries.has(d.entry.finalPath));
 d.values.delete('review_pending/'+reviewId);assert.equal(await cleanupReviewVideos(d.firestore,d.bucket,1000+2*24*60*60*1000),1);
});
test('video setup and captcha failures expose no signed policy or credential and do not access Storage',async()=>{
 const previous=process.env.REVIEW_VIDEO_BUCKET;delete process.env.REVIEW_VIDEO_BUCKET;let accessed=0;const services=async()=>{accessed++;throw Error('Must not access');},response=()=>({setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}});
 try{let res=response();await createVideoHandler(services)({method:'GET',query:{action:'status'}},res);assert.equal(res.data.configured,false);res=response();await createVideoHandler(services)({method:'POST',headers:{},body:{}},res);assert.equal(res.code,503);
 process.env.REVIEW_VIDEO_BUCKET='private-test';res=response();await createVideoHandler(services,async(req,res)=>res.status(403).json({success:false}))({method:'POST',headers:{origin:'https://www.h4sxmy.xyz'},body:{action:'init',code,file:{type:'video/mp4',size:16}}},res);assert.equal(res.code,403);assert.equal(accessed,0);
 }finally{if(previous===undefined)delete process.env.REVIEW_VIDEO_BUCKET;else process.env.REVIEW_VIDEO_BUCKET=previous;}
});
