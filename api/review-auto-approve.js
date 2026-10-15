import {timingSafeEqual} from 'node:crypto';
import {firebaseServices} from './admin-sessions.js';
import {approveDue} from '../lib/review-moderation.js';
export function createAutoApproveHandler(getServices=firebaseServices){return async function(req,res){
  res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method tidak dibenarkan.'});
  const secret=process.env.REVIEW_CRON_SECRET;if(!secret||secret.length<32)return res.status(503).json({error:'Tetapkan REVIEW_CRON_SECRET dalam Vercel.'});
  const actual=Buffer.from(String(req.headers?.authorization||'')),expected=Buffer.from('Bearer '+secret);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return res.status(401).json({error:'Unauthorized'});
  try{const {firestore}=await getServices();return res.status(200).json(await approveDue(firestore));}catch(error){console.error('Review cron failed',error.code||error.message);return res.status(503).json({error:'Auto-approve gagal. Semak konfigurasi backend.'});}
};}
export default createAutoApproveHandler();
