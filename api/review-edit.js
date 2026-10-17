import verifyTurnstile from './review-verify-turnstile.js';
import {firebaseServices} from './admin-sessions.js';
import {ORIGINS} from '../lib/review-moderation.js';
import {customerEdit,editSession} from '../lib/review-edit.js';
export function createEditHandler(getServices=firebaseServices,captcha=verifyTurnstile){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'POST sahaja.'});if(!ORIGINS.has(String(req.headers?.origin||'')))return res.status(403).json({error:'Origin tidak dibenarkan.'});if(Number(req.headers?.['content-length']||0)>850000)return res.status(413).json({error:'Gambar terlalu besar.'});
 try{const token=editSession(req);
  if(req.body?.action==='save'){let code=200,result;const recorder={setHeader(){},status(v){code=v;return this;},json(v){result=v;return this}};await captcha({...req,headers:{...req.headers,'content-length':'0'},body:{token:req.body.token,action:'review_edit'}},recorder);if(!result?.success)return res.status(code).json({error:result?.error||'Pengesahan gagal.'});}
  const {firestore}=await getServices();return res.status(200).json(await customerEdit(firestore,token,req.body));
 }catch(error){console.error('Customer review edit failed',error.code||error.message);return res.status(error.status||400).json({error:error.status?error.message:error.code?'Gagal mengemaskini ulasan. Cuba lagi.':error.message,...(error.code==='review/edit-locked'?{code:error.code}:{})});}
};}
export default createEditHandler();
