export function feedbackVideoUrl(value){
 if(typeof value!=='string'||value.length>2048)return '';
 try{const url=new URL(value.trim());if(url.protocol!=='https:'||url.username||url.password||!/\.(mp4|webm)$/i.test(url.pathname))return '';return url.href;}catch{return '';}
}
export async function videoPlayback(firestore,id,isAdmin=false){
 if(!/^review_[A-Z0-9-]{4,40}$/.test(id||''))throw Object.assign(Error('ID ulasan tidak sah.'),{status:400});
 const rating=await firestore.doc('ratings/'+id).get(),data=rating.data();
 const published=rating.exists&&(!data.moderationStatus||data.moderationStatus==='published')&&data.hidden!==true;
 let review=published?data:null;if(isAdmin&&!review){const pending=await firestore.doc('review_pending/'+id).get();review=pending.data()?.review||data;}
 const url=feedbackVideoUrl(review?.feedbackVideo);if(!url)throw Object.assign(Error('Video tidak tersedia.'),{status:404});return {url};
}
