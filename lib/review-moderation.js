import {reviewNameIssue} from '../review/review-identity.js';
import {feedbackVideoUrl} from './review-video.js';
export const ADMIN_UID='LWRN6IDv4OV1PZd7Vldgp6F9pdH3';
export const WAIT_MS=30*60*1000;
export const DEFAULT_EDIT_MINUTES=10,MAX_EDIT_MINUTES=10080;
export function editMinutes(value){return Number.isInteger(value)&&value>=1&&value<=MAX_EDIT_MINUTES?value:DEFAULT_EDIT_MINUTES;}
export const ORIGINS=new Set(['https://www.h4sxmy.xyz','https://h4sxmy.xyz']);
export function validateSubmission(input,isAdmin=false){
  const code=String(input?.code||'').trim().toUpperCase(),raw=input?.review||{};
  if(!/^[A-Z0-9-]{4,40}$/.test(code))throw Error('Kod pengesahan tidak sah atau telah digunakan.');
  const nama=String(raw.nama||'').trim(),inputText=String(raw.ulasan||'').trim(),ulasan=inputText.replace(/^cdg\s*[-:]\s*/i,'').trim()||'Tiada ulasan ditinggalkan.',bintang=Number(raw.bintang);
  if(!nama||nama.length>40||ulasan.length>500||!Number.isInteger(bintang)||bintang<1||bintang>5)throw Error('Nama, rating atau ulasan tidak sah.');
  const nameIssue=reviewNameIssue(nama,code,isAdmin);if(nameIssue)throw Error(nameIssue);
  if(/^(anjing|babi|sial|bodoh|bangang|bangsat|celaka|laknat)$/i.test(nama)||/(pukimak|kimak|puki|butoh|butuh|kontol|memek|lancau|lanjiao|cibai|jibai|pundek|fuck|shit|bitch|asshole|nigger|nigga|keling)/i.test(nama))throw Error('Sila gunakan nama yang sopan.');
  const review={nama,bintang,ulasan};
  if(Object.hasOwn(raw,'profileOffsetY')){const offset=Number(raw.profileOffsetY);if(!Number.isFinite(offset)||offset < -50||offset > 50)throw Error('Posisi gambar profil tidak sah.');review.profileOffsetY=offset;}
  if(Object.hasOwn(raw,'profileZoom')){const zoom=Number(raw.profileZoom);if(!Number.isFinite(zoom)||zoom<50||zoom>300)throw Error('Zoom gambar profil tidak sah.');review.profileZoom=zoom;}

  if(raw.warnaProfil&&/^#[0-9a-f]{6}$/i.test(raw.warnaProfil))review.warnaProfil=raw.warnaProfil;
  if(typeof raw.emojiProfil==='string'&&raw.emojiProfil.length<=20)review.emojiProfil=raw.emojiProfil;
  for(const field of ['profileImg','feedbackImg']){if(raw[field]){if(typeof raw[field]!=='string'||raw[field].length>600000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw[field]))throw Error('Gambar terlalu besar atau tidak sah.');review[field]=raw[field];}}
  if(raw.feedbackVideo){const url=feedbackVideoUrl(raw.feedbackVideo);if(!url)throw Error('Video feedback mesti link HTTPS terus MP4 / WebM.');review.feedbackVideo=url;}
  if(Buffer.byteLength(JSON.stringify(review))>800000)throw Error('Jumlah gambar terlalu besar.');
  if(raw.cadanganDigunakan===true||/^cdg\s*[-:]/i.test(inputText)){review.cdg=true;review.cadanganDigunakan=true;}
  if(isAdmin&&input.official===true){review.adminAuthorUid=ADMIN_UID;review.adminIdentityConfirmed=true;}
  return {code,review};
}
export function publicPayload(review,settings,now){
  const result={...review,moderationStatus:'published',moderatedAt:new Date(now)};
  if(settings.approvedRole?.enabled!==false)result.approvedRoleGranted=true;
  if(settings.autoReply!==false&&review.autoReplyDisabled!==true&&review.balasanDibuang!==true&&!String(review.balasanAdmin||'').trim()){
    const template=settings.replyTemplates?.[review.bintang]||'Terima kasih, {nama}! Kami hargai ulasan anda kepada H4SX STORE. Sokongan anda membantu kami terus memperbaiki servis.';
    result.balasanAdmin=String(template).replaceAll('{nama}',review.nama).slice(0,3000);result.balasanPada=new Date(now);
  }
  return result;
}
export async function rejectExistingCodeName(tx,firestore,name){
 const candidate=String(name||'').trim().toUpperCase();if(!/^[A-Z0-9-]{4,40}$/.test(candidate))return;
 const records=await Promise.all([tx.get(firestore.doc('review_codes/'+candidate)),tx.get(firestore.doc('ratings/review_'+candidate)),tx.get(firestore.doc('review_pending/review_'+candidate))]);
 if(records.some(record=>record.exists))throw Error('Jangan gunakan kod review sebagai nama. Masukkan nama atau username sendiri.');
}
export async function stageSubmission(firestore,input,isAdmin=false,now=Date.now(),editContext=null){
  const {code,review}=validateSubmission(input,isAdmin),id='review_'+code;
  const codeRef=firestore.doc('review_codes/'+code),pendingRef=firestore.doc('review_pending/'+id),ratingRef=firestore.doc('ratings/'+id);
  return firestore.runTransaction(async tx=>{
    const [codeSnap,pendingSnap,ratingSnap,configSnap,replySnap]=await Promise.all([tx.get(codeRef),tx.get(pendingRef),tx.get(ratingRef),tx.get(firestore.doc('config/review_moderation')),tx.get(firestore.doc('config/review_admin'))]);
    if(!codeSnap.exists||pendingSnap.exists||ratingSnap.exists)throw Error('Kod pengesahan tidak sah atau telah digunakan.');
    await rejectExistingCodeName(tx,firestore,review.nama);
    const data={...review,diciptaPada:new Date(now)},pending=configSnap.data()?.enabled!==false;
    if(pending)tx.set(pendingRef,{status:'pending',submittedAt:now,autoApproveAt:now+WAIT_MS,review:data});
    else tx.set(ratingRef,publicPayload(data,replySnap.data()||{},now));
    const editWindowMinutes=editMinutes(configSnap.data()?.editMinutes),editExpiresAt=editContext&&!review.adminIdentityConfirmed?now+editWindowMinutes*60000:null;
    if(editExpiresAt)tx.set(firestore.doc('review_edit_grants/'+editContext.grantId),{reviewId:id,submittedAt:now,expiresAt:editExpiresAt});
    tx.delete(codeRef);
    return {success:true,id,status:pending?'pending':'published',autoApproveAt:pending?now+WAIT_MS:null,editExpiresAt,editMinutes:editExpiresAt?editWindowMinutes:null};
  });
}
export async function decideSubmission(firestore,id,action,now=Date.now(),automatic=false){
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('ID ulasan tidak sah.');
  if(!['approve','reject','delete','trash','restore'].includes(action))throw Error('Tindakan tidak sah.');
  const pendingRef=firestore.doc('review_pending/'+id),ratingRef=firestore.doc('ratings/'+id);
  return firestore.runTransaction(async tx=>{
    const [pendingSnap,ratingSnap,replySnap]=await Promise.all([tx.get(pendingRef),tx.get(ratingRef),tx.get(firestore.doc('config/review_admin'))]);
    if(action==='approve'&&ratingSnap.exists&&!automatic){
      const rating=ratingSnap.data(),entry=pendingSnap.data()||{};
      if(rating.moderationStatus==='trash'||entry.status==='trash')throw Error('Pulihkan ulasan daripada tong sampah dahulu.');
      const changes={moderationStatus:'published',moderatedAt:new Date(now)};
      if(rating.autoHiddenByReports)Object.assign(changes,{autoHiddenByReports:false,reportCount:0,reportGeneration:(Number(rating.reportGeneration)||0)+1,reportTestCount:0,reportAutoHideTest:false,reportAutoHideTestEnabled:false});
      const approved={...entry,status:'published',moderatedAt:now,customerEditLocked:true,customerEditLockedAt:entry.customerEditLockedAt??now};
      delete approved.review;delete approved.autoApproveAt;
      tx.update(ratingRef,changes);tx.set(pendingRef,approved);return 'published';
    }
    if(action==='delete'){tx.delete(pendingRef);if(ratingSnap.exists)tx.delete(ratingRef);return 'deleted';}
    if(!pendingSnap.exists){
      if(!ratingSnap.exists)return 'skip';const rating=ratingSnap.data(),status=rating.moderationStatus||'published';
      if(action==='trash'&&status!=='trash'){tx.update(ratingRef,{moderationStatus:'trash',trashPreviousStatus:status,trashedAt:new Date(now)});return 'trash';}
      if(action==='restore'&&status==='trash'){const previous=['published','hidden','rejected'].includes(rating.trashPreviousStatus)?rating.trashPreviousStatus:'published';tx.update(ratingRef,{moderationStatus:previous,moderatedAt:new Date(now)});return previous;}
      return 'skip';
    }const entry=pendingSnap.data();
    if(automatic&&(entry.status!=='pending'||!Number.isFinite(entry.autoApproveAt)||entry.autoApproveAt>now))return 'skip';
    if(action==='trash'){
      if(entry.status==='trash')return 'skip';
      const previous=ratingSnap.exists?(ratingSnap.data().moderationStatus||'published'):entry.status;
      const trashed={...entry,review:entry.review||(ratingSnap.exists?ratingSnap.data():{}),status:'trash',trashPreviousStatus:previous,trashedAt:now};
      delete trashed.autoApproveAt;tx.set(pendingRef,trashed);
      if(ratingSnap.exists)tx.update(ratingRef,{moderationStatus:'trash',trashPreviousStatus:previous,trashedAt:new Date(now)});
      return 'trash';
    }
    if(action==='restore'){
      if(entry.status!=='trash')return 'skip';
      const previous=entry.trashPreviousStatus==='pending'?'pending':entry.trashPreviousStatus==='rejected'?'rejected':entry.trashPreviousStatus==='hidden'?'hidden':'published';
      const restored={...entry,status:previous,moderatedAt:now};delete restored.trashPreviousStatus;delete restored.trashedAt;delete restored.autoApproveAt;
      if(previous==='pending')restored.autoApproveAt=now+WAIT_MS;
      tx.set(pendingRef,restored);
      if(ratingSnap.exists)tx.update(ratingRef,{moderationStatus:previous,moderatedAt:new Date(now)});
      return previous;
    }
    if(entry.status==='trash')throw Error('Pulihkan ulasan daripada tong sampah dahulu.');
    if(action==='reject'){const rejected={...entry,review:entry.review||(ratingSnap.exists?ratingSnap.data():{}),status:'rejected',moderatedAt:now};delete rejected.autoApproveAt;tx.set(pendingRef,rejected);if(ratingSnap.exists)tx.update(ratingRef,{moderationStatus:'rejected',moderatedAt:new Date(now)});return 'rejected';}
    if(ratingSnap.exists){if(entry.status==='published')return 'skip';throw Error('Ulasan ini sudah diterbitkan. Muat semula senarai.');}
    if(!entry.review)throw Error('Data ulasan tidak lengkap.');
    tx.set(ratingRef,{...publicPayload(entry.review,replySnap.data()||{},now),autoApproved:automatic});
    tx.set(pendingRef,{status:'published',submittedAt:entry.submittedAt,moderatedAt:now,autoApproved:automatic,...(!automatic||entry.customerEditLocked===true?{customerEditLocked:true,customerEditLockedAt:entry.customerEditLockedAt??now}:{})});
    return 'published';
  });
}
export async function approveDue(firestore,now=Date.now()){
  const snapshot=await firestore.collection('review_pending').where('autoApproveAt','<=',now).limit(100).get();let approved=0,skipped=0;
  for(const item of snapshot.docs){const result=await decideSubmission(firestore,item.id,'approve',now,true);if(result==='published')approved++;else skipped++;}
  return {success:true,approved,skipped,checked:snapshot.size};
}
export function queuePreview(snapshot){const entry=snapshot.data(),r=entry.review||{};return {id:snapshot.id,nama:r.nama,bintang:r.bintang,ulasan:r.ulasan,warnaProfil:r.warnaProfil,emojiProfil:r.emojiProfil,diciptaPada:entry.submittedAt,moderationStatus:entry.status,pendingSource:true,hasFeedbackImage:!!r.feedbackImg,hasFeedbackVideo:!!r.feedbackVideo,autoApproveAt:entry.autoApproveAt||null};}

