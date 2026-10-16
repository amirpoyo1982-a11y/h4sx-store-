const PAGE_SIZE = 100;
const REVIEW_ID = /^review_[A-Z0-9-]{4,40}$/;
const STATUSES = new Set(['pending', 'published', 'hidden', 'rejected', 'trash']);
const SOURCES = {
  ratings: {time:'diciptaPada',fields:['nama','diciptaPada','moderationStatus']},
  review_pending: {time:'submittedAt',fields:['review.nama','submittedAt','status']}
};

function milliseconds(value) {
  if (value == null) return null;
  const time = typeof value.toMillis === 'function' ? value.toMillis()
    : typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function readCursor(cursor) {
  if (cursor === null) return {phase:'timed',ratings:null,review_pending:null};
  try {
    if (typeof cursor !== 'string' || cursor.length > 1024) throw Error();
    const value=JSON.parse(Buffer.from(cursor,'base64url').toString());
    if (![1,2].includes(value.version) || !['ratings','review_pending'].every(name=>{
      const part=value[name];
      if(value.version===2)return part===null || typeof part==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(part);
      return part===null || (Array.isArray(part) && part.length===3
        && typeof part[0]==='number' && Number.isFinite(part[0])
        && ['date','number'].includes(part[1]) && typeof part[2]==='string'
        && /^[A-Za-z0-9_-]{1,128}$/.test(part[2]));
    })) throw Error();
    return {phase:value.version===2?'legacy':'timed',ratings:value.ratings,review_pending:value.review_pending};
  } catch {throw Error('Penanda halaman sejarah tidak sah.');}
}

function position(value,id) {
  return [milliseconds(value),typeof value==='number'?'number':'date',id];
}

async function listLegacyHistory(firestore, positions, limit) {
  const names=Object.keys(SOURCES);
  const snapshots=await Promise.all(names.map(name=>{
    const fields=SOURCES[name].fields;
    let query=firestore.collection(name).orderBy('__name__').endAt('review_\uf8ff').select(...fields);
    query=positions[name]===null?query.startAt('review_'):query.startAfter(positions[name]);
    return query.limit(limit+1).get();
  }));
  const found=Object.fromEntries(names.map((name,index)=>[name,new Map(snapshots[index].docs.map(doc=>[doc.id,doc.data()]))]));
  const candidates=names.flatMap((name,index)=>snapshots[index].docs.map(doc=>({name,id:doc.id,data:doc.data()})))
    .sort((a,b)=>a.id.localeCompare(b.id)||a.name.localeCompare(b.name));
  await Promise.all(candidates.filter(item=>REVIEW_ID.test(item.id)).map(async item=>{
    const other=item.name==='ratings'?'review_pending':'ratings';
    if(found[other].has(item.id))return;
    found[other].set(item.id,(await firestore.doc(other+'/'+item.id).get()).data());
  }));
  const records=[];
  for(const item of candidates){
    if(records.length===limit)break;
    positions[item.name]=item.id;
    if(!REVIEW_ID.test(item.id))continue;
    const other=item.name==='ratings'?'review_pending':'ratings',related=found[other].get(item.id);
    if(item.name==='ratings' && related)continue;
    const rating=item.name==='ratings'?item.data:related;
    const entry=item.name==='review_pending'?item.data:related;
    if(milliseconds(entry?.submittedAt)!==null || milliseconds(rating?.diciptaPada)!==null)continue;
    const status=rating?.moderationStatus||entry?.status||'published';
    records.push({id:item.id,code:item.id.slice(7),nama:rating?.nama||entry?.review?.nama||null,
      redeemedAt:null,status:STATUSES.has(status)?status:'published'});
  }
  const more=candidates.some(item=>!positions[item.name]||item.id>positions[item.name])
    || snapshots.some(snap=>snap.docs.length===limit+1);
  return {records,nextCursor:more?Buffer.from(JSON.stringify({version:2,...positions})).toString('base64url'):null};
}

export async function listReviewHistory(firestore, cursor = null) {
  const {phase,...positions}=readCursor(cursor),names=Object.keys(SOURCES);
  if(phase==='legacy')return {success:true,...await listLegacyHistory(firestore,positions,PAGE_SIZE)};
  const snapshots=await Promise.all(names.map(name=>{
    const {time,fields}=SOURCES[name];
    let query=firestore.collection(name).orderBy(time,'desc').orderBy('__name__','desc').select(...fields);
    const part=positions[name];
    if(part)query=query.startAfter(part[1]==='number'?part[0]:new Date(part[0]),part[2]);
    return query.limit(PAGE_SIZE+1).get();
  }));
  const found=Object.fromEntries(names.map((name,index)=>[name,new Map(snapshots[index].docs.map(doc=>[doc.id,doc.data()]))]));
  const candidates=names.flatMap((name,index)=>snapshots[index].docs.filter(doc=>milliseconds(doc.data()[SOURCES[name].time])!==null).map(doc=>({
    name,id:doc.id,data:doc.data(),key:position(doc.data()[SOURCES[name].time],doc.id)
  }))).sort((a,b)=>b.key[0]-a.key[0] || b.id.localeCompare(a.id) || a.name.localeCompare(b.name));
  await Promise.all(candidates.filter(item=>REVIEW_ID.test(item.id)).map(async item=>{
    const other=item.name==='ratings'?'review_pending':'ratings';
    if(found[other].has(item.id))return;
    const snap=await firestore.doc(other+'/'+item.id).get();
    found[other].set(item.id,snap.data());
  }));
  const records=[];
  for(const item of candidates){
    if(records.length===PAGE_SIZE)break;
    positions[item.name]=item.key;
    if(!REVIEW_ID.test(item.id))continue;
    const other=item.name==='ratings'?'review_pending':'ratings';
    const related=found[other].get(item.id);
    if(item.name==='ratings' && milliseconds(related?.submittedAt)!==null)continue;
    const rating=item.name==='ratings'?item.data:related;
    const entry=item.name==='review_pending'?item.data:related;
    const status=rating?.moderationStatus || entry?.status || 'published';
    records.push({id:item.id,code:item.id.slice(7),nama:rating?.nama || entry?.review?.nama || null,
      redeemedAt:milliseconds(entry?.submittedAt) ?? milliseconds(rating?.diciptaPada),
      status:STATUSES.has(status)?status:'published'});
  }
  const more=candidates.some(item=>{
    const part=positions[item.name];
    return !part || item.key[0]<part[0] || item.key[0]===part[0] && item.id<part[2];
  }) || snapshots.some(snap=>snap.docs.length===PAGE_SIZE+1);
  if(more)return {success:true,records,nextCursor:Buffer.from(JSON.stringify({version:1,...positions})).toString('base64url')};
  if(records.length===PAGE_SIZE)return {success:true,records,nextCursor:Buffer.from(JSON.stringify({version:2,ratings:null,review_pending:null})).toString('base64url')};
  const legacy=await listLegacyHistory(firestore,{ratings:null,review_pending:null},PAGE_SIZE-records.length);
  return {success:true,records:[...records,...legacy.records],nextCursor:legacy.nextCursor};
}
