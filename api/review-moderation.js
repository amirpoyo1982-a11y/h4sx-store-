import {firebaseServices} from './admin-sessions.js';
import {ADMIN_UID,ORIGINS,decideSubmission,queuePreview,editReviewFeedback} from '../lib/review-moderation.js';
import {setReportControl} from '../lib/review-reports.js';
export function createModerationHandler(getServices=firebaseServices){return async function(req,res){
  res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method tidak dibenarkan.'});
  if(!ORIGINS.has(String(req.headers?.origin||'')))return res.status(403).json({error:'Origin tidak dibenarkan.'});
  const bearer=String(req.headers?.authorization||'').match(/^Bearer (\S+)$/)?.[1];if(!bearer)return res.status(401).json({error:'Login admin diperlukan.'});
  try{const {auth,firestore}=await getServices();const token=await auth.verifyIdToken(bearer,true);if(token.uid!==ADMIN_UID)return res.status(403).json({error:'Admin sahaja.'});
    const {action,id}=req.body||{};
    if(action==='editFeedback')return res.status(200).json(await editReviewFeedback(firestore,String(id||''),req.body.patch));
    if(['restoreReported','reportsEnable','reportsDisable','reportTestEnable','reportTestDisable'].includes(action))return res.status(200).json(await setReportControl(firestore,String(id||''),action));
    if(action==='list'){const snapshots=await Promise.all(['pending','rejected','trash'].map(status=>firestore.collection('review_pending').where('status','==',status).limit(100).get()));const config=await firestore.doc('config/review_moderation').get();return res.status(200).json({success:true,records:snapshots.flatMap(snapshot=>snapshot.docs.map(queuePreview)),enabled:config.data()?.enabled!==false,cronConfigured:(process.env.REVIEW_CRON_SECRET||'').length>=32});}
    if(action==='configure'){await firestore.doc('config/review_moderation').set({enabled:req.body.enabled===true,waitMinutes:30},{merge:true});return res.status(200).json({success:true});}
    if(action==='detail'){if(!/^review_[A-Z0-9-]{4,40}$/.test(String(id)))return res.status(400).json({error:'ID tidak sah.'});const snap=await firestore.doc('review_pending/'+id).get();return res.status(200).json({success:true,review:snap.data()?.review||null,feedbackImg:snap.data()?.review?.feedbackImg||null,feedbackVideo:snap.data()?.review?.feedbackVideo||null});}
    return res.status(200).json({success:true,result:await decideSubmission(firestore,String(id||''),action)});
  }catch(error){console.error('Review moderation failed',error.code||error.message);return res.status(400).json({error:error.code?'Gagal memuatkan moderasi. Semak backend.':error.message});}
};}
export default createModerationHandler();
