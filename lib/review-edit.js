import crypto from 'node:crypto';
import {validateSubmission,WAIT_MS,rejectExistingCodeName,DEFAULT_EDIT_MINUTES} from './review-moderation.js';
export const EDIT_MS=DEFAULT_EDIT_MINUTES*60*1000;
export const EDIT_COOKIE='h4sx_review_edit';
export const CUSTOMER_FIELDS=['nama','bintang','ulasan','warnaProfil','emojiProfil','profileImg','profileZoom','profileOffsetY','feedbackImg','feedbackVideo','cadanganDigunakan'];
export function editSession(req){const value=String(req.headers?.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(EDIT_COOKIE+'='))?.slice(EDIT_COOKIE.length+1);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}
export function newEditSession(){return crypto.randomBytes(32).toString('hex');}
export function editGrantId(token,code){return crypto.createHash('sha256').update(token+'|'+code).digest('hex');}
export function editError(message,status=400){return Object.assign(Error(message),{status});}
export async function customerEdit(firestore,token,body,now=Date.now()){
 const code=String(body?.code||'').trim().toUpperCase();if(!/^[A-Z0-9-]{4,40}$/.test(code)||!token)throw editError('Edit hanya tersedia dalam browser asal sebelum tempoh edit tamat atau diluluskan admin.',403);
 if(!['load','save'].includes(body.action))throw editError('Tindakan tidak sah.');
 const id='review_'+code,grantRef=firestore.doc('review_edit_grants/'+editGrantId(token,code)),pendingRef=firestore.doc('review_pending/'+id),ratingRef=firestore.doc('ratings/'+id);
 return firestore.runTransaction(async tx=>{
  const [grantSnap,pendingSnap,ratingSnap]=await Promise.all([tx.get(grantRef),tx.get(pendingRef),tx.get(ratingRef)]),grant=grantSnap.data();
  if(!grantSnap.exists||grant.reviewId!==id||!Number.isFinite(grant.expiresAt)||now>=grant.expiresAt)throw editError('Kod tidak sah untuk browser ini atau tempoh edit sudah tamat.',403);
  const entry=pendingSnap.data()||{},rating=ratingSnap.data(),status=rating?.moderationStatus||entry.status;
  if(entry.customerEditLocked===true)throw Object.assign(editError('Ulasan sudah diluluskan admin. Kod edit telah dibatalkan; hubungi admin untuk perubahan.',409),{code:'review/edit-locked'});
  if(!['pending','published'].includes(status))throw editError('Ulasan ini sedang dikawal admin. Hubungi admin untuk perubahan.',409);
  const original=rating||(entry.status==='pending'?entry.review:null);if(!original||original.adminAuthorUid||original.adminIdentityConfirmed)throw editError('Ulasan ini tidak tersedia untuk edit pelanggan.',403);
  if(body.action==='load'){const review={};for(const key of CUSTOMER_FIELDS)if(original[key]!==undefined)review[key]=original[key];return {success:true,review,expiresAt:grant.expiresAt,serverNow:now};}
  const raw=body.review;if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!CUSTOMER_FIELDS.includes(k)))throw editError('Hanya medan ulasan pelanggan dibenarkan.');
  const validated=validateSubmission({code,review:raw}).review;
  await rejectExistingCodeName(tx,firestore,validated.nama);
  const updated={...original,...validated,customerEditedAt:new Date(now)};
  for(const key of ['profileImg','feedbackImg','feedbackVideo','warnaProfil','emojiProfil'])if(Object.hasOwn(raw,key)&&!raw[key])delete updated[key];
  updated.cdg=validated.cdg===true;updated.cadanganDigunakan=validated.cadanganDigunakan===true;
  tx.set(pendingRef,{status:'pending',submittedAt:grant.submittedAt,autoApproveAt:now+WAIT_MS,review:updated,customerEdit:true,editedAt:now});
  if(ratingSnap.exists)tx.delete(ratingRef);
  return {success:true,status:'pending',expiresAt:grant.expiresAt,serverNow:now};
 });
}
