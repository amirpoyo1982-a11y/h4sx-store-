export const ADMIN_UID='LWRN6IDv4OV1PZd7Vldgp6F9pdH3';
export const WAIT_MS=30*60*1000;
export const ORIGINS=new Set(['https://www.h4sxmy.xyz','https://h4sxmy.xyz']);
export function validateSubmission(input,isAdmin=false){
  const code=String(input?.code||'').trim().toUpperCase(),raw=input?.review||{};
  if(!/^[A-Z0-9-]{4,40}$/.test(code))throw Error('Kod pengesahan tidak sah atau telah digunakan.');
  const nama=String(raw.nama||'').trim(),ulasan=String(raw.ulasan||'').trim()||'Tiada ulasan ditinggalkan.',bintang=Number(raw.bintang);
  if(!nama||nama.length>40||ulasan.length>500||!Number.isInteger(bintang)||bintang<1||bintang>5)throw Error('Nama, rating atau ulasan tidak sah.');
  if(!isAdmin&&nama.toLowerCase().includes('h4sx'))throw Error('Nama ini dikhaskan untuk admin.');
  if(/^(anjing|babi|sial|bodoh|bangang|bangsat|celaka|laknat)$/i.test(nama)||/(pukimak|kimak|puki|butoh|butuh|kontol|memek|lancau|lanjiao|cibai|jibai|pundek|fuck|shit|bitch|asshole|nigger|nigga|keling)/i.test(nama))throw Error('Sila gunakan nama yang sopan.');
  const review={nama,bintang,ulasan};
  if(raw.warnaProfil&&/^#[0-9a-f]{6}$/i.test(raw.warnaProfil))review.warnaProfil=raw.warnaProfil;
  if(typeof raw.emojiProfil==='string'&&raw.emojiProfil.length<=20)review.emojiProfil=raw.emojiProfil;
  for(const field of ['profileImg','feedbackImg']){if(raw[field]){if(typeof raw[field]!=='string'||raw[field].length>600000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw[field]))throw Error('Gambar terlalu besar atau tidak sah.');review[field]=raw[field];}}
  if(Buffer.byteLength(JSON.stringify(review))>800000)throw Error('Jumlah gambar terlalu besar.');
  if(raw.cadanganDigunakan===true||/^cdg\s*[-:]/i.test(ulasan)){review.cdg=true;review.cadanganDigunakan=true;}
  if(isAdmin&&input.official===true){review.adminAuthorUid=ADMIN_UID;review.adminIdentityConfirmed=true;}
  return {code,review};
}
export function publicPayload(review,settings,now){
  const result={...review,moderationStatus:'published',moderatedAt:new Date(now)};
  if(settings.autoReply!==false&&review.autoReplyDisabled!==true&&review.balasanDibuang!==true&&!String(review.balasanAdmin||'').trim()){
    const template=settings.replyTemplates?.[review.bintang]||'Terima kasih, {nama}! Kami hargai ulasan anda kepada H4SX STORE. Sokongan anda membantu kami terus memperbaiki servis.';
    result.balasanAdmin=String(template).replaceAll('{nama}',review.nama).slice(0,3000);result.balasanPada=new Date(now);
  }
  return result;
}
export async function stageSubmission(firestore,input,isAdmin=false,now=Date.now(),editContext=null){
  const {code,review}=validateSubmission(input,isAdmin),id='review_'+code;
  const codeRef=firestore.doc('review_codes/'+code),pendingRef=firestore.doc('review_pending/'+id),ratingRef=firestore.doc('ratings/'+id);
  return firestore.runTransaction(async tx=>{
    const [codeSnap,pendingSnap,ratingSnap,configSnap,replySnap]=await Promise.all([tx.get(codeRef),tx.get(pendingRef),tx.get(ratingRef),tx.get(firestore.doc('config/review_moderation')),tx.get(firestore.doc('config/review_admin'))]);
    if(!codeSnap.exists||pendingSnap.exists||ratingSnap.exists)throw Error('Kod pengesahan tidak sah atau telah digunakan.');
    const data={...review,diciptaPada:new Date(now)},pending=configSnap.data()?.enabled!==false;
    if(pending)tx.set(pendingRef,{status:'pending',submittedAt:now,autoApproveAt:now+WAIT_MS,review:data});
    else tx.set(ratingRef,publicPayload(data,replySnap.data()||{},now));
    if(editContext&&!review.adminIdentityConfirmed)tx.set(firestore.doc('review_edit_grants/'+editContext.grantId),{reviewId:id,submittedAt:now,expiresAt:now+10*60*1000});
    tx.delete(codeRef);
    return {success:true,id,status:pending?'pending':'published',autoApproveAt:pending?now+WAIT_MS:null,editExpiresAt:editContext&&!review.adminIdentityConfirmed?now+10*60*1000:null};
  });
}
export async function decideSubmission(firestore,id,action,now=Date.now(),automatic=false){
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('ID ulasan tidak sah.');
  if(!['approve','reject','delete','trash','restore'].includes(action))throw Error('Tindakan tidak sah.');
  const pendingRef=firestore.doc('review_pending/'+id),ratingRef=firestore.doc('ratings/'+id);
  return firestore.runTransaction(async tx=>{
    const [pendingSnap,ratingSnap,replySnap]=await Promise.all([tx.get(pendingRef),tx.get(ratingRef),tx.get(firestore.doc('config/review_admin'))]);
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
    tx.set(pendingRef,{status:'published',submittedAt:entry.submittedAt,moderatedAt:now,autoApproved:automatic});
    return 'published';
  });
}
export async function approveDue(firestore,now=Date.now()){
  const snapshot=await firestore.collection('review_pending').where('autoApproveAt','<=',now).limit(100).get();let approved=0,skipped=0;
  for(const item of snapshot.docs){const result=await decideSubmission(firestore,item.id,'approve',now,true);if(result==='published')approved++;else skipped++;}
  return {success:true,approved,skipped,checked:snapshot.size};
}
export function queuePreview(snapshot){const entry=snapshot.data(),r=entry.review||{};return {id:snapshot.id,nama:r.nama,bintang:r.bintang,ulasan:r.ulasan,warnaProfil:r.warnaProfil,emojiProfil:r.emojiProfil,diciptaPada:entry.submittedAt,moderationStatus:entry.status,pendingSource:true,hasFeedbackImage:!!r.feedbackImg,autoApproveAt:entry.autoApproveAt||null};}
