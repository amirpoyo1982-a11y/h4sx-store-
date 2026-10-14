import verifyTurnstile from './review-verify-turnstile.js';
import {firebaseServices} from './admin-sessions.js';
import {ADMIN_UID,ORIGINS,stageSubmission,validateSubmission} from '../lib/review-moderation.js';
import {editSession,newEditSession,editGrantId,EDIT_COOKIE} from '../lib/review-edit.js';
export function createSubmitHandler(getServices=firebaseServices,captcha=verifyTurnstile){return async function(req,res){
  res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method tidak dibenarkan.'});
  if(!ORIGINS.has(String(req.headers?.origin||'')))return res.status(403).json({error:'Origin tidak dibenarkan.'});
  if(Number(req.headers?.['content-length']||0)>850000)return res.status(413).json({error:'Gambar terlalu besar.'});
  try{
    validateSubmission(req.body?.submission,true);
    let captchaResult,captchaCode=200;const recorder={setHeader(){},status(code){captchaCode=code;return this;},json(data){captchaResult=data;return this;}};
    await captcha({...req,headers:{...req.headers,'content-length':'0'},body:{token:req.body?.token,action:'review_submit'}},recorder);
    if(!captchaResult?.success)return res.status(captchaCode).json({error:captchaResult?.error||'Pengesahan keselamatan gagal.'});
    const services=await getServices();let isAdmin=false;
    const bearer=String(req.headers?.authorization||'').match(/^Bearer (\S+)$/)?.[1];
    if(bearer){const token=await services.auth.verifyIdToken(bearer,true);isAdmin=token.uid===ADMIN_UID;}
    const editToken=editSession(req)||newEditSession(),code=String(req.body.submission.code).trim().toUpperCase();
    const result=await stageSubmission(services.firestore,req.body.submission,isAdmin,Date.now(),{grantId:editGrantId(editToken,code)});
    if(result.editExpiresAt)res.setHeader('Set-Cookie',`${EDIT_COOKIE}=${editToken}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=600`);
    return res.status(200).json(result);
  }catch(error){const setup=error.code==='sessions/setup-required';const invalid=String(error.message).includes('Kod pengesahan');console.error('Review submit failed',error.code||error.message);return res.status(setup?503:invalid?409:error.code?500:400).json({error:setup?'Backend belum dikonfigurasi.':error.code?'Gagal simpan ulasan. Cuba lagi.':error.message});}
};}
export default createSubmitHandler();
