import {randomBytes,createHash} from 'node:crypto';
export const MAX_VIDEO_BYTES=20*1024*1024;
export const VIDEO_TYPES={'video/mp4':'mp4','video/webm':'webm'};
export const videoGrant=(token,code)=>createHash('sha256').update(token+'|'+code).digest('hex');
export function videoError(message,status=400){return Object.assign(Error(message),{status});}
export function validateVideoFile(file){if(!VIDEO_TYPES[file?.type]||!Number.isInteger(file.size)||file.size<1||file.size>MAX_VIDEO_BYTES)throw videoError('Video mesti MP4 / WebM dan maksimum 20MB.');return file;}
export function validVideoSignature(bytes,type){return type==='video/mp4'?bytes.length>=12&&bytes.toString('ascii',4,8)==='ftyp':type==='video/webm'&&bytes.length>=4&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));}
export async function reserveVideo(firestore,bucket,code,grantId,file,now=Date.now()){
 validateVideoFile(file);if(!/^[A-Z0-9-]{4,40}$/.test(code)||!grantId)throw videoError('Masukkan kod pembelian yang sah.');
 const id=randomBytes(32).toString('hex'),ext=VIDEO_TYPES[file.type],path='review-video-staging/'+id+'.'+ext,finalPath='review-videos/'+id+'.'+ext;
 await firestore.runTransaction(async tx=>{
  const codeRef=firestore.doc('review_codes/'+code),limitRef=firestore.doc('review_video_limits/'+code),grantRef=firestore.doc('review_edit_grants/'+grantId);
  const [codeSnap,grantSnap,limitSnap]=await Promise.all([tx.get(codeRef),tx.get(grantRef),tx.get(limitRef)]);
  if(!codeSnap.exists&&!(grantSnap.exists&&grantSnap.data().reviewId==='review_'+code&&grantSnap.data().expiresAt>now))throw videoError('Kod tidak sah, telah digunakan atau tempoh edit tamat.',403);
  const previous=limitSnap.data()||{},fresh=now-(previous.startedAt||0)>=30*60*1000,count=fresh?0:previous.count||0;
  if(count>=3)throw videoError('Had 3 percubaan upload video untuk kod ini dalam 30 minit.',429);
  tx.set(limitRef,{startedAt:fresh?now:previous.startedAt??now,count:count+1});
  tx.set(firestore.doc('review_video_uploads/'+id),{code,grantId,path,finalPath,type:file.type,size:file.size,ready:false,createdAt:now,expiresAt:now+30*60*1000,cleanupAt:now+24*60*60*1000});
 });
 const [policy]=await bucket.file(path).generateSignedPostPolicyV4({expires:now+2*60*1000,conditions:[['content-length-range',1,file.size]],fields:{'Content-Type':file.type,'Cache-Control':'private, max-age=0, no-store',success_action_status:'204'}});
 return {id,url:policy.url,fields:policy.fields};
}
export async function finishVideo(firestore,bucket,id,grantId,now=Date.now()){
 if(!/^[a-f0-9]{64}$/.test(id||''))throw videoError('ID video tidak sah.');
 const ref=firestore.doc('review_video_uploads/'+id),snap=await ref.get(),entry=snap.data();
 if(!snap.exists||entry.grantId!==grantId||entry.expiresAt<=now)throw videoError('Video bukan milik browser ini atau upload tamat.',403);
 if(entry.ready)return {id};
 const [metadata]=await bucket.file(entry.path).getMetadata();
 if(Number(metadata.size)!==entry.size||metadata.contentType!==entry.type||Number(metadata.size)>MAX_VIDEO_BYTES)throw videoError('Saiz atau jenis video tidak sepadan.');
 const source=bucket.file(entry.path,{generation:metadata.generation}),[bytes]=await source.download({start:0,end:31,validation:false});
 if(!validVideoSignature(bytes,entry.type))throw videoError('Fail yang dipilih bukan video MP4 / WebM yang sah.');
 await source.copy(bucket.file(entry.finalPath),{preconditionOpts:{ifGenerationMatch:0}});
 await ref.set({...entry,ready:true,verifiedAt:now});
 await bucket.file(entry.path).delete({ignoreNotFound:true}).catch(()=>{});
 return {id};
}
export async function readVideoAttachment(tx,firestore,id,code,grantId,reviewId,now){
 if(!id)return null;const ref=firestore.doc('review_video_uploads/'+id),snap=await tx.get(ref),data=snap.data();
 if(!snap.exists||!data.ready||data.code!==code||data.grantId!==grantId||(data.reviewId&&data.reviewId!==reviewId)||(!data.reviewId&&data.expiresAt<=now))throw videoError('Video belum siap atau tidak dibenarkan untuk ulasan ini.');
 return {ref,data};
}
export async function videoPlayback(firestore,bucket,id,isAdmin=false,now=Date.now()){
 if(!/^review_[A-Z0-9-]{4,40}$/.test(id||''))throw videoError('ID ulasan tidak sah.');
 const rating=await firestore.doc('ratings/'+id).get(),publicData=rating.data(),published=rating.exists&&(!publicData.moderationStatus||publicData.moderationStatus==='published')&&publicData.hidden!==true;
 let review=published?publicData:null;if(isAdmin&&!review){const pending=await firestore.doc('review_pending/'+id).get();review=pending.data()?.review||publicData;}
 if(!review?.feedbackVideo)throw videoError('Video tidak tersedia.',404);
 const upload=await firestore.doc('review_video_uploads/'+review.feedbackVideo).get(),data=upload.data();
 if(!upload.exists||!data.ready||data.reviewId!==id)throw videoError('Video tidak tersedia.',404);
 const [url]=await bucket.file(data.finalPath).getSignedUrl({version:'v4',action:'read',expires:now+5*60*1000});return {url};
}
export async function cleanupReviewVideos(firestore,bucket,now=Date.now()){
 const stale=await firestore.collection('review_video_uploads').where('cleanupAt','<=',now).limit(20).get();let deleted=0;
 for(const snap of stale.docs){const data=snap.data();let keep=false;
  if(data.reviewId){const [rating,pending]=await Promise.all([firestore.doc('ratings/'+data.reviewId).get(),firestore.doc('review_pending/'+data.reviewId).get()]);keep=rating.data()?.feedbackVideo===snap.id||pending.data()?.review?.feedbackVideo===snap.id;}
  if(keep){await bucket.file(data.path).delete({ignoreNotFound:true});await firestore.doc('review_video_uploads/'+snap.id).set({...data,cleanupAt:now+24*60*60*1000});continue;}
  await Promise.all([bucket.file(data.path).delete({ignoreNotFound:true}),bucket.file(data.finalPath).delete({ignoreNotFound:true})]);await firestore.doc('review_video_uploads/'+snap.id).delete();deleted++;
 }return deleted;
}