export async function editReviewFeedback(firestore,id,patch,now=Date.now()){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(id||''))throw Error('ID ulasan tidak sah.');
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length||Object.keys(patch).some(key=>!['ulasan','feedbackImg','feedbackVideo','approvedRoleText'].includes(key)))throw Error('Hanya teks ulasan, teks role, gambar dan video feedback boleh diedit.');
 const changes={};
 if(Object.hasOwn(patch,'approvedRoleText')){if(typeof patch.approvedRoleText!=='string'||patch.approvedRoleText.trim().length>24)throw Error('Teks role maksimum 24 aksara.');changes.approvedRoleText=patch.approvedRoleText.trim();}
 if(Object.hasOwn(patch,'ulasan')){if(typeof patch.ulasan!=='string'||patch.ulasan.trim().length>500)throw Error('Ulasan maksimum 500 aksara.');changes.ulasan=patch.ulasan.trim()||'Tiada ulasan ditinggalkan.';}
 for(const key of ['feedbackImg','feedbackVideo']){if(!Object.hasOwn(patch,key))continue;const value=patch[key];if(value!==null&&typeof value!=='string')throw Error('Lampiran feedback tidak sah.');if(!value){changes[key]=null;continue;}
  if(key==='feedbackImg'){if(value.length>600000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))throw Error('Gambar feedback terlalu besar atau tidak sah.');changes[key]=value;}
  else{const url=feedbackVideoUrl(value);if(!url)throw Error('Video feedback mesti link HTTPS terus MP4 / WebM.');changes[key]=url;}
 }
 const pendingRef=firestore.doc('review_pending/'+id),ratingRef=firestore.doc('ratings/'+id);
 return firestore.runTransaction(async tx=>{
  const [pending,rating,config]=await Promise.all([tx.get(pendingRef),tx.get(ratingRef),tx.get(firestore.doc('config/review_admin'))]);
  const entry=pending.data(),original=rating.exists?rating.data():entry?.review;
  if(!original)throw Error('Ulasan tidak ditemui.');if((rating.data()?.moderationStatus||entry?.status)==='trash')throw Error('Pulihkan ulasan daripada tong sampah dahulu.');
  const updated={...original,...changes};for(const key of ['feedbackImg','feedbackVideo'])if(changes[key]===null)delete updated[key];
  if(changes.ulasan!==undefined&&changes.ulasan!==original.ulasan){updated.ulasanDieditPada=new Date(now);if(rating.exists){const reply=publicPayload(updated,config.data()||{},now);if(reply.balasanAdmin){updated.balasanAdmin=reply.balasanAdmin;if(reply.balasanPada!==undefined)updated.balasanPada=reply.balasanPada;}}}
  if(Object.hasOwn(changes,'feedbackImg')||Object.hasOwn(changes,'feedbackVideo'))updated.feedbackDieditPada=new Date(now);
  if(Buffer.byteLength(JSON.stringify(updated))>900000)throw Error('Jumlah gambar terlalu besar. Kecilkan gambar feedback.');
  if(rating.exists)tx.set(ratingRef,updated);else tx.set(pendingRef,{...entry,review:updated});
  return {success:true,id,status:rating.exists?(original.moderationStatus||'published'):entry.status};
 });
}
