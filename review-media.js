/* Shared camera upload and tab-local draft recovery for review forms. */
(function(root){
  'use strict';
  async function compressFile(file,maxSide=900,quality=.72,format='image/jpeg'){
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
      try{canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);return canvas.toDataURL(format==='image/png'?'image/png':'image/jpeg',quality);}finally{canvas.width=canvas.height=0;}
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
  function profileZoom(value){const n=Number(value);return Number.isFinite(n)?Math.max(50,Math.min(300,n)):100;}
  function profileOffset(value){const n=Number(value);return Number.isFinite(n)?Math.max(-50,Math.min(50,n)):0;}
  function profileZoomStyle(value,offset=0){const n=profileZoom(value);return 'transform:translateY('+profileOffset(offset)+'%) scale('+n/100+');object-fit:'+(n<100?'contain':'cover')+';transform-origin:center';}
  function createProfileZoom(anchor,onChange){
    const box=root.document.createElement('div');box.className='profile-zoom-control';
    box.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0;font-size:13px';
    box.innerHTML='<span>Zoom gambar profil</span><button type="button" aria-label="Kecilkan gambar profil">−</button><input type="range" min="50" max="300" step="5" value="100" aria-label="Zoom gambar profil"><button type="button" aria-label="Besarkan gambar profil">+</button><output>100%</output><button type="button">Reset</button>';
    box.insertAdjacentHTML('beforeend','<label style="display:flex;gap:8px;align-items:center;width:100%">Naik / turun<input class="profile-offset" type="range" min="-50" max="50" step="1" value="0" aria-label="Posisi menegak gambar profil"><output class="profile-offset-output">0%</output></label>');
    anchor.insertAdjacentElement('afterend',box);
    const input=box.querySelector('input'),output=box.querySelector('output'),buttons=box.querySelectorAll('button');
    input.style.cssText='flex:1;min-width:90px;width:120px;max-width:240px';
    buttons.forEach(b=>{b.style.cssText='min-width:34px;min-height:34px;border:1px solid #a9dced;border-radius:8px;background:#eaf8ff;color:#126480;cursor:pointer;padding:4px 8px';});
    const offset=box.querySelector('.profile-offset'),offsetOutput=box.querySelector('.profile-offset-output');offset.style.cssText='flex:1;min-width:90px;width:120px;max-width:240px';
    const setOffset=value=>{offset.value=profileOffset(value);offsetOutput.textContent=offset.value+'%';};
    offset.addEventListener('input',()=>{setOffset(offset.value);onChange?.();});
    const set=value=>{input.value=profileZoom(value);output.textContent=input.value+'%';};
    const change=value=>{set(value);onChange?.();};
    input.addEventListener('input',()=>change(input.value));
    buttons[0].addEventListener('click',()=>change(Number(input.value)-5));buttons[1].addEventListener('click',()=>change(Number(input.value)+5));buttons[2].addEventListener('click',()=>{setOffset(0);change(100);});
    return {get:()=>Number(input.value),set,getOffset:()=>Number(offset.value),setOffset,apply(img){if(img){img.style.transform='translateY('+Number(offset.value)+'%) scale('+Number(input.value)/100+')';img.style.objectFit=Number(input.value)<100?'contain':'cover';img.style.transformOrigin='center';}},box};
  }
  const feedbackPickers=new Set();
  function installFeedbackExtras({container,anchor,onImage,onError}){
    const box=root.document.createElement('div');box.className='feedback-media-extras';box.style.cssText='display:grid;gap:9px;margin:10px 0;font-size:13px;width:100%;flex-basis:100%;min-width:0';
    box.innerHTML='<button type="button" data-feedback-paste>Paste gambar clipboard</button><div data-feedback-paste-zone tabindex="0" role="group" aria-label="Paste gambar feedback" style="padding:12px;border:1px dashed #79bed8;border-radius:9px">Klik sini, kemudian Ctrl+V untuk paste gambar feedback.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-feedback-video-pick disabled>Pilih video MP4 / WebM</button><button type="button" data-feedback-video-remove hidden>Buang video</button><input type="file" accept="video/mp4,video/webm,.mp4,.webm" data-feedback-video-file hidden></div><small data-feedback-video-status role="status">Menyemak sokongan video...</small><video data-feedback-video-preview controls playsinline preload="metadata" hidden style="width:100%;max-height:220px;border-radius:10px"></video>';
    anchor.insertAdjacentElement('afterend',box);const paste=box.querySelector('[data-feedback-paste]'),zone=box.querySelector('[data-feedback-paste-zone]'),pick=box.querySelector('[data-feedback-video-pick]'),remove=box.querySelector('[data-feedback-video-remove]'),input=box.querySelector('[data-feedback-video-file]'),status=box.querySelector('[data-feedback-video-status]'),preview=box.querySelector('video');
    let file=null,objectUrl='',savedId='',uploadedId='',uploadedCode='',dirty=false,imageBusy=false,configured=false,uploading=false;
    const fail=error=>{status.textContent=error.message||'Media gagal dimuatkan.';onError?.(error);};
    const image=async value=>{if(imageBusy||uploading)return;imageBusy=true;paste.disabled=true;try{await onImage(value);}catch(error){fail(error);}finally{imageBusy=false;paste.disabled=false;}};
    zone.addEventListener('click',()=>zone.focus());
    box.addEventListener('paste',event=>{const item=[...(event.clipboardData?.items||[])].find(item=>item.type.startsWith('image/')),value=item?.getAsFile();if(value){event.preventDefault();event.stopPropagation();image(value);}},true);
    paste.addEventListener('click',async()=>{if(!root.navigator.clipboard?.read)return fail(Error('Browser ini tidak menyokong butang paste. Klik kotak paste dan guna Ctrl+V.'));try{for(const item of await root.navigator.clipboard.read()){const type=item.types.find(type=>type.startsWith('image/'));if(type){await image(new root.File([await item.getType(type)],'feedback-clipboard.png',{type}));return;}}fail(Error('Clipboard tiada gambar. Copy gambar dahulu.'));}catch(_){fail(Error('Clipboard tidak dapat dibaca. Klik kotak paste dan guna Ctrl+V.'));}});
    const release=()=>{preview.pause();preview.removeAttribute('src');preview.load();preview.hidden=true;if(objectUrl)root.URL.revokeObjectURL(objectUrl);objectUrl='';};
    const reset=()=>{release();file=null;savedId='';uploadedId='';uploadedCode='';dirty=false;input.value='';remove.hidden=true;status.textContent=configured?'Video pilihan: MP4 / WebM, maksimum 20MB.':'Video belum tersedia. Gambar masih boleh dihantar.';};
    pick.addEventListener('click',()=>{if(!uploading)pickFile(input);});
    input.addEventListener('change',()=>{let next=input.files?.[0];input.value='';if(!next)return;try{const type=next.type||(/\.mp4$/i.test(next.name)?'video/mp4':/\.webm$/i.test(next.name)?'video/webm':'');if(!['video/mp4','video/webm'].includes(type)||next.size>20*1024*1024||next.size<1)throw Error('Video mesti MP4 / WebM dan maksimum 20MB.');if(type!==next.type)next=new root.File([next],next.name,{type});release();file=next;uploadedId='';uploadedCode='';dirty=true;objectUrl=root.URL.createObjectURL(file);preview.src=objectUrl;preview.hidden=false;remove.hidden=false;status.textContent='Video dipilih: '+file.name+'. Upload bermula apabila ulasan dihantar. Pilih semula video jika halaman di-refresh.';}catch(error){fail(error);}});
    remove.addEventListener('click',()=>{if(uploading)return;reset();dirty=true;status.textContent='Video dibuang daripada draf.';});
    const picker={container,async prepare(code,anchor){if(imageBusy)throw Error('Tunggu gambar clipboard siap diproses.');if(!dirty)return undefined;if(!file)return '';if(uploading)throw Error('Video sedang diupload.');if(uploadedId&&uploadedCode===code)return uploadedId;uploading=true;pick.disabled=remove.disabled=true;try{status.textContent='Mengupload video... Jangan tutup halaman.';uploadedId=await root.H4ReviewSubmit.uploadVideo(file,code,{anchor});uploadedCode=code;status.textContent='Video berjaya diupload. Menyimpan ulasan...';return uploadedId;}catch(error){fail(error);throw error;}finally{uploading=false;pick.disabled=!configured;remove.disabled=false;}},complete(edit){const id=uploadedId||savedId;reset();if(edit&&id){savedId=id;remove.hidden=false;status.textContent='Video tersimpan.';}},setExisting(id){reset();savedId=id||'';remove.hidden=!savedId;if(savedId)status.textContent='Video feedback tersimpan. Pilih video lain untuk mengganti.';},reset};feedbackPickers.add(picker);
    root.fetch('/api/review-video?action=status').then(response=>response.json()).then(result=>{configured=result.configured===true;pick.disabled=!configured;if(!file&&!savedId&&!dirty)reset();}).catch(()=>{if(!file&&!savedId&&!dirty)reset();});return picker;
  }
  async function prepareFeedback(code,review,anchor){const picker=[...feedbackPickers].find(picker=>picker.container.contains(anchor));if(!picker)return review;const video=await picker.prepare(code,anchor);return video===undefined?review:{...review,feedbackVideo:video};}
  function completeFeedback(anchor,edit){[...feedbackPickers].find(picker=>picker.container.contains(anchor))?.complete(edit);}
  async function showFeedbackVideo(id,{adminToken}={}){
    let dialog=root.document.getElementById('feedback-video-dialog');if(!dialog){dialog=root.document.createElement('dialog');dialog.id='feedback-video-dialog';dialog.style.cssText='width:min(720px,calc(100% - 24px));max-height:90dvh;border:1px solid #92cde1;border-radius:14px;padding:14px;background:#f5fcff;color:#173d56';dialog.innerHTML='<button type="button" style="float:right;padding:8px 12px">Tutup ×</button><p role="status">Memuatkan video...</p><video controls playsinline preload="none" style="width:100%;max-height:72dvh"></video>';root.document.body.append(dialog);dialog.querySelector('button').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{const video=dialog.querySelector('video');video.pause();video.removeAttribute('src');video.load();});dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});}
    const status=dialog.querySelector('p'),video=dialog.querySelector('video');video.pause();video.removeAttribute('src');status.textContent='Memuatkan video...';if(!dialog.open)dialog.showModal();try{const headers={};if(adminToken)headers.Authorization='Bearer '+adminToken;const response=await root.fetch('/api/review-video?id='+encodeURIComponent(id),{headers});const result=await response.json();if(!response.ok)throw Error(result.error||'Video tidak tersedia.');if(dialog.open){video.src=result.url;status.textContent='Tekan Play untuk menonton video.';}}catch(error){status.textContent=error.message;}
  }
  root.H4ReviewMedia={compressFile,createDraft,pickFile,safeImage,installFeedbackExtras,prepareFeedback,completeFeedback,showFeedbackVideo,profileZoom,profileZoomStyle,createProfileZoom};
})(window);
