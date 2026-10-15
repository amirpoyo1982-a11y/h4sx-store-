import {firebaseServices} from './admin-sessions.js';
import {ADMIN_UID} from '../lib/review-moderation.js';
import {videoPlayback} from '../lib/review-video.js';
export function createVideoHandler(getServices=firebaseServices){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Gunakan link terus MP4 / WebM. Upload fail tidak digunakan.'});
 if(req.query?.action==='status')return res.status(200).json({mode:'link',linksEnabled:true,uploadEnabled:false});
 try{const {firestore,auth}=await getServices();let admin=false;const bearer=String(req.headers?.authorization||'').match(/^Bearer (\S+)$/)?.[1];if(bearer)admin=(await auth.verifyIdToken(bearer,true)).uid===ADMIN_UID;return res.status(200).json(await videoPlayback(firestore,String(req.query?.id||''),admin));}
 catch(error){console.error('Review video failed',error.status||error.code||'backend');return res.status(error.status||503).json({error:error.status?error.message:'Video gagal dimuatkan. Cuba lagi.'});}
};}
export default createVideoHandler();
