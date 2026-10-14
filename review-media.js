/* Shared camera upload and tab-local draft recovery for review forms. */
(function(root){
  'use strict';
  async function compressFile(file,maxSide=900,quality=.72){
    if(!file||!file.type?.startsWith('image/'))throw Error('Pilih fail gambar yang sah.');
    if(file.size>20*1024*1024)throw Error('Gambar terlalu besar. Maksimum 20MB.');
    let source,objectUrl;
    try{
      if(typeof root.createImageBitmap==='function'){
        try{source=await root.createImageBitmap(file,{resizeWidth:maxSide,resizeQuality:'medium',imageOrientation:'from-image'});}catch(_){}
      }
      if(!source){objectUrl=root.URL.createObjectURL(file);source=await new Promise((resolve,reject)=>{const image=new root.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Gagal membaca gambar. Cuba JPG atau PNG.'));image.src=objectUrl;});}
      const width=source.width||source.naturalWidth,height=source.height||source.naturalHeight;
      if(!width||!height)throw Error('Gambar tidak sah.');
      const scale=Math.min(1,maxSide/Math.max(width,height));const canvas=root.document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      try{canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',quality);}finally{canvas.width=canvas.height=0;}
    }finally{source?.close?.();if(objectUrl)root.URL.revokeObjectURL(objectUrl);}
  }
  function createDraft(options){
    const key=options.key;let timer,cleared=false;
    const save=()=>{root.clearTimeout(timer);if(cleared)return;const data={version:1,savedAt:Date.now(),fields:{},extra:options.getExtra(),resume:!!options.isOpen?.()};options.fields.forEach(id=>{const input=root.document.getElementById(id);if(input)data.fields[id]=input.value;});
      const meaningful=options.fields.some(id=>!/(?:rating|Bintang)$/.test(id)&&String(data.fields[id]||'').trim())||data.extra.profileImage||data.extra.feedbackImage;
      if(!meaningful){try{root.sessionStorage.removeItem(key);}catch(_){}return;}
      try{root.sessionStorage.setItem(key,JSON.stringify(data));}catch(_){try{data.extra={...data.extra,profileImage:null,feedbackImage:null};root.sessionStorage.setItem(key,JSON.stringify(data));}catch(_){}}
    };
    const queue=()=>{cleared=false;root.clearTimeout(timer);timer=root.setTimeout(save,250);};
    ['input','change','click'].forEach(event=>options.container.addEventListener(event,queue));
    root.addEventListener('pagehide',save);root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)save();});
    return {save,clear(){cleared=true;root.clearTimeout(timer);try{root.sessionStorage.removeItem(key);}catch(_){}},restore(){let data;try{data=JSON.parse(root.sessionStorage.getItem(key));}catch(_){return false;}
      if(!data||data.version!==1||Date.now()-data.savedAt>24*60*60*1000)return false;
      options.fields.forEach(id=>{const input=root.document.getElementById(id);const value=data.fields?.[id];if(input&&typeof value==='string')input.value=value.slice(0,input.maxLength>0?input.maxLength:1000);});options.restoreExtra(data.extra||{});options.onRestore?.(data);return true;
    }};
  }
  function safeImage(value){return typeof value==='string'&&value.length<=1200000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:null;}
  function pickFile(input,draft){draft?.save();const playing=[...root.document.querySelectorAll('video')].filter(video=>!video.paused);playing.forEach(video=>video.pause());
    let done=false;const finish=()=>{if(done)return;done=true;input.removeEventListener('change',finish);input.removeEventListener('cancel',finish);root.removeEventListener('focus',focused);root.setTimeout(()=>playing.forEach(video=>{const r=video.getBoundingClientRect();if(video.isConnected&&!root.document.hidden&&r.width&&r.height&&r.bottom>0&&r.top<root.innerHeight)video.play().catch(()=>{});}),300);};const focused=()=>root.setTimeout(finish,500);input.addEventListener('change',finish);input.addEventListener('cancel',finish);root.addEventListener('focus',focused);input.click();
  }
  root.H4ReviewMedia={compressFile,createDraft,pickFile,safeImage};
})(window);
