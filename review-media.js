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
  root.H4ReviewMedia={compressFile,createDraft,pickFile,safeImage,profileZoom,profileZoomStyle,createProfileZoom};
})(window);
