import {firebaseServices} from './admin-sessions.js';
import verifyTurnstile from './review-verify-turnstile.js';
import {ORIGINS,ADMIN_UID} from '../lib/review-moderation.js';
import {editSession,newEditSession,EDIT_COOKIE} from '../lib/review-edit.js';
import {reserveVideo,finishVideo,videoPlayback,videoGrant,MAX_VIDEO_BYTES} from '../lib/review-video.js';
export async function videoServices(){const services=await firebaseServices();const [{getApps},{getStorage}]=await Promise.all([import('firebase-admin/app'),import('firebase-admin/storage')]);return {...services,bucket:getStorage(getApps().find(app=>app.name==='h4sx-admin-sessions')).bucket(process.env.REVIEW_VIDEO_BUCKET)};}
export function createVideoHandler(getServices=videoServices,captcha=verifyTurnstile){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');const configured=!!process.env.REVIEW_VIDEO_BUCKET;
 if(req.method==='GET'&&req.query?.action==='status')return res.status(200).json({configured,maxBytes:MAX_VIDEO_BYTES});
 if(!configured)return res.status(503).json({error:'Upload video belum diaktifkan. Admin perlu setup Firebase Storage.'});
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method tidak dibenarkan.'});
 try{
  if(req.method==='GET'){
   const {firestore,bucket,auth}=await getServices();let admin=false;const bearer=String(req.headers?.authorization||'').match(/^Bearer (\S+)$/)?.[1];if(bearer)admin=(await auth.verifyIdToken(bearer,true)).uid===ADMIN_UID;
   return res.status(200).json(await videoPlayback(firestore,bucket,String(req.query?.id||''),admin));
  }
  if(!ORIGINS.has(String(req.headers?.origin||'')))return res.status(403).json({error:'Origin tidak dibenarkan.'});
  if(Number(req.headers?.['content-length']||0)>10000)return res.status(413).json({error:'Permintaan terlalu besar.'});
  const {action,code:rawCode,id,file}=req.body||{},code=String(rawCode||'').trim().toUpperCase();
  if(!['init','finish'].includes(action)||!/^[A-Z0-9-]{4,40}$/.test(code))return res.status(400).json({error:'Kod atau tindakan tidak sah.'});
  const session=editSession(req)||(action==='init'?newEditSession():null);if(!session)return res.status(403).json({error:'Browser upload tidak sepadan.'});
  if(action==='init'){
   let result,status=200;await captcha({...req,headers:{...req.headers,'content-length':'0'},body:{token:req.body.token,action:'review_upload'}},{setHeader(){},status(code){status=code;return this;},json(data){result=data;return this;}});
   if(!result?.success)return res.status(status).json({error:result?.error||'Pengesahan keselamatan gagal.'});
  }
  const {firestore,bucket}=await getServices(),grant=videoGrant(session,code);
  const result=action==='init'?await reserveVideo(firestore,bucket,code,grant,file):await finishVideo(firestore,bucket,id,grant);
  if(action==='init')res.setHeader('Set-Cookie',`${EDIT_COOKIE}=${session}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=3600`);
  return res.status(200).json({success:true,...result});
 }catch(error){console.error('Review video failed',error.code||'validation');return res.status(error.status||503).json({error:error.status?error.message:'Video gagal diproses. Semak setup Storage dan cuba semula.'});}
};}
export default createVideoHandler();
