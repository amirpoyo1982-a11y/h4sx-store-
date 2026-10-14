import verifyTurnstile from './review-verify-turnstile.js';
import {firebaseServices} from './admin-sessions.js';
import {ADMIN_UID,ORIGINS} from '../lib/review-moderation.js';
import {validateReport,reporterKeys,submitReport} from '../lib/review-reports.js';
export function createReportHandler(getServices=firebaseServices,captcha=verifyTurnstile){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'POST sahaja.'});if(!ORIGINS.has(String(req.headers?.origin||'')))return res.status(403).json({error:'Origin tidak dibenarkan.'});if(Number(req.headers?.['content-length']||0)>10000)return res.status(413).json({error:'Payload terlalu besar.'});
 try{
  const input=validateReport(req.body),services=await getServices();let uid='';const bearer=String(req.headers?.authorization||'').match(/^Bearer (\S+)$/)?.[1];if(bearer){try{uid=(await services.auth.verifyIdToken(bearer,true)).uid;}catch(_){return res.status(401).json({error:'Sesi login tidak sah. Login semula.'});}}
  const isAdmin=uid===ADMIN_UID;let code=200,result;const recorder={setHeader(){},status(value){code=value;return this;},json(value){result=value;return this;}};
  await captcha({...req,headers:{...req.headers,'content-length':'0'},body:{token:req.body.token,action:'report_review',reviewId:input.reviewId}},recorder);
  if(!result?.success)return res.status(code).json({error:result?.error||'Pengesahan keselamatan gagal.'});
  return res.status(200).json(await submitReport(services.firestore,input,reporterKeys(req,input.deviceId,uid),isAdmin));
 }catch(error){console.error('Review report failed',error.code||error.message);if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));return res.status(error.status||500).json({error:error.status?error.message:'Gagal menyimpan laporan. Cuba lagi.',retryAfter:error.retryAfter||null});}
};}
export default createReportHandler();
