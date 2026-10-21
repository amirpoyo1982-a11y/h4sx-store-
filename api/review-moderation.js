import {firebaseServices} from './admin-sessions.js';
import {ADMIN_UID,ORIGINS,decideSubmission,queuePreview,editReviewFeedback,editMinutes,MAX_EDIT_MINUTES} from '../lib/review-moderation.js';
import {setReportControl} from '../lib/review-reports.js';
import {listReviewHistory} from '../lib/review-history.js';
import {reactivateCustomerEdit} from '../lib/review-edit.js';
import {listReviewNameCensors,setReviewNameCensor} from '../lib/review-name-censor.js';
export function createModerationHandler(getServices=firebaseServices){return async function(req,res){
  res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method tidak dibenarkan.'});
  if(!ORIGINS.has(String(req.headers?.origin||'')))return res.status(403).json({error:'Origin tidak dibenarkan.'});
  const bearer=String(req.headers?.authorization||'').match(/^Bearer (\S+)$/)?.[1];if(!bearer)return res.status(401).json({error:'Login admin diperlukan.'});
  try{const {auth,firestore,database}=await getServices();const token=await auth.verifyIdToken(bearer,true);if(token.uid!==ADMIN_UID)return res.status(403).json({error:'Admin sahaja.'});
    const {action,id}=req.body||{};
    if(action==='history')return res.status(200).json(await listReviewHistory(firestore,req.body.cursor));
    if(action==='reactivateEdit')return res.status(200).json(await reactivateCustomerEdit(firestore,String(id||''),req.body.minutes));
    if(action==='editFeedback')return res.status(200).json(await editReviewFeedback(firestore,String(id||''),req.body.patch));
    if(action==='setNameCensor')return res.status(200).json(await setReviewNameCensor(firestore,database,String(id||''),req.body.enabled));
    if(['restoreReported','reportsEnable','reportsDisable','reportTestEnable','reportTestDisable'].includes(action))return res.status(200).json(await setReportControl(firestore,String(id||''),action));
    if(action==='list'){const [snapshots,config,nameCensors]=await Promise.all([Promise.all(['pending','rejected','trash'].map(status=>firestore.collection('review_pending').where('status','==',status).limit(100).get())),firestore.doc('config/review_moderation').get(),listReviewNameCensors(database)]);return res.status(200).json({success:true,records:snapshots.flatMap(snapshot=>snapshot.docs.map(queuePreview)),nameCensors,enabled:config.data()?.enabled!==false,editMinutes:editMinutes(config.data()?.editMinutes),cronConfigured:(process.env.REVIEW_CRON_SECRET||'').length>=32});}
    if(action==='configure'){
      const patch={};
      if(Object.hasOwn(req.body,'enabled')){if(typeof req.body.enabled!=='boolean')throw Error('Tetapan moderasi tidak sah.');patch.enabled=req.body.enabled;patch.waitMinutes=30;}
      if(Object.hasOwn(req.body,'editMinutes')){if(!Number.isInteger(req.body.editMinutes)||req.body.editMinutes<1||req.body.editMinutes>MAX_EDIT_MINUTES)throw Error('Tempoh edit mesti 1–10080 minit (maksimum 7 hari).');patch.editMinutes=req.body.editMinutes;}
      if(!Object.keys(patch).length)throw Error('Tetapan tidak sah.');
      await firestore.doc('config/review_moderation').set(patch,{merge:true});return res.status(200).json({success:true});
    }
    if(action==='detail'){if(!/^review_[A-Z0-9-]{4,40}$/.test(String(id)))return res.status(400).json({error:'ID tidak sah.'});const snap=await firestore.doc('review_pending/'+id).get();return res.status(200).json({success:true,review:snap.data()?.review||null,feedbackImg:snap.data()?.review?.feedbackImg||null,feedbackVideo:snap.data()?.review?.feedbackVideo||null});}
    if(action==='delete'){const result=await decideSubmission(firestore,String(id||''),action);await database.ref('review_private_names/'+String(id||'')).remove();return res.status(200).json({success:true,result});}
    return res.status(200).json({success:true,result:await decideSubmission(firestore,String(id||''),action)});
  }catch(error){console.error('Review moderation failed',error.code||error.message);return res.status(error.status||400).json({error:error.code?'Gagal memuatkan moderasi. Semak backend.':error.message});}
};}
export default createModerationHandler();
