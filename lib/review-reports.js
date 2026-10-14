import crypto from 'node:crypto';
export const REPORT_HOUR=60*60*1000,REPORT_DAY=24*REPORT_HOUR,REPORT_LIMIT=3,REPORT_HIDE_THRESHOLD=3;
function autoHideChanges(now){return {moderationStatus:'hidden',autoHiddenByReports:true,reportHiddenAt:new Date(now),moderatedAt:new Date(now)};}
export function reportError(message,status=400,retryAfter){return Object.assign(Error(message),{status,retryAfter});}
export function validateReport(body){
 const reviewId=String(body?.reviewId||'');if(!/^[A-Za-z0-9_-]{1,128}$/.test(reviewId))throw reportError('ID ulasan tidak sah.');
 const reason=String(body?.reason||'').normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim();
 if(reason.length<8||reason.length>300)throw reportError('Sebab laporan mestilah 8–300 aksara.');
 if(/https?:\/\/|www\.|wa\.me|t\.me|(?:\d[\s-]?){8,}|(.)\1{7,}/i.test(reason))throw reportError('Sebab laporan tidak boleh mengandungi link, nombor peribadi atau spam.');
 const deviceId=String(body?.deviceId||'');if(!/^[A-Za-z0-9_-]{8,100}$/.test(deviceId))throw reportError('ID browser tidak sah. Muat semula halaman.');return {reviewId,reason,deviceId};
}
export function reporterKeys(req,deviceId,uid=''){
 const secret=String(process.env.REPORT_HASH_SECRET||process.env.TURNSTILE_SECRET_KEY||'');if(secret.length<16)throw reportError('Backend laporan belum dikonfigurasi.',503);
 const ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'').split(',')[0].trim();if(!ip)throw reportError('Rangkaian pelawat tidak dapat disahkan.',400);
 const hash=value=>crypto.createHmac('sha256',secret).update(value).digest('hex');
 return {network:hash('network:'+ip),device:hash('device:'+deviceId),account:uid?hash('account:'+uid):null};
}
export async function submitReport(firestore,input,keys,isAdmin=false,now=Date.now()){
 const ratingRef=firestore.doc('ratings/'+input.reviewId),reportRef=firestore.doc('review_reports/r-'+crypto.randomUUID());
 return firestore.runTransaction(async tx=>{
  const ratingSnap=await tx.get(ratingRef);if(!ratingSnap.exists)throw reportError('Ulasan sudah tiada.',404);const rating=ratingSnap.data();
  if(!isAdmin&&rating.reportDisabled===true)throw reportError('Laporan untuk ulasan ini telah ditutup selepas semakan admin.',409);
  if(!isAdmin&&['hidden','rejected','pending','trash'].includes(rating.moderationStatus))throw reportError('Ulasan ini sedang disemak atau tidak dipaparkan.',409);
  const keyList=[keys.network,keys.device,keys.account].filter(Boolean),bucketRefs=keyList.map(k=>firestore.doc('review_report_limits/'+k)),pairRefs=keyList.map(k=>firestore.doc('review_report_limits/pair-'+k+'-'+input.reviewId));
  const statsRef=firestore.doc('review_report_stats/'+input.reviewId+'-'+(Number(rating.reportGeneration)||0));
  const buckets=isAdmin?[]:await Promise.all(bucketRefs.map(r=>tx.get(r))),pairs=isAdmin?[]:await Promise.all(pairRefs.map(r=>tx.get(r))),statsSnap=await tx.get(statsRef);
  const recentBuckets=buckets.map(s=>(s.data()?.times||[]).filter(t=>Number.isFinite(t)&&now-t<REPORT_HOUR));
  if(!isAdmin){
   for(const pair of pairs){const last=pair.data()?.lastAt;if(Number.isFinite(last)&&now-last<REPORT_DAY)throw reportError('Ulasan ini sudah anda laporkan dalam 24 jam.',429,Math.ceil((REPORT_DAY-now+last)/1000));}
   for(const times of recentBuckets){if(times.length>=REPORT_LIMIT)throw reportError('Had 3 laporan sejam telah dicapai.',429,Math.max(1,Math.ceil((times[0]+REPORT_HOUR-now)/1000)));const last=times.at(-1);if(Number.isFinite(last)&&now-last<60000)throw reportError('Tunggu 60 saat antara laporan.',429,Math.ceil((60000-now+last)/1000));}
  }
  const reporters=(statsSnap.data()?.reporters||[]).filter(r=>now-r.time<REPORT_DAY);if(!isAdmin&&!reporters.some(r=>r.key===keys.network))reporters.push({key:keys.network,time:now});
  const autoHideTest=isAdmin&&rating.reportAutoHideTestEnabled===true&&(rating.moderationStatus||'published')==='published';
  const testCount=autoHideTest?Math.min(REPORT_HIDE_THRESHOLD,(Number(rating.reportTestCount)||0)+1):0;
  const autoHidden=autoHideTest?testCount>=REPORT_HIDE_THRESHOLD:!isAdmin&&reporters.length>=REPORT_HIDE_THRESHOLD;
  tx.set(reportRef,{reviewId:input.reviewId,reviewName:String(rating.nama||'Ulasan').slice(0,80),reason:input.reason,status:'open',deviceId:keys.device,reporterKey:keys.network,adminTest:isAdmin,autoHideTest,createdAt:new Date(now)});
  if(!isAdmin){recentBuckets.forEach((times,i)=>tx.set(bucketRefs[i],{times:[...times,now]}));pairRefs.forEach(r=>tx.set(r,{lastAt:now}));tx.set(statsRef,{reporters,updatedAt:now});tx.update(ratingRef,{reportCount:reporters.length,...(autoHidden?{...autoHideChanges(now),reportAutoHideTest:false,reportAutoHideTestEnabled:false}:{})});}
  else if(autoHideTest)tx.update(ratingRef,{reportTestCount:testCount,...(autoHidden?{...autoHideChanges(now),reportAutoHideTest:true,reportAutoHideTestEnabled:false}:{})});
  return {success:true,autoHidden,adminTest:isAdmin,autoHideTest,testCount,testThreshold:REPORT_HIDE_THRESHOLD};
 });
}
export async function setReportControl(firestore,id,action,now=Date.now()){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||!['restoreReported','reportsEnable','reportsDisable','reportTestEnable','reportTestDisable'].includes(action))throw reportError('Tindakan laporan tidak sah.');
 const ref=firestore.doc('ratings/'+id);return firestore.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw reportError('Ulasan sudah tiada.',404);const rating=snap.data();if(['trash','pending','rejected'].includes(rating.moderationStatus))throw reportError('Pulihkan atau luluskan ulasan dahulu.');
  const changes={moderatedAt:new Date(now)};
  if(action==='restoreReported'){changes.moderationStatus='published';changes.autoHiddenByReports=false;changes.reportCount=0;changes.reportGeneration=(Number(rating.reportGeneration)||0)+1;changes.reportTestCount=0;changes.reportAutoHideTest=false;changes.reportAutoHideTestEnabled=false;}
  else if(action==='reportTestEnable'||action==='reportTestDisable'){
   if(action==='reportTestEnable'&&(rating.moderationStatus||'published')!=='published')throw reportError('Munculkan ulasan semula sebelum aktifkan ujian.');
   changes.reportAutoHideTestEnabled=action==='reportTestEnable';changes.reportTestCount=0;
  }
  else changes.reportDisabled=action==='reportsDisable';
  tx.update(ref,changes);return {success:true};
 });
}
